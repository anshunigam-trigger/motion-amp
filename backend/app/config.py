# Frequency ranges used by the motion analysis pipeline
FREQ_PRESETS = {
    "engine": {
        "low_hz": 8.0,
        "high_hz": 40.0,
    },
    "structural": {
        "low_hz": 1.0,
        "high_hz": 6.0,
    },
    # Custom range will be provided by the user
    "custom": None,
}


# Amplification settings
DEFAULT_ALPHA = 10.0
MAX_ALPHA = 50.0


# Folders used to store uploaded and processed videos
UPLOAD_DIR = "uploads"
RESULTS_DIR = "results"


# Allowed video formats for upload
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi"}

# Maximum duration (seconds) for uploaded clips — enforced after reading
MAX_CLIP_SECONDS = 20

# Maximum raw upload size in bytes — enforced during streaming write (500 MB)
MAX_UPLOAD_BYTES = 500 * 1024 * 1024
