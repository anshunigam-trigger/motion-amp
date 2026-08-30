import numpy as np
from scipy import signal

def temporal_bandpass_filter(data, fps, low_hz, high_hz, order=4):
    nyquist = fps / 2.0
    
    # Clamp frequencies to valid Nyquist ranges to prevent crashes
    low_hz = max(0.1, min(low_hz, nyquist - 0.2))
    high_hz = max(low_hz + 0.1, min(high_hz, nyquist - 0.1))

    low = low_hz / nyquist
    high = high_hz / nyquist
    sos = signal.butter(order, [low, high], btype="band", output="sos")
    return signal.sosfiltfilt(sos, data, axis=0)