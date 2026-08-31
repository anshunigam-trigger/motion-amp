# API Reference

Base URL (local development): `http://127.0.0.1:8000`

Interactive, auto-generated docs are also available at `/docs` (Swagger UI)
whenever the server is running — this reference exists for offline reading
and for documenting the *why*, not just the *what*.

---

## `GET /`

Health check. Confirms the server is running.

**Response `200`:**
```json
{"status": "backend is running"}
```

---

## `POST /api/upload`

Uploads a video file and creates a new job.

**Request:** `multipart/form-data`, field name `file`.

**Validation:** file extension must be in `ALLOWED_VIDEO_EXTENSIONS`
(`.mp4`, `.mov`, `.avi`, defined in `config.py`). Anything else → `400`.

**Example:**
```bash
curl -X POST "http://127.0.0.1:8000/api/upload" \
  -F "file=@vibrating_panel.mp4"
```

**Response `200`:**
```json
{"job_id": "a897b7e5-db28-435a-be9e-55e9ceca52e8", "filename": "vibrating_panel.mp4"}
```

**What happens internally:** a random UUID is generated as `job_id`, the
file is saved to `UPLOAD_DIR` as `{job_id}{ext}`, and a new row is created
in the `jobs` table with `status = 'queued'`.

---

## `POST /api/jobs/{job_id}/roi`

Submits the region-of-interest and frequency settings for a job. Must be
called before `/process`.

**Request body:**
```json
{
  "x": 135, "y": 40, "w": 10, "h": 160,
  "preset": "custom",
  "low_hz": 10, "high_hz": 20,
  "alpha": 5
}
```

| Field | Type | Notes |
|---|---|---|
| `x`, `y`, `w`, `h` | int | ROI box in pixels: top-left corner + width/height |
| `preset` | string | `"engine"`, `"structural"`, or `"custom"` |
| `low_hz`, `high_hz` | float, optional | **Required** if `preset` is `"custom"`; ignored otherwise (the preset's fixed range is used) |
| `alpha` | float, optional | Amplification factor. Defaults to `DEFAULT_ALPHA` if omitted. Always capped at `MAX_ALPHA` |

**Frequency presets** (from `config.py`):

| Preset | Range |
|---|---|
| `engine` | 8–40 Hz |
| `structural` | 1–6 Hz |
| `custom` | user-specified `low_hz`/`high_hz` |

**Errors:**
- `404` — job doesn't exist
- `400` — `preset` is `"custom"` but `low_hz`/`high_hz` missing
- `400` — `preset` is not a recognized value

**Response `200`:**
```json
{"status": "roi_saved", "job_id": "...", "low_hz": 10.0, "high_hz": 20.0, "alpha": 5.0}
```

---

## `POST /api/jobs/{job_id}/process`

Starts processing. Runs in the background — this endpoint returns
immediately; poll `/status` to know when it's finished.

**Preconditions checked:**
- job must exist (`404` if not)
- job must not already be `"done"` or `"processing"` (`400` if so)
- `/roi` must have been called first — `band_low_hz`/`band_high_hz` must be
  set (`400` with a clear message if not)

**Response `200`:**
```json
{"status": "processing", "job_id": "..."}
```

**What happens internally (background task):** loads the uploaded video →
crops to the saved ROI → runs `run_phase_based_evm` (the real, phase-based
magnification algorithm) → saves the amplified video to `RESULTS_DIR` →
runs `analyze_vibration` on the amplified signal → saves the result and
marks the job `"done"`. If anything raises an exception at any point, the
job is marked `"failed"` and the error is printed server-side.

---

## `GET /api/jobs/{job_id}/status`

**Response `200`:**
```json
{"job_id": "...", "status": "processing"}
```

`status` is one of: `"queued"`, `"processing"`, `"done"`, `"failed"`.

**Errors:** `404` if job doesn't exist.

---

## `GET /api/jobs/{job_id}/result`

Returns the final analysis, once processing has finished.

**Errors:**
- `404` — job doesn't exist
- `400` — job exists but isn't `"done"` yet (message includes current status)

**Response `200`:**
```json
{
  "job_id": "a897b7e5-...",
  "amplified_video_url": "results/a897b7e5-..._amplified.mp4",
  "intensity_series": [0.14687, 0.62813, 0.04812, "..."],
  "dominant_freq_hz": 15.063,
  "flag": "periodic_vibration_detected"
}
```

| Field | Meaning |
|---|---|
| `amplified_video_url` | Path to the saved, motion-amplified output video |
| `intensity_series` | The raw motion-over-time signal used for detection — plottable as a chart |
| `dominant_freq_hz` | The strongest frequency found within the requested band |
| `flag` | `"periodic_vibration_detected"` or `"no_vibration_detected"` — based on the statistical peakiness test, **not** frequency or amplitude alone |

**Known issue:** on Windows, `amplified_video_url` currently contains
backslashes (`results\\...`) rather than forward slashes. Browsers expect
forward slashes in URLs — this should be normalized (e.g. via `pathlib` or
`.replace("\\", "/")`) before the frontend consumes this field.

---

## `GET /api/jobs`

Returns a summary of every job, newest first — intended for a dashboard/
history view.

**Response `200`:**
```json
{
  "jobs": [
    {
      "job_id": "...",
      "timestamp": "2026-08-20 14:32:01",
      "status": "done",
      "flag": "periodic_vibration_detected",
      "dominant_freq_hz": 15.063
    }
  ]
}
```

---

## Error format

All errors use FastAPI's standard shape:
```json
{"detail": "human-readable message"}
```
with an appropriate HTTP status code (`400` for bad input, `404` for
missing resources).
