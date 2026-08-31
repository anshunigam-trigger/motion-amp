import os
import uuid
import json
import logging
from typing import Optional

import aiofiles
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import db
from app.config import (
    UPLOAD_DIR,
    RESULTS_DIR,
    ALLOWED_VIDEO_EXTENSIONS,
    FREQ_PRESETS,
    DEFAULT_ALPHA,
    MAX_ALPHA,
    MAX_CLIP_SECONDS,
    MAX_UPLOAD_BYTES,
)
from app.io.video_io import read_video_frames, write_video
from app.core.pipeline import run_phase_based_evm
from app.analytics.vibration import analyze_vibration

logger = logging.getLogger(__name__)



app = FastAPI(title="Motion Amplification Video Analysis System")


# Allow the React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the results directory statically so frontend can play videos
os.makedirs(RESULTS_DIR, exist_ok=True)
app.mount("/results", StaticFiles(directory=RESULTS_DIR), name="results")


@app.on_event("startup")
def on_startup():
    """Initialize the database and required folders when the server starts."""
    db.init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def read_root():
    """Basic health check for the backend."""
    return {"status": "backend is running"}


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """Uploads a video and creates a new job.

    Security hardening applied:
    - Extension allowlist check
    - Magic-byte content validation (prevents renamed non-video files)
    - Chunked streaming write (prevents OOM on large files)
    - MAX_UPLOAD_BYTES ceiling with automatic partial-file cleanup
    - Filename sanitized before storing to DB
    """
    import pathlib

    # --- 1. Extension check ---
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_VIDEO_EXTENSIONS)}"
        )

    # --- 2. Magic-byte validation ---
    # Read just the first 12 bytes to check the container signature
    MAGIC_SIGNATURES = {
        b"ftyp": "mp4/mov",   # bytes 4-8 for MP4/MOV (ISO Base Media)
        b"RIFF": "avi",       # bytes 0-4 for AVI
        b"\x1aE\xdf\xa3": "webm",
    }
    header = await file.read(12)
    await file.seek(0)

    is_valid = (
        header[4:8] in (b"ftyp", b"free", b"mdat", b"moov", b"wide")  # MP4/MOV
        or header[:4] == b"RIFF"                                        # AVI
        or header[:4] == b"\x1aE\xdf\xa3"                              # WebM/MKV
    )
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=(
                "File content does not match a recognised video format. "
                "Ensure you are uploading an actual video file, not a renamed document."
            )
        )

    # --- 3. Sanitize filename for DB storage ---
    safe_filename = pathlib.Path(file.filename).name  # strips any directory separators

    # --- 4. Stream to disk in chunks with a size ceiling ---
    job_id = str(uuid.uuid4())
    saved_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")

    CHUNK_SIZE = 1024 * 1024  # 1 MB per chunk
    total_bytes = 0

    try:
        async with aiofiles.open(saved_path, "wb") as out_file:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"Upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit. "
                            "Please trim or compress the video before uploading."
                        )
                    )
                await out_file.write(chunk)
    except HTTPException:
        # Clean up partial file before re-raising
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise

    db.create_job(
        job_id=job_id,
        filename=safe_filename,
        alpha=None,
        low_hz=None,
        high_hz=None,
        preset="custom",
        roi=None,
    )

    return {
        "job_id": job_id,
        "filename": safe_filename,
    }



class RoiRequest(BaseModel):
    x: int
    y: int
    w: int
    h: int
    preset: str
    low_hz: Optional[float] = None
    high_hz: Optional[float] = None
    alpha: Optional[float] = None


@app.post("/api/jobs/{job_id}/roi")
def submit_roi(job_id: str, roi: RoiRequest):
    """Saves the ROI and frequency settings for a job."""

    existing = db.get_job_by_id(job_id)

    if existing is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    if roi.preset == "custom":
        if roi.low_hz is None or roi.high_hz is None:
            raise HTTPException(
                status_code=400,
                detail="low_hz and high_hz are required when preset is 'custom'"
            )
        low_hz = roi.low_hz
        high_hz = roi.high_hz

    elif roi.preset in FREQ_PRESETS:
        preset_range = FREQ_PRESETS[roi.preset]
        low_hz = preset_range["low_hz"]
        high_hz = preset_range["high_hz"]

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown preset: {roi.preset}"
        )

    alpha = (
        roi.alpha
        if roi.alpha is not None
        else DEFAULT_ALPHA
    )

    alpha = min(alpha, MAX_ALPHA)

    db.update_job_roi(
        job_id=job_id,
        roi={
            "x": roi.x,
            "y": roi.y,
            "w": roi.w,
            "h": roi.h
        },
        preset=roi.preset,
        low_hz=low_hz,
        high_hz=high_hz,
        alpha=alpha,
    )

    return {
        "status": "roi_saved",
        "job_id": job_id,
        "low_hz": low_hz,
        "high_hz": high_hz,
        "alpha": alpha,
    }




def run_processing(job_id: str):
    """Background task: loads the upload, validates constraints, crops to ROI,
    runs the phase-based EVM pipeline, saves the amplified video, then runs
    FFT + peakiness detection and writes results to the database.

    Raises no exceptions — all errors mark the job as 'failed' in the DB
    so the frontend can surface them to the user.
    """

    try:
        filename, roi_x, roi_y, roi_w, roi_h, low_hz, high_hz, alpha = db.get_job_settings(job_id)

        ext = os.path.splitext(filename)[1].lower()
        saved_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")

        frames, fps = read_video_frames(saved_path)

        # --- Guard: clip length ---
        clip_seconds = len(frames) / fps
        if clip_seconds > MAX_CLIP_SECONDS:
            raise ValueError(
                f"Clip is {clip_seconds:.1f}s — exceeds the {MAX_CLIP_SECONDS}s limit. "
                "Please upload a shorter clip."
            )

        # --- Guard: ROI bounds ---
        frame_h, frame_w = frames.shape[1], frames.shape[2]
        if (
            roi_x < 0 or roi_y < 0
            or roi_x + roi_w > frame_w
            or roi_y + roi_h > frame_h
        ):
            raise ValueError(
                f"ROI ({roi_x}, {roi_y}, {roi_w}×{roi_h}) falls outside "
                f"frame bounds ({frame_w}×{frame_h}). "
                "Please resubmit with a valid region of interest."
            )
        if roi_w < 4 or roi_h < 4:
            raise ValueError(
                f"ROI dimensions ({roi_w}×{roi_h}) are too small for pyramid "
                "decomposition. Minimum is 4×4 pixels."
            )

        roi_frames = frames[:, roi_y:roi_y + roi_h, roi_x:roi_x + roi_w]

        amplified, filter_warnings = run_phase_based_evm(roi_frames, fps, low_hz=low_hz, high_hz=high_hz, alpha=alpha)

        if filter_warnings:
            logger.warning("Job %s: bandpass frequency clamping applied — %s", job_id, filter_warnings)

        # Composite the amplified ROI back into the full-frame original video
        full_frames_amplified = frames.copy()
        full_frames_amplified[:, roi_y:roi_y + roi_h, roi_x:roi_x + roi_w] = amplified

        os.makedirs(RESULTS_DIR, exist_ok=True)
        result_path = os.path.join(RESULTS_DIR, f"{job_id}_amplified.mp4")
        write_video(result_path, full_frames_amplified, fps)

        analysis = analyze_vibration(amplified, fps, roi=None, low_hz=low_hz, high_hz=high_hz)

        flag = "periodic_vibration_detected" if analysis["metrics"]["detected"] else "no_vibration_detected"

        db.save_job_result(
            job_id=job_id,
            video_path=result_path,
            dominant_freq=analysis["metrics"]["dominant_frequency_hz"],
            intensity_series_json=json.dumps(analysis["time_series"]["motion_intensity"]),
            spectrum_json=json.dumps(analysis["frequency_spectrum"]),
            flag=flag,
        )

        logger.info("Job %s completed — %s @ %.3f Hz", job_id, flag, analysis["metrics"]["dominant_frequency_hz"])


    except Exception as error:
        db.mark_job_failed(job_id, str(error))
        logger.error("Processing failed for job %s: %s", job_id, error, exc_info=True)




@app.post("/api/jobs/{job_id}/process")
def process_job(job_id: str, background_tasks: BackgroundTasks):
    """Starts processing for a job after ROI/settings are provided."""

    existing = db.get_job_by_id(job_id)

    if existing is None:
        raise HTTPException(status_code=404, detail="Job not found")

    status = existing[0]

    if status == "done":
        raise HTTPException(status_code=400, detail="Job already completed")

    if status == "processing":
        raise HTTPException(status_code=400, detail="Job is already being processed")

    conn = db.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT band_low_hz, band_high_hz
        FROM jobs
        WHERE job_id = ?
        """,
        (job_id,)
    )

    band_row = cursor.fetchone()
    conn.close()

    if band_row is None:
        raise HTTPException(status_code=404, detail="Job not found")

    band_low_hz, band_high_hz = band_row

    if band_low_hz is None or band_high_hz is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "ROI and frequency preset must be submitted "
                "before processing (call /roi first)"
            )
        )

    conn = db.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE jobs
        SET status = 'processing'
        WHERE job_id = ?
        """,
        (job_id,)
    )

    conn.commit()
    conn.close()

    background_tasks.add_task(run_processing, job_id)

    return {"status": "processing", "job_id": job_id}


@app.get("/api/jobs/{job_id}/status")
def get_job_status(job_id: str):
    """Returns the current status of a job."""

    row = db.get_job_by_id(job_id)

    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if len(row) == 7: # We added error_message
        status, _, _, _, _, _, error_message = row
    else:
        status = row[0]
        error_message = None

    return {"job_id": job_id, "status": status, "error_message": error_message}


@app.get("/api/jobs/{job_id}/result")
def get_job_result(job_id: str):
    """Returns the final analysis result of a completed job."""

    row = db.get_job_by_id(job_id)

    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if len(row) == 7:
        status, video_path, dominant_freq, intensity_series_json, spectrum_json, flag, error_message = row
    else:
        status, video_path, dominant_freq, intensity_series_json, spectrum_json, flag = row
        error_message = None

    if status != "done":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not finished yet (current status: {status})"
        )

    return {
        "job_id": job_id,
        "amplified_video_url": video_path,
        "intensity_series": json.loads(intensity_series_json),
        "frequency_spectrum": json.loads(spectrum_json) if spectrum_json else None,
        "dominant_freq_hz": dominant_freq,
        "flag": flag,
    }


@app.get("/api/jobs")
def list_jobs():
    """Returns all jobs for the dashboard history screen."""

    rows = db.get_all_jobs()

    jobs = []
    for job_id, created_at, status, flag, dominant_freq_hz in rows:
        jobs.append({
            "job_id": job_id,
            "timestamp": created_at,
            "status": status,
            "flag": flag,
            "dominant_freq_hz": dominant_freq_hz,
        })

    return {"jobs": jobs}


if __name__ == "__main__":
    db.init_db()