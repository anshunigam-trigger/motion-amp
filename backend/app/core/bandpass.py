import numpy as np
from scipy import signal


def temporal_bandpass_filter(data, fps, low_hz, high_hz, order=4):
    """Apply a zero-phase Butterworth bandpass filter along the time axis (axis=0).

    Frequencies are clamped to the valid Nyquist range to prevent
    scipy ValueError crashes on edge-case inputs.  Any clamping is
    recorded in the returned ``warnings`` dict so callers can surface
    it to the user rather than silently using different settings.

    Returns:
        filtered_data (np.ndarray): same shape as ``data``
        warnings (dict): empty if no clamping occurred, otherwise
            contains 'low_hz_clamped' and/or 'high_hz_clamped' keys
            with the original and actual values used.
    """
    nyquist = fps / 2.0
    warnings = {}

    clamped_low = max(0.1, min(low_hz, nyquist - 0.2))
    if clamped_low != low_hz:
        warnings["low_hz_clamped"] = {"requested": low_hz, "used": clamped_low}

    clamped_high = max(clamped_low + 0.1, min(high_hz, nyquist - 0.1))
    if clamped_high != high_hz:
        warnings["high_hz_clamped"] = {"requested": high_hz, "used": clamped_high}

    low = clamped_low / nyquist
    high = clamped_high / nyquist
    sos = signal.butter(order, [low, high], btype="band", output="sos")
    
    # Calculate safe padlen to prevent ValueError on short videos
    # default padlen is 9 * len(sos), but input must be > padlen
    max_padlen = 9 * sos.shape[0]
    safe_padlen = min(data.shape[0] - 1, max_padlen)
    if safe_padlen < 0:
        safe_padlen = 0
        
    filtered = signal.sosfiltfilt(sos, data, axis=0, padlen=safe_padlen)
    return filtered, warnings