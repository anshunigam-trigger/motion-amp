"""
generate_test_clips.py

Generates synthetic test videos for the motion-amplification pipeline.

WHY SYNTHETIC DATA:
Real vibration is invisible to the eye by definition. So instead of
filming something, we DRAW an edge (a vertical bar) and shift it by a
known sub-pixel amount every frame, following a sine wave at a known
frequency. Because we control the ground truth, we can check whether our
algorithm actually recovers it.

UPGRADE -- lossless output:
We discovered that saving clips through a lossy .mp4 codec can introduce
its own periodic compression artifacts (tied to the codec's keyframe
interval), strong enough to bury our real, tiny sub-pixel signal. So each
clip is now saved TWICE, from the exact same underlying frame data:
  - a normal .mp4 (lossy, realistic -- what real footage looks like)
  - a .npy file (lossless, exact -- for validating the algorithm itself
    without compression artifacts interfering)
"""

import cv2
import numpy as np
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
WIDTH, HEIGHT = 320, 240
FPS = 60
DURATION_SEC = 4
N_FRAMES = FPS * DURATION_SEC


def make_base_frame():
    frame = np.full((HEIGHT, WIDTH, 3), 180, dtype=np.uint8)
    cv2.rectangle(frame, (140, 40), (180, 200), (60, 60, 60), thickness=-1)
    return frame


def shift_image_subpixel(img, dx):
    M = np.float32([[1, 0, dx], [0, 1, 0]])
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]),
                           flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def build_frames_array(frame_fn):
    frames = [frame_fn(i) for i in range(N_FRAMES)]
    return np.stack(frames).astype(np.float32)


def write_video(path, frames_array):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, FPS, (WIDTH, HEIGHT))
    for f in frames_array:
        writer.write(np.clip(f, 0, 255).astype(np.uint8))
    writer.release()
    print(f"wrote {path}  (lossy .mp4, {N_FRAMES} frames @ {FPS}fps)")


def write_lossless(path, frames_array):
    np.save(path, frames_array)
    print(f"wrote {path}  (lossless .npy)")


def vibrating_clip(freq_hz=15.0, amplitude_px=0.3, noise_std=1.5):
    base = make_base_frame()
    def frame_fn(i):
        t = i / FPS
        dx = amplitude_px * np.sin(2 * np.pi * freq_hz * t)
        shifted = shift_image_subpixel(base, dx)
        noise = np.random.normal(0, noise_std, shifted.shape).astype(np.float32)
        noisy = np.clip(shifted.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return noisy
    return frame_fn


def static_clip(noise_std=1.5):
    base = make_base_frame()
    def frame_fn(i):
        noise = np.random.normal(0, noise_std, base.shape).astype(np.float32)
        noisy = np.clip(base.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return noisy
    return frame_fn


def camera_shake_clip(shake_px=2.0, noise_std=1.5):
    base = make_base_frame()
    rng = np.random.default_rng(42)
    def frame_fn(i):
        dx = rng.normal(0, shake_px)
        shifted = shift_image_subpixel(base, dx)
        noise = np.random.normal(0, noise_std, shifted.shape).astype(np.float32)
        noisy = np.clip(shifted.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return noisy
    return frame_fn


if __name__ == "__main__":
    np.random.seed(0)

    clips = {
        "vibrating_panel": vibrating_clip(),
        "static_panel": static_clip(),
        "camera_shake": camera_shake_clip(),
    }

    for name, frame_fn in clips.items():
        frames_array = build_frames_array(frame_fn)
        write_video(os.path.join(OUT_DIR, f"{name}.mp4"), frames_array)
        write_lossless(os.path.join(OUT_DIR, f"{name}_lossless.npy"), frames_array)