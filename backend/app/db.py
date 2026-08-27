import sqlite3

# Database file
DB_NAME = "jobs.db"


def get_connection():
    """Creates and returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_NAME)
    return conn


def init_db():
    """Creates the required database tables if they do not already exist."""
    conn = get_connection()
    cursor = conn.cursor()

    # Stores information about every uploaded video/job
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Stores the final analysis result for a completed job
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS results (
            job_id TEXT PRIMARY KEY,
            amplified_video_path TEXT,
            dominant_freq_hz REAL,
            intensity_series_json TEXT,
            flag TEXT,
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
            job_id,
            filename,
            roi_x,
            roi_y,
            roi_w,
            roi_h,
            freq_preset,
            band_low_hz,
            band_high_hz,
            alpha,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')
    """, (
        job_id,
        filename,
        rx,
        ry,
        rw,
        rh,
        preset,
        low_hz,
        high_hz,
        alpha
    ))

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
        SET roi_x = ?,
            roi_y = ?,
            roi_w = ?,
            roi_h = ?,
            freq_preset = ?,
            band_low_hz = ?,
            band_high_hz = ?,
            alpha = ?
        WHERE job_id = ?
    """, (
        roi["x"],
        roi["y"],
        roi["w"],
        roi["h"],
        preset,
        low_hz,
        high_hz,
        alpha,
        job_id
    ))

    conn.commit()
    conn.close()


def save_job_result(
    job_id: str,
    video_path: str,
    dominant_freq: float,
    intensity_series_json: str,
    flag: str
):
    """Stores the final result and marks the job as done."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO results (
            job_id,
            amplified_video_path,
            dominant_freq_hz,
            intensity_series_json,
            flag
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        job_id,
        video_path,
        dominant_freq,
        intensity_series_json,
        flag
    ))

    cursor.execute(
        "UPDATE jobs SET status = 'done' WHERE job_id = ?",
        (job_id,)
    )

    conn.commit()
    conn.close()


def mark_job_failed(job_id: str):
    """Marks a job as failed if processing encounters an error."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE jobs SET status = 'failed' WHERE job_id = ?",
        (job_id,)
    )

    conn.commit()
    conn.close()


def get_job_by_id(job_id: str):
    """Returns the status and result information for one job."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            j.status,
            r.amplified_video_path,
            r.dominant_freq_hz,
            r.intensity_series_json,
            r.flag
        FROM jobs j
        LEFT JOIN results r ON j.job_id = r.job_id
        WHERE j.job_id = ?
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
            j.job_id,
            j.created_at,
            j.status,
            r.flag,
            r.dominant_freq_hz
        FROM jobs j
        LEFT JOIN results r ON j.job_id = r.job_id
        ORDER BY j.created_at DESC
    """)

    rows = cursor.fetchall()

    conn.close()

    return rows


if __name__ == "__main__":
    init_db()