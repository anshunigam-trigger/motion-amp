# Motion Amplification & Vibration Analysis

This is the core algorithm this whole project is built around: making
sub-pixel motion visible, then statistically verifying it's real. This
document covers both halves — amplification (`core/`) and detection
(`analytics/vibration.py`) — and the real bugs found while validating each.

---

## Part 1 — Motion Amplification

### The core idea: Eulerian video magnification

Rather than tracking moving objects across frames (Lagrangian, e.g. optical
flow — struggles with sub-pixel motion), we watch **fixed pixel locations
over time** (Eulerian). This turns "detect motion" into "analyze a
time-series signal at every pixel" — letting us reuse well-established
signal-processing tools (filtering, FFT) instead of object tracking.

### Pipeline stages

1. **Laplacian pyramid** (`pyramid.py`) — each frame is decomposed into
   layers of detail, fine to coarse, by repeated Gaussian blur+downsample,
   storing the difference between consecutive levels. This is a spatial
   band-pass: different levels capture different spatial scales of motion.
   Verified lossless: build → collapse reproduces the original frame with
   **0.0 reconstruction error**.

2. **Riesz transform** (`riesz.py`) — approximates a quadrature pair
   `(R1, R2)` for each pyramid level using two small derivative kernels
   (Wadhwa et al., 2014's fast approximation). This pair is what lets us
   compute a genuine phase angle per pixel, instead of just a raw intensity
   value.

3. **Phase extraction** (`phase.py`) — combines the original subband value
   with the Riesz pair, projected onto a fixed per-pixel reference
   orientation (averaged across the clip, since scene structure doesn't
   rotate — only phase shifts with real motion). Produces an unwrapped
   phase signal (`np.unwrap`) — critical, since raw `atan2` output can jump
   by ±2π at wrap boundaries, which would otherwise be misread as violent
   fake motion by the next stage.

4. **Temporal band-pass filter** (`bandpass.py`) — a zero-phase Butterworth
   filter (`scipy.signal.sosfiltfilt`) applied along the time axis, keeping
   only the target frequency band. Zero-phase (forward+backward filtering)
   matters because a normal single-pass filter delays the signal slightly,
   which would misalign it when added back to the original.

5. **Amplification + reconstruction** (`pipeline.py`) — the filtered phase
   is scaled by `alpha` and added back to the original phase; the subband
   is reconstructed as `amplitude * cos(amplified_phase)` (amplitude is
   left untouched — only *position*, not *contrast*, is exaggerated). All
   levels are then collapsed back into a full amplified frame.

Two pipeline variants exist in `pipeline.py`:
- `run_baseline_evm` — amplifies raw pixel intensity directly (simpler,
  built first to validate the pyramid/filter machinery)
- `run_phase_based_evm` — the real algorithm described above, operating on
  the luminance (Y) channel only, with color (Cr/Cb) reattached at the end

### Amplification limits — found through real testing, not derived

Both algorithms break if pushed too far, in **different ways**:

| Algorithm | Failure mode | Observed threshold |
|---|---|---|
| Baseline | Pixel clipping — values flatline at 0/255 | Visible starting ~alpha=6, clean at alpha=4 |
| Phase-based | Phase-wrapping distortion — extra fake oscillations appear as the phase argument folds past a full cycle | Visible at alpha=20, clean at alpha=5–10 |

These are empirical findings from plotting actual pixel/phase values across
alpha sweeps — not a formula. A safety margin should be applied when
choosing `MAX_ALPHA` in production.

---

## Part 2 — Vibration Detection (`analytics/vibration.py`)

### Why amplitude and frequency alone are both insufficient

Two findings from testing, each demonstrated with synthetic ground-truth
clips:

- **Amplitude alone isn't proof of real vibration.** Random camera shake
  (broadband noise) produced a *larger* amplified signal than a real,
  small, genuine vibration — because random energy is spread across all
  frequencies, and some always lands inside the target band.
- **Frequency alone isn't proof either.** In end-to-end API testing, both
  a truly static clip and a real 15Hz-vibrating clip reported almost the
  *identical* dominant frequency (~15Hz) — because a narrow band-pass
  filter, fed pure noise, tends to produce oscillation somewhere inside its
  own passband regardless of real content.

**Conclusion: detection must be based on the statistical *shape* of the
peak (how sharp/concentrated it is), not just its location or size.**

### The detection pipeline

1. **`compute_motion_signal(frames, roi)`** — converts a region of a video
   into one number per frame-pair via grayscale frame-differencing,
   averaged over the region. Whole-region averaging is more robust than
   tracking a single pixel.

2. **`compute_fft_spectrum(signal, fps)`** — converts the time-domain
   signal into a frequency spectrum. Includes **detrending** (remove mean
   before transforming) and a **Hann window** (tapers the signal to zero at
   both ends) to reduce spectral leakage — without this, a clip that
   doesn't contain an exact whole number of vibration cycles smears energy
   into neighboring frequency bins. Amplitude is properly normalized
   (`* 2/n`), not raw FFT magnitude.

3. **`find_dominant_frequency(freqs, amplitude, low_hz, high_hz)`** —
   restricts the search to a target band. Without this, an irrelevant but
   strong frequency elsewhere in the spectrum could be mistaken for the
   real signal.

4. **`spectral_peakiness(freqs, amplitude, peak_freq)`** — the actual
   detection logic. Computes a **z-score**: how many standard deviations
   above the local background noise floor the peak sits, with the peak's
   own neighborhood excluded from that background estimate (so the peak
   isn't compared against itself).

5. **`analyze_vibration(frames, fps, roi, low_hz, high_hz, peakiness_threshold)`**
   — orchestrates all of the above into one result: `detected` (bool),
   `dominant_frequency_hz`, `peakiness`, plus the full time-series and
   spectrum data for frontend charts.

### Threshold calibration

`peakiness_threshold` defaults to **3.0** (a standard "3-sigma" statistical
convention), but was empirically raised to **10.0** in end-to-end pipeline
testing, based on real measured values:

| Test case | Measured peakiness |
|---|---|
| Real 15 Hz vibration (uncompressed) | **44.2** |
| Worst false positive found (static clip) | under **4** |

A 10x+ margin exists between real signal and worst-case noise at these
settings — the threshold was set with this real gap in mind, not guessed.

### Known statistical caveat — the "look-elsewhere effect"

Searching many frequency bins and picking the tallest one will *always*
look somewhat unusual compared to the rest, purely by chance — even in
pure noise. This is why the peakiness threshold has a large safety margin
rather than being set right at the theoretical noise floor. A more
rigorous fix (not yet implemented) would be a proper statistical test that
explicitly corrects for the number of bins searched (e.g. Fisher's g-test
for periodogram peaks).

---

## Real bugs found during validation (full investigation)

### Bug 1 — video compression can destroy the real signal

Testing found that saving a synthetic clip through standard `.mp4`
compression, then analyzing it, produced a completely different (and
weaker) result than analyzing the same frames uncompressed. Measured
directly: the real motion signal's size (std) was **0.055** before
compression, but **0.173** after — over 3x larger, with near-zero
correlation to the original (-0.19). Compression wasn't just adding noise
on top of the real signal — it was replacing it with an unrelated,
codec-introduced periodic pattern (likely tied to keyframe interval
timing).

**Fix used for validation:** added a lossless `.npy` save path (see
`generate_test_clips.py`) specifically for testing the algorithm without
compression as a confound. On uncompressed data, detection was
near-perfect (15.06 Hz found, peakiness 44.2, true value 15.00 Hz).

**Implication for production:** minimum footage quality/bitrate matters
for reliably detecting small sub-pixel signals.

### Bug 2 — whole-frame analysis dilutes localized signals

Averaging motion over an entire frame buries a small, localized vibration
in noise from unrelated static regions (most of a frame doesn't move even
when a small part of it does). A tight ROI around the actual moving region
is functionally necessary, not a UI nicety.

### Bug 3 — false positive from the look-elsewhere effect

A completely static test clip was initially flagged as "vibration
detected" due to picking the single tallest frequency bin out of many
searched, which will always look somewhat unusual by chance. Fixed by
raising the peakiness threshold based on real measured separation between
signal and noise (see Threshold Calibration above).

### Open question — larger-amplitude motion, non-monotonic detection

Testing the same 15Hz vibration at increasing amplitudes (0.3px to 3px)
found detection quality did *not* improve monotonically with amplitude —
0.3px gave the strongest, cleanest result, while several larger amplitudes
gave weaker or incorrect results. Working theory (not fully confirmed):
a fixed, narrow ROI causes pixels to saturate (fully "background" or fully
"foreground" colored) for large displacements, turning a smooth sinusoidal
brightness signal into a spikier, less periodic one that spreads energy
across the spectrum instead of concentrating it. Since this project targets
sub-pixel (invisible-to-the-eye) vibration specifically, this matters less
than it might otherwise — but is flagged here as an unresolved area for
further investigation.
