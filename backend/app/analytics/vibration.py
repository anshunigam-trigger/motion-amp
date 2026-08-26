import numpy as np
import cv2
from typing import Optional, Dict, Any, Tuple

def compute_motion_signal(
    frames: np.ndarray, 
    roi: Optional[Tuple[int, int, int, int]] = None
) -> np.ndarray:

    if frames.shape[0] < 2:
        raise ValueError("At least 2 frames are required for frame differencing.")
    if roi is not None:
        x, y, w, h = roi
        frames_cropped = frames[:, y : y + h, x : x + w]
    else:
        frames_cropped = frames

    if frames_cropped.ndim == 4:
        gray_frames = np.array([
            cv2.cvtColor(
                (f if f.dtype == np.uint8 else np.clip(f, 0, 255).astype(np.uint8)), 
                cv2.COLOR_BGR2GRAY
            )
            for f in frames_cropped
        ], dtype=np.float32)
    else:
        gray_frames = frames_cropped.astype(np.float32)
    diffs = np.abs(np.diff(gray_frames, axis=0))
    return np.mean(diffs, axis=(1, 2))

def compute_vibration_fft(
    motion_signal: np.ndarray, 
    fps: float, 
    alert_threshold_factor: float = 3.0
) -> Dict[str, Any]:

    N = len(motion_signal)
    if N == 0:
        return {"error": "Empty motion signal"}
      
    detrended = motion_signal - np.mean(motion_signal)

    window = np.hanning(N)
    windowed_signal = detrended * window
    fft_vals = np.fft.rfft(windowed_signal)
    freq_bins = np.fft.rfftfreq(N, d=1.0 / fps)
  
    amplitude_spectrum = np.abs(fft_vals) * (2.0 / N)
    valid_idx = np.where(freq_bins > 0.1)[0]
    if len(valid_idx) > 0:
        peak_idx = valid_idx[np.argmax(amplitude_spectrum[valid_idx])]
        dominant_freq = float(freq_bins[peak_idx])
        peak_amplitude = float(amplitude_spectrum[peak_idx])
    else:
        dominant_freq = 0.0
        peak_amplitude = 0.0
    baseline_noise = float(np.mean(amplitude_spectrum))
    noise_std = float(np.std(amplitude_spectrum))
    threshold = baseline_noise + (alert_threshold_factor * noise_std)
    alert_flag = bool(peak_amplitude > threshold and peak_amplitude > 1e-4)

    time_axis = [round(i / fps, 4) for i in range(N)]

    return {
        "metrics": {
            "dominant_frequency_hz": round(dominant_freq, 3),
            "peak_amplitude": round(peak_amplitude, 5),
            "alert_flag": alert_flag,
            "nyquist_limit_hz": round(fps / 2.0, 2),
        },
        "time_series": {
            "time_sec": time_axis,
            "motion_intensity": [round(float(v), 5) for v in motion_signal],
        },
        "frequency_spectrum": {
            "frequencies_hz": [round(float(f), 3) for f in freq_bins],
            "amplitudes": [round(float(a), 5) for a in amplitude_spectrum],
        }
    }

def analyze_vibration(
    frames: np.ndarray, 
    fps: float, 
    roi: Optional[Tuple[int, int, int, int]] = None
) -> Dict[str, Any]:

    signal = compute_motion_signal(frames, roi=roi)
    return compute_vibration_fft(signal, fps=fps)
