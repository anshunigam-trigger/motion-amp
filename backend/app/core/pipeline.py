import numpy as np
import cv2
from .pyramid import build_laplacian_pyramid, collapse_laplacian_pyramid
from .bandpass import temporal_bandpass_filter
from .riesz import compute_riesz_pair
from .phase import reference_orientation, compute_phase_signal

def run_baseline_evm(frames, fps, low_hz, high_hz, alpha, levels=4, amplify_levels=None):
    T = frames.shape[0]
    if amplify_levels is None:
        amplify_levels = list(range(1, levels))

    pyramids_per_frame = [build_laplacian_pyramid(frames[t], levels) for t in range(T)]
    n_levels = levels + 1

    level_stacks = [
        np.stack([pyramids_per_frame[t][lvl] for t in range(T)], axis=0)
        for lvl in range(n_levels)
    ]

    for lvl in amplify_levels:
        filtered = temporal_bandpass_filter(level_stacks[lvl], fps, low_hz, high_hz)
        level_stacks[lvl] = level_stacks[lvl] + alpha * filtered

    out_frames = np.empty_like(frames)
    for t in range(T):
        levels_t = [level_stacks[lvl][t] for lvl in range(n_levels)]
        out_frames[t] = collapse_laplacian_pyramid(levels_t)

    return out_frames

def _bgr_to_ycrcb(frames):
    return np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2YCrCb) for f in frames])

def _ycrcb_to_bgr(frames):
    return np.stack([cv2.cvtColor(f, cv2.COLOR_YCrCb2BGR) for f in frames])

def run_phase_based_evm(frames, fps, low_hz, high_hz, alpha, levels=4, amplify_levels=None):
    T = frames.shape[0]
    if amplify_levels is None:
        amplify_levels = list(range(1, levels))

    ycrcb = _bgr_to_ycrcb(frames)
    y_channel = ycrcb[..., 0]

    pyramids_per_frame = [build_laplacian_pyramid(y_channel[t], levels) for t in range(T)]
    n_levels = levels + 1
    level_stacks = [
        np.stack([pyramids_per_frame[t][lvl] for t in range(T)], axis=0)
        for lvl in range(n_levels)
    ]

    for lvl in amplify_levels:
        i_stack = level_stacks[lvl]

        r1_frames, r2_frames = [], []
        for t in range(T):
            r1, r2 = compute_riesz_pair(i_stack[t])
            r1_frames.append(r1)
            r2_frames.append(r2)
        r1_stack = np.stack(r1_frames, axis=0)
        r2_stack = np.stack(r2_frames, axis=0)

        theta = reference_orientation(r1_stack, r2_stack)
        phase, amplitude = compute_phase_signal(i_stack, r1_stack, r2_stack, theta)

        filtered_phase = temporal_bandpass_filter(phase, fps, low_hz, high_hz)
        amplified_phase = phase + alpha * filtered_phase

        level_stacks[lvl] = amplitude * np.cos(amplified_phase)

    out_y = np.empty_like(y_channel)
    for t in range(T):
        levels_t = [level_stacks[lvl][t] for lvl in range(n_levels)]
        out_y[t] = collapse_laplacian_pyramid(levels_t)

    out_ycrcb = ycrcb.copy()
    out_ycrcb[..., 0] = out_y
    return _ycrcb_to_bgr(out_ycrcb)