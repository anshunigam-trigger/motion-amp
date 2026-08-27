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

# Limit for uploaded clips
MAX_CLIP_SECONDS = 20

