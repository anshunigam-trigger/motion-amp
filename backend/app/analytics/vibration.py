"""
vibration.py

FFT-based vibration analytics (Step 5 of the build plan).

This version merges two independently-written approaches from the team:
  - Whole-region motion extraction, spectral windowing, and amplitude
    normalization (contributed by a teammate)
  - Frequency-band restriction and peak-vs-background comparison, with
    the peak's own neighborhood excluded from the background estimate
    (from earlier work in this file)

This is where we answer the real question the whole project is about:
"is there genuine periodic vibration here, and if so, at what frequency?"
-- not just "did the signal wiggle a lot," which we already proved (with
the camera_shake test clip) is NOT a reliable test on its own.
"""

from typing import Optional, Dict, Any, Tuple

import numpy as np
import cv2


def compute_motion_signal(
    frames: np.ndarray,
    roi: Optional[Tuple[int, int, int, int]] = None,
) -> np.ndarray:
    if frames.shape[0] < 2:
        raise ValueError("At least 2 frames are required for frame differencing.")

    if roi is not None:
        x, y, w, h = roi
        frames_cropped = frames[:, y:y + h, x:x + w]
    else:
        frames_cropped = frames

    # Convert to grayscale float32
    gray_frames = np.array([
        cv2.cvtColor(np.clip(f, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY)
        for f in frames_cropped
    ], dtype=np.float32)

    # Calculate pixel-wise variance over time to identify moving edges
    pixel_variance = np.var(gray_frames, axis=0)
    
    # Isolate the top 5% most active pixels (where motion is happening)
    # Using at least a 1.0 variance threshold to ignore purely static sensor noise
    threshold = max(1.0, np.percentile(pixel_variance, 95))
    mask = pixel_variance > threshold
    
    if not np.any(mask):
        # Absolutely no movement detected
        return np.zeros(len(gray_frames) - 1)
        
    # Extract the time-series of just the active pixels
    active_pixels = gray_frames[:, mask]  # Shape: (T, N_active)
    
    # Mean-center the data over time
    active_pixels -= np.mean(active_pixels, axis=0)
    
    # Use Singular Value Decomposition (PCA) to extract the dominant 1D motion component.
    # This beautifully preserves the sign of the motion (no frequency doubling!) and
    # dramatically suppresses uncorrelated noise.
    U, S, Vt = np.linalg.svd(active_pixels, full_matrices=False)
    
    # U[:, 0] is the principal temporal component (length T)
    # We return the difference (length T-1) to match the expected velocity format,
    # or just return U[:, 0] directly since it already represents position!
    # Wait, EVM phase is position. Let's just return the position signal directly.
    # It has length T. The previous method returned T-1.
    # Let's return U[:, 0]!
    
    signal = U[:, 0]
    return signal

def compute_fft_spectrum(signal: np.ndarray, fps: float) -> Tuple[np.ndarray, np.ndarray]:
    n = len(signal)
    if n == 0:
        raise ValueError("Cannot compute FFT of an empty signal.")

    detrended = signal - np.mean(signal)
    window = np.hanning(n)
    windowed = detrended * window

    freqs = np.fft.rfftfreq(n, d=1 / fps)
    fft_vals = np.fft.rfft(windowed)
    amplitude = np.abs(fft_vals) * (2.0 / n)

    return freqs, amplitude

def find_dominant_frequency(
    freqs: np.ndarray,
    amplitude: np.ndarray,
    low_hz: Optional[float] = None,
    high_hz: Optional[float] = None,
) -> Tuple[float, float]:
    mask = freqs > 0.1
    nyquist = freqs[-1] if len(freqs) > 0 else 0
    
    if low_hz is not None:
        clamped_low = min(low_hz, nyquist - 0.2)
        mask &= freqs >= clamped_low
    if high_hz is not None:
        clamped_high = min(high_hz, nyquist - 0.1)
        mask &= freqs <= clamped_high

    if not np.any(mask):
        raise ValueError(f"No frequency bins found in range [{low_hz}, {high_hz}] Hz.")

    band_freqs = freqs[mask]
    band_amplitude = amplitude[mask]

    peak_idx = np.argmax(band_amplitude)
    return float(band_freqs[peak_idx]), float(band_amplitude[peak_idx])

def spectral_peakiness(
    freqs: np.ndarray,
    amplitude: np.ndarray,
    peak_freq: float,
    exclude_bandwidth: float = 1.0,
    low_hz: Optional[float] = None,
    high_hz: Optional[float] = None,
) -> float:
    peak_idx = np.argmin(np.abs(freqs - peak_freq))
    peak_amplitude = amplitude[peak_idx]

    # Create a mask for valid background frequencies
    background_mask = np.abs(freqs - peak_freq) > exclude_bandwidth
    
    # Also exclude out-of-band frequencies (they often contain EVM transients)
    if low_hz is not None:
        background_mask &= freqs >= (low_hz - 0.5)
    else:
        background_mask &= freqs >= 0.5
        
    if high_hz is not None:
        background_mask &= freqs <= (high_hz + 0.5)

    background = amplitude[background_mask]

    if len(background) == 0:
        return 0.0

    background_mean = float(np.mean(background))
    background_std = float(np.std(background))

    return (peak_amplitude - background_mean) / (background_std + 1e-8)

def analyze_vibration(
    frames: np.ndarray,
    fps: float,
    roi: Optional[Tuple[int, int, int, int]] = None,
    low_hz: Optional[float] = None,
    high_hz: Optional[float] = None,
    peakiness_threshold: float = 3.0,
    min_amplitude: float = 0.01,
) -> Dict[str, Any]:
    signal = compute_motion_signal(frames, roi=roi)
    freqs, amplitude = compute_fft_spectrum(signal, fps)
    peak_freq, peak_amplitude = find_dominant_frequency(freqs, amplitude, low_hz, high_hz)
    peakiness = spectral_peakiness(freqs, amplitude, peak_freq, low_hz=low_hz, high_hz=high_hz)

    # A valid vibration must exceed the SNR threshold AND have a meaningful absolute amplitude
    detected = (peakiness >= peakiness_threshold) and (peak_amplitude >= min_amplitude)
    time_axis = [round(i / fps, 4) for i in range(len(signal))]

    return {
        "metrics": {
            "detected": bool(detected),
            "dominant_frequency_hz": round(peak_freq, 3),
            "peak_amplitude": round(peak_amplitude, 5),
            "peakiness": round(peakiness, 3),
            "nyquist_limit_hz": round(fps / 2.0, 2),
        },
        "time_series": {
            "time_sec": time_axis,
            "motion_intensity": [round(float(v), 5) for v in signal],
        },
        "frequency_spectrum": {
            "frequencies_hz": [round(float(f), 3) for f in freqs],
            "amplitudes": [round(float(a), 5) for a in amplitude],
        },
    }