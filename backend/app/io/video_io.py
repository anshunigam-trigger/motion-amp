import cv2
import numpy as np


def read_video_frames(path):
    """Read all frames from a video file into a float32 NumPy array.

    Raises ValueError for:
    - Files OpenCV cannot open
    - Videos with FPS == 0 (corrupted / unsupported codec)
    - Videos that yield zero readable frames

    Pre-allocates the output array from CAP_PROP_FRAME_COUNT to avoid
    the double-memory-copy that np.stack([list]) causes.
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video file: {path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        cap.release()
        raise ValueError(
            f"Invalid FPS ({fps}) reported by video '{path}'. "
            "Check codec and container — file may be corrupted."
        )

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Pre-allocate to avoid the double allocation from list → np.stack()
    if total > 0 and width > 0 and height > 0:
        frames = np.empty((total, height, width, 3), dtype=np.float32)
    else:
        frames = None  # fallback: dynamic append if metadata is unreliable

    idx = 0
    fallback_list = []

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frames is not None and idx < total:
            frames[idx] = frame
        else:
            fallback_list.append(frame)
        idx += 1

    cap.release()

    if idx == 0:
        raise ValueError(f"No frames could be read from: {path}")

    if frames is not None and not fallback_list:
        # Trim in case frame_count metadata was larger than actual frames
        return frames[:idx].astype(np.float32), fps
    else:
        # Fallback path: metadata was wrong, we collected into a list
        all_frames = (frames[:min(idx, total)].tolist() if frames is not None else []) + fallback_list
        return np.stack(all_frames).astype(np.float32), fps


def write_video(path, frames, fps):
    """Write a (T, H, W, 3) float32 frame array to an mp4 video file."""
    frames_u8 = np.clip(frames, 0, 255).astype(np.uint8)

    h, w = frames_u8.shape[1:3]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, fps, (w, h))
    for f in frames_u8:
        writer.write(f)
    writer.release()