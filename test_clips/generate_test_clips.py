"""
generate_test_clips.py

Generates synthetic test videos for the motion-amplification pipeline.

WHY SYNTHETIC DATA:
Real vibration is invisible to the eye by definition -- that's the whole
premise of the project. So instead of filming something, we DRAW an edge
(a vertical bar) and shift it by a known sub-pixel amount every frame,
following a sine wave at a known frequency. Because we control the ground
truth (exact frequency, exact amplitude), we can later check: did our FFT
correctly recover that frequency? Did the "no vibration" clip correctly
NOT trigger a detection? This is the same idea as a calibration signal
used to test real sensors.

Clips produced:
  1. vibrating_panel.mp4   -- a bar vibrating at 15 Hz, amplitude 0.3 px  (should be DETECTED)
  2. static_panel.mp4      -- identical scene, zero motion               (should be NOT detected)
  3. camera_shake.mp4      -- whole frame shakes randomly (not periodic) (should be NOT detected
                                                                            as periodic vibration)
"""

import cv2
import numpy as np
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
WIDTH, HEIGHT = 320, 240
FPS = 60          # needs to be high enough to sample a 15 Hz signal well above Nyquist
DURATION_SEC = 4
N_FRAMES = FPS * DURATION_SEC


def make_base_frame():
    """A simple static scene: a gray background with a vertical dark bar
    (stand-in for 'edge of an engine housing / panel')."""
    frame = np.full((HEIGHT, WIDTH, 3), 180, dtype=np.uint8)  # light gray background
    cv2.rectangle(frame, (140, 40), (180, 200), (60, 60, 60), thickness=-1)  # dark bar
    return frame


def shift_image_subpixel(img, dx):
    """
    Shift an image horizontally by a SUB-PIXEL amount using a translation
    matrix + bilinear interpolation (cv2.warpAffine). This is how we fake
    sub-pixel motion: dx can be 0.3, not just whole pixels.
    """
    M = np.float32([[1, 0, dx], [0, 1, 0]])
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]),
                           flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def write_video(path, frame_fn):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, FPS, (WIDTH, HEIGHT))
    for i in range(N_FRAMES):
        writer.write(frame_fn(i))
    writer.release()
    print(f"wrote {path}  ({N_FRAMES} frames @ {FPS}fps = {DURATION_SEC}s)")


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
        # random (non-periodic) whole-frame jitter -- this should NOT be
        # flagged as "periodic vibration" once we band-pass filter for it
        dx = rng.normal(0, shake_px)
        shifted = shift_image_subpixel(base, dx)
        noise = np.random.normal(0, noise_std, shifted.shape).astype(np.float32)
        noisy = np.clip(shifted.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return noisy

    return frame_fn


if __name__ == "__main__":
    np.random.seed(0)
    write_video(os.path.join(OUT_DIR, "vibrating_panel.mp4"), vibrating_clip())
    write_video(os.path.join(OUT_DIR, "static_panel.mp4"), static_clip())
    write_video(os.path.join(OUT_DIR, "camera_shake.mp4"), camera_shake_clip())
