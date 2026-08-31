# System Architecture

## Overview

This system takes a video, amplifies motion that's invisible to the naked
eye, and then mathematically verifies whether that motion is a genuine,
periodic vibration — not camera shake, sensor noise, or a coincidence.

It's built in four layers, each with a single clear responsibility:

```mermaid
flowchart TB
    subgraph Frontend["Frontend Layer (React — in progress)"]
        UI[Upload UI, ROI selection, results dashboard]
    end

    subgraph API["API Layer (FastAPI)"]
        Endpoints[REST endpoints: upload / roi / process / status / result]
    end

    subgraph Core["Core Algorithm Layer (Python)"]
        Pyramid[pyramid.py<br/>spatial decomposition]
        Riesz[riesz.py + phase.py<br/>sub-pixel phase extraction]
        Bandpass[bandpass.py<br/>temporal filtering]
        Pipeline[pipeline.py<br/>baseline + phase-based EVM]
        Vibration[analytics/vibration.py<br/>FFT + peakiness detection]
    end

    subgraph Storage["Storage Layer (SQLite)"]
        DB[(jobs + results tables)]
        Files[uploads/ and results/ folders]
    end

    UI --> Endpoints
    Endpoints --> Pipeline
    Pipeline --> Pyramid
    Pipeline --> Riesz
    Pipeline --> Bandpass
    Pipeline --> Vibration
    Endpoints --> DB
    Endpoints --> Files
```

## Why this layering

- **Core algorithm layer has zero knowledge of the web/API/database.** Every
  function in `core/` and `analytics/` takes plain NumPy arrays in, returns
  plain NumPy arrays or dictionaries out. This was deliberate — it's what let
  us test and validate the entire algorithm using standalone scripts and
  synthetic test clips, completely independent of the API ever existing.
  The API layer is a thin wrapper around this, not the other way around.
- **The API layer's only job is: accept HTTP requests, validate them, call
  the core layer, store/return results.** It contains no signal-processing
  logic of its own.
- **The storage layer is intentionally simple** — plain SQLite via the
  standard-library `sqlite3` module, no ORM. Appropriate for a hackathon
  prototype's job/results tracking; would need to be reconsidered (e.g.
  PostgreSQL) for concurrent multi-user production use.

## Processing pipeline, in detail

```mermaid
flowchart LR
    A[Raw video frames] --> B[Crop to ROI]
    B --> C[Laplacian Pyramid<br/>per frame]
    C --> D[Riesz Transform<br/>per pyramid level]
    D --> E[Phase extraction<br/>+ unwrapping]
    E --> F[Temporal band-pass<br/>filter on phase]
    F --> G[Amplify phase<br/>by alpha]
    G --> H[Reconstruct frames<br/>from amplified pyramid]
    H --> I[Save amplified video]
    H --> J[Run FFT + peakiness<br/>on amplified signal]
    J --> K[detected: true/false<br/>+ dominant frequency]
```

**Key design decision — crop to ROI *before* running the pipeline, not
after.** Two reasons: (1) it directly matches the requirement that
processing runs "on the selected region of interest," and (2) cropping
first means every downstream computation (pyramid, Riesz transform, FFT)
only ever runs on a small region instead of a full frame — this is what
keeps processing time low.

**Key design decision — detect vibration on the *amplified* signal, not the
raw upload.** Our band-pass filter (baked into the amplification step)
suppresses out-of-band noise (e.g. video codec compression artifacts) and
boosts the real signal before detection ever runs. Testing showed this
matters a lot: the same footage that failed detection when analyzed raw
succeeded once run through amplification first. See
[`../ml/vibration-analysis.md`](../ml/vibration-analysis.md) for the full
investigation.

## Request/response flow

```mermaid
sequenceDiagram
    participant U as User / Frontend
    participant A as FastAPI Backend
    participant DB as SQLite
    participant P as Pipeline + Analytics

    U->>A: POST /api/upload (video file)
    A->>DB: create_job()
    A-->>U: job_id

    U->>A: POST /api/jobs/{id}/roi (region + frequency band)
    A->>DB: update_job_roi()
    A-->>U: confirmed settings

    U->>A: POST /api/jobs/{id}/process
    A->>DB: status = "processing"
    A-->>U: 202 accepted (runs in background)

    A->>P: crop to ROI, run phase-based EVM
    P->>P: FFT + peakiness detection
    A->>DB: save_job_result()

    U->>A: GET /api/jobs/{id}/status
    A-->>U: "done"

    U->>A: GET /api/jobs/{id}/result
    A-->>U: frequency, flag, amplified video, intensity series
```

Processing runs as a **background task** (FastAPI's `BackgroundTasks`), not
inline in the request — this is important: our pipeline takes several
seconds even on small test clips, and blocking the whole server on one
request would make it unresponsive to everyone else while processing.

## Tech stack and rationale

| Layer | Technology | Why |
|---|---|---|
| Core algorithm | Python, NumPy, OpenCV, SciPy | Fast array math, image pyramids, trusted/well-tested signal filtering (Butterworth, FFT) |
| Backend API | FastAPI, Uvicorn | Async-friendly, auto-generates interactive API docs, minimal boilerplate |
| Storage | SQLite (`sqlite3`, no ORM) | Lightweight, zero-config, sufficient for a job/results table at this scale |
| Frontend | React *(in progress)* | Upload UI, ROI drawing, results dashboard |

## Project structure

```
motion-amp-sih/
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app — all API endpoints
│       ├── config.py            # frequency presets, alpha limits, folders
│       ├── db.py                # SQLite storage layer
│       ├── core/
│       │   ├── pyramid.py       # Laplacian pyramid (spatial decomposition)
│       │   ├── bandpass.py      # Butterworth temporal filter
│       │   ├── riesz.py         # Riesz transform pair
│       │   ├── phase.py         # phase/amplitude extraction
│       │   └── pipeline.py      # baseline + phase-based EVM, wired together
│       ├── io/
│       │   └── video_io.py      # video file <-> NumPy array
│       └── analytics/
│           └── vibration.py     # FFT vibration detection + peakiness test
├── test_clips/
│   └── generate_test_clips.py   # synthetic ground-truth test videos
├── docs/                        # this documentation
└── frontend/                    # React UI (in progress)
```
