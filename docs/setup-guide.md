# Setup Guide

## Requirements

- Python 3.10+ (developed/tested on 3.12)
- pip

## 1. Clone and enter the project

```bash
cd motion-amp-sih/backend
```

## 2. Create a virtual environment

A virtual environment keeps this project's dependencies isolated from
other Python projects on your machine.

**Windows (Command Prompt):**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You'll know it worked when your terminal prompt shows `(venv)` at the
start. You'll need to re-run the activate command each time you open a new
terminal session — it doesn't stay on permanently.

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

If a specific package version fails to install (can happen depending on
your Python version/OS), note the exact error — version pins may need
minor adjustment for your environment.

## 4. Generate synthetic test data

```bash
cd ../test_clips
python generate_test_clips.py
```

You should see six lines of output confirming three `.mp4` and three
`_lossless.npy` files were written. See
[`../testing/testing-guide.md`](../testing/testing-guide.md) for what each
represents.

## 5. Start the backend server

```bash
cd ../backend
uvicorn app.main:app --reload
```

**Important:** wherever you run this command *from* is where `uploads/`,
`results/`, and `jobs.db` will be created (these use relative paths). Run
it from inside `backend/`, not elsewhere, or you may not find these
folders where you expect.

`--reload` automatically restarts the server when you edit code — useful
during development, not something you'd typically want in production.

You should see output ending with:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

## 6. Verify it's running

Visit `http://127.0.0.1:8000/` in a browser — you should see:
```json
{"status": "backend is running"}
```

Visit `http://127.0.0.1:8000/docs` for FastAPI's auto-generated interactive
API documentation — lets you try every endpoint directly from the browser.

## 7. Try the full workflow

See [`../api/api-reference.md`](../api/api-reference.md) for the complete
endpoint reference, or [`../testing/testing-guide.md`](../testing/testing-guide.md)
for ready-to-run test commands using the synthetic clips generated above.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ModuleNotFoundError` when running scripts | Virtual environment not activated, or dependencies not installed |
| `FileNotFoundError` for a `.npy` or `.mp4` test clip | `generate_test_clips.py` hasn't been run yet, or you're running a script from the wrong folder |
| Server starts but `uploads`/`results`/`jobs.db` appear in an unexpected location | Server was started from a different working directory than expected — these use relative paths |
| Job stuck on `"processing"` forever | Check the server's terminal output for a printed error — the processing function catches exceptions and marks the job `"failed"`, but only after an error occurs; a truly stuck job suggests something is hanging rather than failing |
