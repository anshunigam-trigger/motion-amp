# Motion Amplification Project — What We Built, What We Tested, What We Found

This document is a plain-language record of everything we did while building the
core (backend) part of this project. It's written the way we'd actually explain
it to someone, not like a formal report the goal is that anyone on the team
(or a judge) can read this and understand exactly what works, what doesn't, and
why we made the choices we made.

---

## 1. What we built

The core idea of this project: take a video, and make invisible, tiny vibrations
visible by exaggerating them. Then, separately, figure out if a real vibration is
actually there, and at what frequency.

We built this in small pieces, each one doing one clear job:

| File | What it does |
|---|---|
| `io/video_io.py` | Turns a video file into numbers we can do math on, and back again |
| `core/pyramid.py` | Splits one image into layers of detail, from fine to coarse |
| `core/bandpass.py` | Keeps only a chosen "wobble speed" (frequency) in a signal, throws away the rest |
| `core/riesz.py` | Turns one pixel value into a pair of numbers, so we can compute an angle |
| `core/phase.py` | Uses that pair to work out exactly where an edge is sitting, sub-pixel precise |
| `core/pipeline.py` | Runs the whole thing end-to-end, two ways: a simple version and the real "phase-based" version |
| `analytics/vibration.py` | Looks at the amplified motion and decides: is this a real vibration, and at what frequency? |
| `test_clips/generate_test_clips.py` | Makes fake test videos where we already know the correct answer, so we can check our own work |

We deliberately built and tested this in small steps, checking each piece before
moving to the next one, instead of writing everything at once and hoping it works.

---

## 2. Why we made fake test videos instead of using real footage

Real vibration is invisible to the eye that's the whole point of the project.
So there's no easy way to look at real footage and just "know" if our system got
the right answer.

Instead, we wrote a script that draws a simple scene (a gray background with a
dark bar in it) and shifts the bar by an exact, known amount, following a sine
wave, at an exact, known frequency (15 Hz). Because we built it ourselves, we
know exactly what the "correct answer" should be — so we can check if our code
actually finds it, instead of just hoping the output "looks right."

We made three test clips:
- **`vibrating_panel`** — has a real, exact 15 Hz vibration built in. Should be detected.
- **`static_panel`** — nothing moves at all. Should NOT be detected.
- **`camera_shake`** — the whole frame jitters randomly (not a steady rhythm). Should NOT be detected as a real vibration, even though it does move.

---

## 3. Testing the amplification pipeline

### What we found — the baseline (simple) version works

We ran the baseline pipeline on `vibrating_panel` and checked a pixel right on
the bar's edge, before and after amplification. The result: a clear, correct
15 Hz wobble showed up, made about 2.4x bigger by the amplification. This
confirmed the pyramid + filtering + amplifying steps all work correctly together.

### Problem found — amplifying too much breaks the video

We tried a high amplification value (alpha=20) and the pixel values got pushed
past what a video frame can actually store (0–255) — they just flattened out at
the top and bottom, a problem called **clipping**. Lowering it to alpha=4 fixed
this and gave a clean result.

### Problem found — camera shake looked like a real vibration (in the baseline test)

This was a genuinely important discovery. When we amplified `camera_shake`
using the same settings, it came out **bigger** than the real vibration signal —
even though nothing in it was actually periodic. The reason: random camera
jitter has energy spread across *all* frequencies, and even a small slice of
that spread-out energy, when it happens to fall inside our target frequency
range, can be bigger than one small, focused, real signal. This told us that
**just measuring "how much did it wobble" isn't enough** — we needed something
smarter, which is why the FFT/analytics step exists.

### Testing the phase-based (real) algorithm

Once we built the proper phase-based version, we ran the same kind of check: at
alpha=0 (no amplification at all), it correctly gave back almost exactly the
original video (near-zero error) — a good sign the code wasn't broken. Then we
tested increasing alpha and found something interesting:

- alpha=5 and alpha=10 gave a clean, correct-looking 15 Hz wobble
- alpha=20 gave a *smaller*, distorted result, with extra fake wiggles between the real peaks

This is a different kind of "too much amplification" problem than the clipping
one — here, the angle we're amplifying got pushed so far it wrapped around and
folded back on itself, creating fake extra motion instead of real motion. Same
lesson as before though: **there's always a limit to how much you can amplify
before things break**, just for a different underlying reason each time.

---

## 4. Building the vibration detector (the FFT / analytics part)

This is the part that actually answers "is this a real vibration, and at what
frequency" — properly, using a technique called FFT (Fast Fourier Transform),
which breaks a wobbly signal down into "how much of each frequency is present."

### Two versions got built, and we merged them

One version was written by a teammate (whole-region motion tracking, smoother
FFT handling with a windowing step, proper amplitude scaling). Another version
was written earlier in this project (searching only within an expected
frequency range, and comparing the strongest frequency against the background
noise level). We combined the best parts of both into one file.

### Bug found — a false positive on the "nothing is moving" clip

After merging, we tested all three clips and found `static_panel` (nothing
moving at all) was being flagged as "vibration detected" almost as strongly as
the real vibrating clip. That's a real bug, not just bad luck.

**What caused it:** when you search across many frequency bins and just pick
whichever one happens to be tallest, that tallest one will *always* look
somewhat unusual compared to the rest — even in pure random noise — purely
because you specifically picked the best one out of many tries. This is a known
statistics trap called the "look-elsewhere effect." Our fix, for now: since we
measured a real vibration scoring about 44 on our "how sharp is this peak" test,
and the worst false alarm we found scored under 4, we raised our detection
threshold with a large safety margin, based on that real measured gap — not
just a guess.

### Bigger bug found — saving the video as a normal .mp4 was hiding the real signal

While testing with a proper region-of-interest (a small box right on the edge,
instead of the whole frame), we found our real 15 Hz signal wasn't being found
correctly even though the code was right. After a lot of testing, here's what
we figured out, step by step:

1. We tested the same clip without going through the saved video file at all
   (working directly with the frames in memory) — the real 15 Hz signal was
   found perfectly, with a very strong, clear detection score.
2. That told us the algorithm itself was correct, but something about *saving
   the video as an .mp4 file* was destroying our signal.
3. We measured this directly: the actual motion signal our code uses had a
   "size" of about 0.055 before saving to video, but the version saved through
   .mp4 had a "size" of about 0.173 — over three times bigger, and barely
   related to the original at all (almost no correlation between the two).
4. Our conclusion: **video compression doesn't just blur our signal a little —
   it replaces it with its own, unrelated pattern**, likely tied to how video
   codecs periodically re-compress the image every so many frames. That
   artificial pattern was strong enough to completely bury our real,
   deliberately tiny (sub-pixel) signal.

**This is a genuinely important, real finding for the project**, not just a
bug in our testing: **standard, heavily compressed video may not preserve
very small vibrations well enough to detect them at all.** A real deployment
would need to think about camera/recording quality, not just the algorithm.

### How we proved the algorithm itself was correct

To separate "is our code wrong" from "is video compression the problem," we
added a way to save test clips with **zero compression at all** (a plain data
file instead of a video file), specifically for testing.

Result: on the uncompressed version, we got a frequency reading of 15.06 Hz
(the true answer is 15.00 Hz — this tiny gap is just a normal limit of how
precisely FFT can measure frequency with a short clip, not an error) and a very
strong detection score. This confirmed, cleanly: **the actual algorithm — the
pyramid, the phase math, the FFT — works correctly.** The problems we were
chasing were about compression and signal strength, not broken logic.

### An unexplained finding — bigger motion isn't always easier to detect

We tested the same 15 Hz vibration at several different sizes (0.3 pixels all
the way up to 3 pixels), expecting bigger motion to always be easier to detect.
Instead, we found the opposite in places — the smallest amount (0.3 pixels)
gave the strongest, cleanest detection, while some larger amounts gave weaker,
messier results, with the wrong frequency being reported.

We have a reasonable, but not fully confirmed, explanation: our current
detection method looks at a small, fixed strip of pixels right at the edge. For
tiny motion, those pixels are always "in play," reacting smoothly the whole
time. For bigger motion, the edge may move fully past those pixels for parts of
its cycle, so instead of a smooth wobble, those pixels see short, sharp
pulses — and that kind of signal spreads its energy across many frequencies
instead of concentrating it in one place, making it harder to detect cleanly.

**We're noting this honestly as an open question, not a solved one** — we
didn't have time to fully confirm the exact mechanism. This is one thing worth
digging into further if there's time, but isn't a blocker: the project is
specifically about *sub-pixel*, invisible-to-the-eye vibration, which is
exactly the size range (0.3px) where our system performed best.

---

## 5. Known limitations (honest list)

- **Video compression can hide small vibrations.** Standard .mp4 compression
  introduced its own fake, periodic pattern strong enough to bury our real
  signal in testing. A real deployment likely needs a minimum footage
  quality/bitrate requirement, or a less lossy recording format.
- **Detection needs a properly chosen region of interest.** Averaging motion
  over an entire frame drowns out a small, localized vibration in noise from
  all the unrelated, non-vibrating parts of the frame. The system needs the
  user (or an automatic step) to select a sensible region, not just analyze
  the whole frame blindly.
- **The exact safe amplification limit isn't fully mapped out.** Both
  algorithms break in different ways if pushed too far (pixel clipping for the
  baseline version, phase-wrapping distortion for the phase-based version). We
  found safe values by testing, but haven't derived an exact formula for the
  maximum safe value in every situation.
- **Very large motion (a few pixels or more) may be harder to detect
  reliably than very small motion**, for reasons we have a working theory
  about but haven't fully confirmed. Since the project's whole purpose is
  detecting sub-pixel, invisible vibration, this matters less than it might
  sound, but it's worth knowing about.
- **Our detection threshold was set using a small number of test clips.**
  It's a real, evidence-based choice (not a guess), but it hasn't been tested
  against a large variety of real-world footage yet.
- **The FFT frequency reading has a resolution limit tied to clip length** —
  roughly 0.25 Hz per bin with our 4-second, 60fps test clips. Longer clips
  would give a more precise frequency reading, at the cost of needing more
  footage before producing a result.

---

## 6. What's built vs. what's left

**Built and tested:**
- Video read/write
- Laplacian pyramid (spatial decomposition)
- Temporal band-pass filtering
- Riesz transform + phase extraction (the real, phase-based algorithm)
- Both amplification pipelines, tuned and validated against known test data
- FFT-based vibration detection, merged from two approaches, debugged and validated

**Not built yet:**
- FastAPI backend (no way to call any of this over the web yet)
- Database layer (nowhere to store results yet)
- Automated test suite (we've been testing manually with one-off scripts)
- React frontend (no user interface at all yet)

---

*This document reflects the state of the project as of the core backend build.
It should be updated as more testing is done, especially around the open
questions in Section 4.*
