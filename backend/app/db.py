import sqlite3

# Database file
DB_NAME = "jobs.db"


def get_connection():
    """Creates and returns a connection to the SQLite database.

    WAL journal mode is enabled so concurrent reads don't block writes
    and vice-versa (critical when background processing tasks run
    alongside API requests).  The 30-second timeout prevents
    'database is locked' errors under concurrent job submissions.
    """
    conn = sqlite3.connect(DB_NAME, timeout=30, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Creates the required database tables if they do not already exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            job_id TEXT PRIMARY KEY,
            filename TEXT,
            roi_x INTEGER,
            roi_y INTEGER,
            roi_w INTEGER,
            roi_h INTEGER,
            freq_preset TEXT,
            band_low_hz REAL,
            band_high_hz REAL,
            alpha REAL,
            status TEXT,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS results (
            job_id TEXT PRIMARY KEY,
            amplified_video_path TEXT,
            dominant_freq_hz REAL,
            intensity_series_json TEXT,
            spectrum_json TEXT,
            flag TEXT,
            confidence REAL,
            amplitude_px REAL,
            FOREIGN KEY (job_id) REFERENCES jobs (job_id)
        )
    """)

    conn.commit()
    conn.close()

    print("Database tables initialized successfully.")


def create_job(
    job_id: str,
    filename: str,
    alpha: float,
    low_hz: float,
    high_hz: float,
    preset: str = "custom",
    roi: dict = None
):
    """Creates a new job when a video is uploaded."""
    conn = get_connection()
    cursor = conn.cursor()

    rx = roi.get("x") if roi else None
    ry = roi.get("y") if roi else None
    rw = roi.get("w") if roi else None
    rh = roi.get("h") if roi else None

    cursor.execute("""
        INSERT INTO jobs (
            job_id, filename, roi_x, roi_y, roi_w, roi_h,
            freq_preset, band_low_hz, band_high_hz, alpha, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')
    """, (job_id, filename, rx, ry, rw, rh, preset, low_hz, high_hz, alpha))

    conn.commit()
    conn.close()


def update_job_roi(
    job_id: str,
    roi: dict,
    preset: str,
    low_hz: float,
    high_hz: float,
    alpha: float
):
    """Stores the ROI and frequency settings for an existing job."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE jobs
        SET roi_x = ?, roi_y = ?, roi_w = ?, roi_h = ?,
            freq_preset = ?, band_low_hz = ?, band_high_hz = ?, alpha = ?
        WHERE job_id = ?
    """, (roi["x"], roi["y"], roi["w"], roi["h"], preset, low_hz, high_hz, alpha, job_id))

    conn.commit()
    conn.close()


def save_job_result(
    job_id: str,
    video_path: str,
    dominant_freq: float,
    intensity_series_json: str,
    spectrum_json: str,
    flag: str,
    confidence: float,
    amplitude_px: float
):
    """Stores the final result and marks the job as done."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO results (
            job_id, amplified_video_path, dominant_freq_hz,
            intensity_series_json, spectrum_json, flag,
            confidence, amplitude_px
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_id, video_path, dominant_freq, intensity_series_json, spectrum_json, flag, confidence, amplitude_px))

    cursor.execute(
        "UPDATE jobs SET status = 'done' WHERE job_id = ?",
        (job_id,)
    )

    conn.commit()
    conn.close()


def mark_job_failed(job_id: str, error_message: str = None):
    """Marks a job as failed if processing encounters an error, storing the reason."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE jobs SET status = 'failed', error_message = ? WHERE job_id = ?",
        (error_message, job_id,)
    )

    conn.commit()
    conn.close()


def get_job_by_id(job_id: str):
    """Returns the status and result information for one job."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            j.status, r.amplified_video_path, r.dominant_freq_hz,
            r.intensity_series_json, r.spectrum_json, r.flag, j.error_message,
            r.confidence, r.amplitude_px, j.filename,
            j.roi_x, j.roi_y, j.roi_w, j.roi_h
        FROM jobs j
        LEFT JOIN results r ON j.job_id = r.job_id
        WHERE j.job_id = ?
    """, (job_id,))

    row = cursor.fetchone()
    conn.close()

    return row


def get_job_settings(job_id: str):
    """
    Returns everything needed to actually RUN the pipeline for a job:
    the uploaded filename, the ROI box, the frequency band, and alpha.

    Kept separate from get_job_by_id() (which returns STATUS/RESULTS)
    because these are two different questions: "what happened to this
    job" vs. "what settings should be used to process it."
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            filename,
            roi_x, roi_y, roi_w, roi_h,
            band_low_hz, band_high_hz,
            alpha
        FROM jobs
        WHERE job_id = ?
    """, (job_id,))

    row = cursor.fetchone()
    conn.close()

    return row


def get_all_jobs():
    """Returns a summary of all jobs, newest first."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            j.job_id, j.created_at, j.status, r.flag, r.dominant_freq_hz, r.confidence, r.amplitude_px, j.filename
        FROM jobs j
        LEFT JOIN results r ON j.job_id = r.job_id
        ORDER BY j.created_at DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    return rows


if __name__ == "__main__":
    init_db()