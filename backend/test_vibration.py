import sys
sys.path.insert(0, '.')
sys.path.insert(0, '../test_clips')
import numpy as np
from generate_test_clips import vibrating_clip, build_frames_array, FPS
from app.analytics.vibration import compute_motion_signal, compute_fft_spectrum

roi = (135, 40, 10, 160)

for amp_px in [0.3, 3.0]:
    np.random.seed(0)
    frame_fn = vibrating_clip(freq_hz=15.0, amplitude_px=amp_px)
    frames_array = build_frames_array(frame_fn)

    sig = compute_motion_signal(frames_array, roi=roi)
    freqs, amp_spec = compute_fft_spectrum(sig, FPS)

    valid = freqs > 0.1
    top5_idx = np.argsort(amp_spec[valid])[::-1][:5]
    top5_freqs = freqs[valid][top5_idx]
    top5_amps = amp_spec[valid][top5_idx]

    print(f"\n--- amplitude={amp_px}px ---")
    print("top 5 strongest frequencies, FULL spectrum:")
    for f, a in zip(top5_freqs, top5_amps):
        print(f"   {f:6.2f} Hz   amplitude={a:.5f}")