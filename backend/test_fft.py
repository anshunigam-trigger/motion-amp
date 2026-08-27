import sys
sys.path.insert(0, '.')
import numpy as np
from app.io.video_io import read_video_frames
from app.analytics.vibration import compute_fft_spectrum

frames, fps = read_video_frames('../test_clips/vibrating_panel.mp4')
signal = frames[:, 120, 140, 0]  # the same edge pixel we've used throughout

freqs, magnitude = compute_fft_spectrum(signal, fps)

nonzero = freqs > 0.5
peak_idx = np.argmax(magnitude[nonzero])
peak_freq = freqs[nonzero][peak_idx]
peak_mag = magnitude[nonzero][peak_idx]

print(f'signal length: {len(signal)} samples at {fps} fps')
print(f'frequency resolution: {freqs[1]:.3f} Hz per bin')
print(f'peak found at: {peak_freq:.2f} Hz  (magnitude={peak_mag:.1f})')
print(f'ground truth was: 15.00 Hz')