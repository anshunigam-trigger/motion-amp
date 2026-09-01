"""
vibration.py

FFT-based vibration analytics using Lucas-Kanade Optical Flow.
Performs sub-pixel feature tracking and global camera motion compensation.
"""

from typing import Optional, Dict, Any, Tuple, List
import numpy as np
import cv2

def compute_fft_spectrum(signal: np.ndarray, fps: float) -> Tuple[np.ndarray, np.ndarray]:
    n = len(signal)
    if n == 0:
        raise ValueError("Cannot compute FFT of an empty signal.")

    detrended = signal - np.mean(signal)
    # Apply a Hanning window to reduce spectral leakage
    window = np.hanning(n)
    windowed = detrended * window

    freqs = np.fft.rfftfreq(n, d=1 / fps)
    # Normalize amplitude so it represents the true physical amplitude (peak)
    fft_vals = np.fft.rfft(windowed)
    amplitude = np.abs(fft_vals) * (2.0 / n)

    return freqs, amplitude

def find_dominant_frequency(
    freqs: np.ndarray,
    amplitude: np.ndarray,
    low_hz: Optional[float] = None,
    high_hz: Optional[float] = None,
) -> Tuple[float, float, int]:
    """Finds the strongest frequency and its amplitude in the specified band."""
    # Exclude DC component and very low frequency drift
    mask = freqs > 0.5
    nyquist = freqs[-1] if len(freqs) > 0 else 0
    
    if low_hz is not None:
        clamped_low = min(low_hz, nyquist - 0.2)
        mask &= freqs >= clamped_low
    if high_hz is not None:
        clamped_high = min(high_hz, nyquist - 0.1)
        mask &= freqs <= clamped_high

    if not np.any(mask):
        return 0.0, 0.0, -1

    # Apply mask
    band_freqs = freqs[mask]
    band_amplitude = amplitude[mask]

    if len(band_amplitude) == 0:
        return 0.0, 0.0, -1

    local_peak_idx = np.argmax(band_amplitude)
    # Find the original index in the full freqs array
    global_peak_idx = np.where(freqs == band_freqs[local_peak_idx])[0][0]

    return float(band_freqs[local_peak_idx]), float(band_amplitude[local_peak_idx]), global_peak_idx

def spectral_peakiness(
    freqs: np.ndarray,
    amplitude: np.ndarray,
    peak_freq: float,
    exclude_bandwidth: float = 1.0,
    low_hz: Optional[float] = None,
    high_hz: Optional[float] = None,
) -> float:
    """Computes SNR of the peak against the background noise floor."""
    if peak_freq == 0.0:
        return 0.0

    # Mask for background frequencies (excluding the peak and its immediate neighbors)
    background_mask = np.abs(freqs - peak_freq) > exclude_bandwidth
    
    # Exclude very low frequencies from the background noise estimate
    background_mask &= freqs >= 0.5
    
    if low_hz is not None:
        background_mask &= freqs >= (low_hz - 0.5)
    if high_hz is not None:
        background_mask &= freqs <= (high_hz + 0.5)

    background = amplitude[background_mask]

    if len(background) == 0:
        return 0.0

    background_mean = float(np.mean(background))
    background_std = float(np.std(background))

    peak_amplitude = amplitude[np.argmin(np.abs(freqs - peak_freq))]
    
    return (peak_amplitude - background_mean) / (background_std + 1e-8)


def extract_trajectories_lk(frames: np.ndarray, mask: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Extracts trajectories of good features using Lucas-Kanade optical flow.
    Returns array of shape (T, N, 2) where T is frames, N is features, 2 is (x, y).
    """
    if frames.shape[0] < 2:
        return np.zeros((frames.shape[0], 0, 2))

    # Convert to grayscale
    gray_frames = [cv2.cvtColor(np.clip(f, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY) for f in frames]
    
    # Find good features to track in the first frame
    p0 = cv2.goodFeaturesToTrack(
        gray_frames[0], 
        maxCorners=200, 
        qualityLevel=0.01, 
        minDistance=5, 
        blockSize=5, 
        mask=mask
    )
    
    if p0 is None:
        return np.zeros((len(gray_frames), 0, 2))

    # Track features across all frames
    trajectories = [p0.reshape(-1, 2)]
    
    p_prev = p0
    valid_features_mask = np.ones(len(p0), dtype=bool)

    lk_params = dict(winSize=(15, 15), maxLevel=2,
                     criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03))

    for i in range(1, len(gray_frames)):
        p_next, st, err = cv2.calcOpticalFlowPyrLK(gray_frames[i-1], gray_frames[i], p_prev, None, **lk_params)
        
        # Update valid features mask (if tracking failed for a point, mark it invalid forever)
        st = st.flatten()
        valid_features_mask = valid_features_mask & (st == 1)
        
        trajectories.append(p_next.reshape(-1, 2))
        p_prev = p_next

    # Stack into (T, N, 2)
    trajectories = np.stack(trajectories, axis=0)
    
    # Keep only features that survived the entire video
    return trajectories[:, valid_features_mask, :]


def analyze_vibration(
    frames: np.ndarray,
    fps: float,
    roi: Optional[Tuple[int, int, int, int]] = None,
    low_hz: Optional[float] = None,
    high_hz: Optional[float] = None,
) -> Dict[str, Any]:
    """
    End-to-end vibration analysis with global motion compensation and feature tracking.
    """
    T, H, W, _ = frames.shape
    
    # 1. Guard check: Video duration / frequency resolution
    duration = T / fps
    min_duration = 1.0  # Require at least 1 second of video
    if duration < min_duration:
        return {
            "metrics": {"detected": False, "dominant_frequency_hz": 0.0, "peak_amplitude": 0.0, "peakiness": 0.0, "nyquist_limit_hz": fps/2.0, "confidence": 0.0},
            "time_series": {"time_sec": [], "motion_intensity": []},
            "frequency_spectrum": {"frequencies_hz": [], "amplitudes": []},
            "error": "Insufficient video duration for reliable frequency estimation. Need at least 1 second."
        }

    # 2. Setup masks for Global (background) vs Local (ROI) tracking
    if roi is not None:
        rx, ry, rw, rh = roi
        roi_mask = np.zeros((H, W), dtype=np.uint8)
        roi_mask[ry:ry+rh, rx:rx+rw] = 255
        
        bg_mask = np.ones((H, W), dtype=np.uint8) * 255
        bg_mask[ry:ry+rh, rx:rx+rw] = 0
    else:
        roi_mask = np.ones((H, W), dtype=np.uint8) * 255
        bg_mask = None # No background separation possible

    # 3. Track features
    roi_trajectories = extract_trajectories_lk(frames, mask=roi_mask) # Shape: (T, N_roi, 2)
    
    if bg_mask is not None:
        bg_trajectories = extract_trajectories_lk(frames, mask=bg_mask) # Shape: (T, N_bg, 2)
    else:
        bg_trajectories = np.zeros((T, 0, 2))

    # 4. Global Motion Compensation
    if bg_trajectories.shape[1] > 0:
        # Calculate median displacement frame-to-frame for background features
        bg_displacement = bg_trajectories - bg_trajectories[0:1, :, :] # Displacement from start
        global_motion = np.median(bg_displacement, axis=1) # Shape: (T, 2)
    elif roi_trajectories.shape[1] > 0 and bg_mask is None:
        # If no background was separated (i.e. no ROI was drawn), assume the median motion of the whole frame is the camera motion
        # (Useful when no ROI is specified and the whole frame shakes)
        roi_displacement = roi_trajectories - roi_trajectories[0:1, :, :]
        global_motion = np.median(roi_displacement, axis=1)
    else:
        global_motion = np.zeros((T, 2))

    if roi_trajectories.shape[1] == 0:
        return {
            "metrics": {"detected": False, "dominant_frequency_hz": 0.0, "peak_amplitude": 0.0, "peakiness": 0.0, "nyquist_limit_hz": fps/2.0, "confidence": 0.0},
            "time_series": {"time_sec": [], "motion_intensity": []},
            "frequency_spectrum": {"frequencies_hz": [], "amplitudes": []},
            "error": "No trackable features found in the selected ROI."
        }

    # Compensate ROI trajectories
    compensated_roi_traj = roi_trajectories - global_motion[:, np.newaxis, :] # Shape: (T, N_roi, 2)
    
    # 5. Extract 1D signal for each feature
    # We will use PCA (SVD) on each feature's 2D trajectory to find its primary axis of motion.
    # Alternatively, since we just want the strongest periodic signal, we can analyze X and Y separately.
    best_snr = -1.0
    best_signal = None
    best_freqs = None
    best_amp_spec = None
    best_peak_freq = 0.0
    best_peak_amp = 0.0
    
    N_roi = compensated_roi_traj.shape[1]
    
    for i in range(N_roi):
        traj_x = compensated_roi_traj[:, i, 0]
        traj_y = compensated_roi_traj[:, i, 1]
        
        # Mean center
        traj_x -= np.mean(traj_x)
        traj_y -= np.mean(traj_y)
        
        # Analyze the signal that has the most variance, or use PCA
        coords = np.vstack((traj_x, traj_y)).T
        try:
            U, S, Vt = np.linalg.svd(coords, full_matrices=False)
            signal1d = U[:, 0] * S[0] # Scale back to pixel magnitude
        except:
            signal1d = traj_x # Fallback
            
        freqs, amplitude = compute_fft_spectrum(signal1d, fps)
        peak_freq, peak_amplitude, _ = find_dominant_frequency(freqs, amplitude, low_hz, high_hz)
        
        snr = spectral_peakiness(freqs, amplitude, peak_freq, low_hz=low_hz, high_hz=high_hz)
        
        if snr > best_snr:
            best_snr = snr
            best_signal = signal1d
            best_freqs = freqs
            best_amp_spec = amplitude
            best_peak_freq = peak_freq
            best_peak_amp = peak_amplitude

    # 6. Evaluate Confidence and Thresholds
    # A true vibration should have a strong SNR.
    # Typical SNR for pure sine wave is 10+, camera shake is usually < 2.
    snr_threshold = 3.0
    min_amplitude = 0.005 # Pixels (detectable sub-pixel vibration limit)
    
    detected = (best_snr >= snr_threshold) and (best_peak_amp >= min_amplitude)
    
    # Calculate a 0-100% confidence score
    # We map SNR=3 to ~50%, SNR=10 to ~95%
    if best_snr <= 0:
        confidence = 0.0
    else:
        confidence = min(100.0, max(0.0, (1.0 - 1.0 / (1.0 + 0.3 * (best_snr - 1.5))) * 100))

    if not detected:
        confidence = min(confidence, 49.0) # Cap confidence if threshold not met

    time_axis = [round(i / fps, 4) for i in range(T)]

    # Compute Camera Shake & Extra Metrics for the Detailed Report
    camera_shake_px = float(np.max(np.linalg.norm(global_motion, axis=1))) if T > 0 else 0.0
    total_energy = float(np.sum(best_amp_spec**2)) if best_amp_spec is not None else 0.0
    
    roi_dict = {"x": roi[0], "y": roi[1], "w": roi[2], "h": roi[3]} if roi else {"x": 0, "y": 0, "w": W, "h": H}

    detailed_report = {
        "resolution": f"{W}x{H}",
        "total_frames": T,
        "fps": round(fps, 2),
        "duration_sec": round(T / fps, 2),
        "roi_bounds": roi_dict,
        "camera_shake_px": round(camera_shake_px, 4),
        "signal_energy": round(total_energy, 4),
        "snr": round(best_snr, 3) if best_snr > 0 else 0.0,
        "high_shake_warning": camera_shake_px > 2.0
    }

    return {
        "metrics": {
            "detected": bool(detected),
            "dominant_frequency_hz": round(best_peak_freq, 3),
            "peak_amplitude": round(best_peak_amp, 5),
            "peakiness": round(best_snr, 3),
            "nyquist_limit_hz": round(fps / 2.0, 2),
            "confidence": round(confidence, 1)
        },
        "time_series": {
            "time_sec": time_axis,
            "motion_intensity": [round(float(v), 5) for v in best_signal] if best_signal is not None else [],
        },
        "frequency_spectrum": {
            "frequencies_hz": [round(float(f), 3) for f in best_freqs] if best_freqs is not None else [],
            "amplitudes": [round(float(a), 5) for a in best_amp_spec] if best_amp_spec is not None else [],
        },
        "detailed_report": detailed_report
    }