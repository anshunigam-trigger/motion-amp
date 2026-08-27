# main.py

import os
import uuid
import time
import json
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import db
from app.config import (
    UPLOAD_DIR,
    ALLOWED_VIDEO_EXTENSIONS,
    FREQ_PRESETS,
    DEFAULT_ALPHA,
    MAX_ALPHA,
)


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
    """Uploads a video and creates a new job."""

    # Check the file extension
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}"
        )

    # Create a unique ID for the job
    job_id = str(uuid.uuid4())

    # Save the video using the job ID as the filename
    saved_path = os.path.join(
        UPLOAD_DIR,
        f"{job_id}{ext}"
    )

    with open(saved_path, "wb") as out_file:
        content = await file.read()
        out_file.write(content)

    # Create the job in the database
    db.create_job(
        job_id=job_id,
        filename=file.filename,
        alpha=None,
        low_hz=None,
        high_hz=None,
        preset="custom",
        roi=None,
    )

    return {
        "job_id": job_id,
        "filename": file.filename
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

    # Make sure the job exists
    existing = db.get_job_by_id(job_id)

    if existing is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    # Resolve the frequency range
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

    # Use the default alpha if the user didn't provide one
    alpha = (
        roi.alpha
        if roi.alpha is not None
        else DEFAULT_ALPHA
    )

    # Keep alpha within the allowed maximum
    alpha = min(alpha, MAX_ALPHA)

    # Save everything in the database
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


def run_processing_stub(job_id: str):
    """
    Temporary processing function.

    This currently simulates the real motion-analysis pipeline.
    Later it will be replaced with the actual pipeline code.
    """

    try:
        # Simulate processing time
        time.sleep(5)

        # Temporary fake analysis result
        fake_intensity_series = [
            0.1,
            0.4,
            0.9,
            0.3,
            0.2,
            0.8,
            0.5
        ]

        dominant_freq = 12.5
        flag = "periodic_vibration_detected"

        # Save the result
        db.save_job_result(
            job_id=job_id,
            video_path=f"results/{job_id}_amplified.mp4",
            dominant_freq=dominant_freq,
            intensity_series_json=json.dumps(
                fake_intensity_series
            ),
            flag=flag,
        )

    except Exception as error:
        # If anything goes wrong, mark the job as failed
        db.mark_job_failed(job_id)

        print(
            f"Processing failed for job {job_id}: {error}"
        )


@app.post("/api/jobs/{job_id}/process")
def process_job(
    job_id: str,
    background_tasks: BackgroundTasks
):
    """Starts processing for a job after ROI/settings are provided."""

    # Check that the job exists
    existing = db.get_job_by_id(job_id)

    if existing is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    # Get the current status
    status = existing[0]

    if status == "done":
        raise HTTPException(
            status_code=400,
            detail="Job already completed"
        )

    if status == "processing":
        raise HTTPException(
            status_code=400,
            detail="Job is already being processed"
        )

    # Check that frequency settings were submitted
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
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    band_low_hz, band_high_hz = band_row

    if band_low_hz is None or band_high_hz is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "ROI and frequency preset must be submitted "
                "before processing (call /roi first)"
            )
        )

    # Mark the job as processing
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

    # Run the processing in the background
    background_tasks.add_task(
        run_processing_stub,
        job_id
    )

    return {
        "status": "processing",
        "job_id": job_id
    }


@app.get("/api/jobs/{job_id}/status")
def get_job_status(job_id: str):
    """Returns the current status of a job."""

    row = db.get_job_by_id(job_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    status = row[0]

    return {
        "job_id": job_id,
        "status": status
    }


@app.get("/api/jobs/{job_id}/result")
def get_job_result(job_id: str):
    """Returns the final analysis result of a completed job."""

    row = db.get_job_by_id(job_id)

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )

    status, video_path, dominant_freq, intensity_series_json, flag = row

    if status != "done":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Job is not finished yet "
                f"(current status: {status})"
            )
        )

    return {
        "job_id": job_id,
        "amplified_video_url": video_path,
        "intensity_series": json.loads(
            intensity_series_json
        ),
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

    return {
        "jobs": jobs
    }


if __name__ == "__main__":
    db.init_db()