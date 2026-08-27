import sys
sys.path.insert(0, '.')
sys.path.insert(0, '../test_clips')
import numpy as np
from generate_test_clips import vibrating_clip, static_clip, FPS, N_FRAMES
from app.analytics.vibration import compute_motion_signal, compute_fft_spectrum

np.random.seed(0)

def build_raw_frames(frame_fn):
    return np.stack([frame_fn(i) for i in range(N_FRAMES)]).astype(np.float32)

for name, frame_fn in [('vibrating_panel', vibrating_clip()), ('static_panel', static_clip())]:
    raw_frames = build_raw_frames(frame_fn)
    sig = compute_motion_signal(raw_frames, roi=None)
    freqs, amp = compute_fft_spectrum(sig, FPS)
    valid = freqs > 0.1
    peak_freq = freqs[valid][np.argmax(amp[valid])]
    print(f"{name}: RAW frames (no mp4 round-trip) -> true peak = {peak_freq:.3f} Hz")