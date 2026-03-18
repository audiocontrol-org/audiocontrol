# Loop Point Detection & Splicing — Technical Specification

**Project:** AudioControl Editor — Roland S-550 / S-330 Loop Editor  
**Target environment:** TypeScript, Chrome (Web Audio API, Web Workers, WebAssembly optional)  
**Document status:** Draft v0.1

---

## Table of Contents

1. [Background and Scope](#1-background-and-scope)
2. [Problem Decomposition](#2-problem-decomposition)
3. [Candidate Generation](#3-candidate-generation)
4. [Candidate Scoring](#4-candidate-scoring)
5. [Splice Smoothing](#5-splice-smoothing)
6. [Roland S-550 / S-330 Hardware Constraints](#6-roland-s-550--s-330-hardware-constraints)
7. [Architecture and Implementation Guidance](#7-architecture-and-implementation-guidance)
8. [Library Survey](#8-library-survey)
9. [Testing and Validation](#9-testing-and-validation)
10. [References](#10-references)

---

## 1. Background and Scope

This document specifies the algorithms, data structures, and library choices for the loop point detection and audio splicing subsystem of the AudioControl loop editor. The editor targets Roland S-550 and S-330 hardware samplers, which impose specific constraints on loop point placement (see §6).

The goal of automatic loop point detection is to find a pair of sample indices `(loopStart, loopEnd)` such that, when the sampler jumps from `loopEnd` back to `loopStart`, the resulting audio is perceptually seamless — free of clicks, tonal discontinuities, and amplitude steps.

This is a well-studied problem in computer music. The techniques described here draw on work from the 1980s onward, with modern refinements enabled by efficient spectral analysis.

---

## 2. Problem Decomposition

Loop point detection decomposes into three separable sub-problems, which should be implemented as independent modules:

1. **Candidate generation** — identify a set of sample index pairs that are plausible loop points based on local signal properties (zero crossings, amplitude, slope).
2. **Candidate scoring** — rank candidates by the perceptual quality of the resulting loop, using time-domain and frequency-domain similarity metrics.
3. **Splice smoothing** — for the winning candidate (or any user-selected pair), apply a short crossfade or overlap-add blend to eliminate residual click artifacts.

---

## 3. Candidate Generation

### 3.1 Zero-Crossing Detection

The most basic constraint for a click-free loop is that the waveform value at `loopEnd` must be close to the value at `loopStart`. The simplest approximation is to require both points to be zero crossings of the same polarity (both positive-going or both negative-going).

**Algorithm:**

1. Scan the sample buffer for indices where `samples[i-1] < 0 && samples[i] >= 0` (positive-going) or the reverse (negative-going).
2. Record all such crossings within the valid search range (see §6 for S-550/S-330 alignment constraints).
3. Restrict `loopEnd` candidates to a configurable window around the user's target point or the natural release boundary.
4. Restrict `loopStart` candidates to the sustain body of the sample, excluding the attack transient.

**Slope matching refinement:** Requiring matching polarity is a necessary but not sufficient condition. Candidates where the magnitude of `samples[i]` (the first post-crossing sample) is similar at both loop points will produce lower-amplitude discontinuities in the first derivative. Score slope similarity as `|slope(loopStart) - slope(loopEnd)|` and use it as a pre-filter to prune weak candidates before the more expensive scoring stage.

**Reference:** Roads, C. (1996). *The Computer Music Tutorial*, Chapter 2 ("Sampling"). MIT Press. — foundational treatment of zero-crossing loop finding in samplers.

---

### 3.2 Attack Transient Exclusion

Looping into the attack transient of a sample produces obvious artifacts. Candidates for `loopStart` must be drawn from the sustain region only.

Two approaches are practical in-browser:

**Energy envelope method:** Compute a short-time RMS envelope over 5–20 ms frames. The sustain region begins where the envelope derivative drops below a threshold (i.e., the amplitude has stabilized). This is straightforward to implement using a sliding window over the `Float32Array`.

**Onset detection:** More robust onset detection can be performed using the high-frequency content (HFC) measure or complex domain onset detection. The [Essentia.js](https://mtg.github.io/essentia.js/) library (see §8) provides both as WebAssembly-compiled algorithms directly usable in Chrome.

**Reference:** Bello, J.P., Daudet, L., Abdallah, S., Duxbury, C., Davies, M., & Sandler, M.B. (2005). A tutorial on onset detection in music signals. *IEEE Transactions on Speech and Audio Processing*, 13(5), 1035–1047.

---

## 4. Candidate Scoring

Candidates are scored using a combination of time-domain and frequency-domain metrics. The final score is a weighted sum; weights should be user-configurable or auto-tuned per sample type (percussive vs. sustained).

### 4.1 Normalized Cross-Correlation (Time Domain)

Normalized cross-correlation (NCC) measures waveform similarity between a window of N samples ending at `loopEnd` and a window of N samples beginning at `loopStart`. It is bounded in [-1, 1], where 1.0 is a perfect match.

**Definition:**

```
NCC(s, e, N) = Σ(a[i] * b[i]) / sqrt(Σ(a[i]²) * Σ(b[i]²))

where:
  a[i] = samples[loopStart + i]
  b[i] = samples[loopEnd - N + i]
  i ∈ [0, N)
```

**Window size:** N should correspond to 20–50 ms of audio at the sample's playback rate. For S-550 samples at 30 kHz, this is 600–1500 samples. Larger windows capture more tonal context but increase computation. A default of 1024 samples (≈34 ms at 30 kHz) is a reasonable starting point.

**Implementation note:** NCC is O(N) per candidate pair. With potentially thousands of zero-crossing pairs, the total search is O(Z² × N) where Z is the number of zero crossings in the search windows. This is suitable for a Web Worker (see §7.1). If the zero-crossing count is large, pre-filter by slope similarity first to reduce Z².

**Reference:** Zölzer, U. (Ed.). (2011). *DAFX: Digital Audio Effects* (2nd ed.), Chapter 7. Wiley. — covers correlation-based audio matching in the context of time-domain processing.

---

### 4.2 Spectral Envelope Similarity (Frequency Domain)

Even when time-domain NCC is high, spectral differences between the regions around `loopStart` and `loopEnd` can cause a perceptible timbral shift at the loop point. Spectral envelope similarity scoring addresses this.

**Recommended approach — LPC envelope distance:**

Linear Predictive Coding (LPC) provides a compact, smooth representation of the spectral envelope that is robust to pitch period alignment. The distance between LPC envelopes at the two loop point regions is an effective perceptual similarity measure.

1. Compute LPC coefficients of order 12–16 over a window around each candidate point using the Levinson-Durbin algorithm.
2. Convert coefficients to line spectral frequencies (LSFs) or evaluate the log spectral distance between the two envelopes.
3. Use the Itakura-Saito distortion or log spectral distance as the spectral score component.

**Alternative — FFT magnitude envelope distance:**

A simpler but less robust alternative is to compare FFT magnitude spectra directly:

1. Apply a Hann window of 512–2048 samples around each candidate point.
2. Compute the FFT magnitude spectrum (log scale).
3. Score by the L2 or L1 norm of the difference between the two log-magnitude spectra.

The [fft.js](https://github.com/indutny/fft.js) library provides a fast, dependency-free FFT implementation suitable for use in a Web Worker. Essentia.js exposes LPC directly.

**Reference:** Rabiner, L., & Schafer, R. (2010). *Theory and Applications of Digital Speech Processing*. Prentice Hall. — authoritative reference on LPC and the Levinson-Durbin algorithm.

**Reference:** Klapuri, A., & Davy, M. (Eds.). (2006). *Signal Processing Methods for Music Transcription*, Chapter 2. Springer. — covers spectral similarity and envelope comparison in music contexts.

---

### 4.3 Composite Score

Combine the time-domain and spectral scores into a single ranking score:

```
score = w_ncc   * NCC
      + w_spec  * (1 - normalizedSpectralDistance)
      + w_slope * (1 - normalizedSlopeDiff)
```

Default weights (tunable):

| Component | Default Weight | Notes |
|---|---|---|
| NCC (time domain) | 0.50 | Primary metric for waveform continuity |
| Spectral envelope | 0.35 | Prevents timbral glitch at loop point |
| Slope match | 0.15 | Reduces first-derivative discontinuity |

Return the top K candidates (e.g., K=10) sorted by composite score for display in the UI. The user should be able to audition each candidate and override the automatic selection.

---

### 4.4 Recurrence Matrix Approach (Optional / Advanced)

For complex sustained sounds (evolving pads, bowed strings, choirs), the above point-pair approach may not identify the globally optimal loop region. A more powerful technique uses a **self-similarity (recurrence) matrix** over the full sample to find regions of maximal self-similarity, then extracts candidate pairs from the diagonal structure of that matrix.

This approach is well-supported by [librosa](https://librosa.org/doc/latest/generated/librosa.segment.recurrence_matrix.html) in Python, and is best suited to an offline preprocessing step or a separate analysis mode. It is not recommended as the primary algorithm for real-time browser-based operation due to O(N²) memory cost.

**Reference:** Foote, J. (1999). Visualizing music and audio using self-similarity. *Proceedings of ACM Multimedia 1999*. — original paper on the recurrence matrix approach to audio structure analysis.

---

## 5. Splice Smoothing

Even a well-scored loop point pair may have a residual discontinuity due to quantization noise (especially relevant for 12-bit S-550/S-330 samples) or near-zero-crossing imprecision. A short crossfade at the splice point eliminates this.

### 5.1 Linear Crossfade (Overlap-Add)

Blend a short region at the end of the loop body into the beginning of the loop using a linear fade-out / fade-in pair.

```
for i in [0, crossfadeLength):
  alpha = i / crossfadeLength
  blended[i] = (1 - alpha) * samples[loopEnd - crossfadeLength + i]
             +      alpha  * samples[loopStart + i]
```

This modification writes into the exported sample buffer — it must be applied to the sample data that is transmitted to the hardware, not just to the browser-side playback preview. The crossfade length should be exposed as a user-adjustable parameter, defaulting to 32 samples.

**Caution:** Linear crossfades introduce a 3 dB amplitude dip at the midpoint for uncorrelated signals. For highly correlated signals — which is the goal of good loop point selection — the dip is minimal. If the dip is audible, use the equal-power crossfade below.

### 5.2 Equal-Power Crossfade

Replace the linear ramp with sine/cosine curves:

```
alpha_out = cos(i / crossfadeLength * π/2)
alpha_in  = sin(i / crossfadeLength * π/2)
```

This preserves constant perceived loudness through the transition and is preferred for material where the two regions are not highly correlated.

**Reference:** Zölzer, U. (2011). *DAFX: Digital Audio Effects* (2nd ed.), §2.2. Wiley.

### 5.3 Overlap-Add with Pitch Correction (Advanced / Out of Scope v1)

For pitched sustained tones where the search cannot find a sufficiently similar pair (e.g., due to amplitude modulation or vibrato), pitch-synchronous overlap-add (PSOLA) can synthesize a seamless splice. This requires pitch period detection and significantly increases complexity. It is deferred to a future version.

**Reference:** Moulines, E., & Charpentier, F. (1990). Pitch-synchronous waveform processing techniques for text-to-speech synthesis using diphones. *Speech Communication*, 9(5–6), 453–467. — original PSOLA paper.

---

## 6. Roland S-550 / S-330 Hardware Constraints

The following constraints are imposed by the hardware and must be enforced by the candidate generation and export pipeline. Loop points that violate these constraints will be silently misinterpreted or ignored by the sampler.

| Constraint | S-550 | S-330 | Notes |
|---|---|---|---|
| Word alignment | 2-byte boundary | 2-byte boundary | All loop point indices must be even |
| Minimum loop length | ~32 samples | ~32 samples | Shorter loops cause instability |
| Maximum sample length | 524,288 samples | 262,144 samples | At base sample rate |
| Sample rate range | ~15 kHz – 30 kHz | ~15 kHz – 30 kHz | Patch-dependent; affects window sizing |
| Alternating (ping-pong) loop | Supported | Not supported | S-330 forward loop only |
| SysEx loop point encoding | 14-bit, two 7-bit MIDI bytes | Same | Verify encoding in export layer |

**Word alignment enforcement:** After scoring, snap both `loopStart` and `loopEnd` to the nearest even index before passing to the scorer or exporter. Do not snap after scoring, as this may invalidate the scored position.

**Minimum loop length:** Enforce `loopEnd - loopStart >= MIN_LOOP_SAMPLES` as a hard filter during candidate generation. `MIN_LOOP_SAMPLES` should be the larger of 32 samples or one estimated pitch period at the sample's lowest expected fundamental. Loops shorter than one pitch period produce a pitched artifact unrelated to the original sample.

**S-330 ping-pong:** The scoring and smoothing pipeline should be parameterized on loop mode. For alternating loops (S-550 only), the splice point occurs at both `loopEnd` (forward→reverse) and `loopStart` (reverse→forward), so both boundaries require smoothing.

---

## 7. Architecture and Implementation Guidance

### 7.1 Web Worker Isolation

The candidate search is CPU-intensive — O(Z² × N) in the worst case. It must run in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to avoid blocking the UI thread.

**Recommended structure:**

- **Main thread:** manages UI, waveform rendering, user interaction. Posts `Float32Array` buffer and search parameters to the worker via `postMessage` with a `Transferable` transfer (zero-copy).
- **Worker:** runs candidate generation and scoring, posts ranked candidate list back to main thread. Posts progress events at regular intervals (e.g., every 100 ms) so the UI can display a progress indicator.
- **Main thread:** renders candidate markers on the waveform view. User selects or auctions candidates; selection triggers SpliceSmoother in the main thread or a second worker pass.

### 7.2 Module Boundaries

```
LoopEditor (UI layer)
  │
  ├── CandidateSearchWorker
  │     ├── ZeroCrossingDetector       §3.1
  │     ├── TransientExcluder          §3.2
  │     ├── NormalizedCrossCorrelation §4.1
  │     └── SpectralSimilarityScorer   §4.2
  │
  └── SpliceSmoother                   §5
        ├── LinearCrossfade
        └── EqualPowerCrossfade
```

Each module should accept and return plain typed objects with no UI or DOM dependencies, enabling unit testing in Node.js (see §9).

### 7.3 `Float32Array` vs. S-550 12-bit Samples

The S-550 and S-330 store samples as 12-bit signed integers. When loaded into the browser, normalize to `Float32Array` in the range [-1.0, 1.0] for all algorithm processing. On export, convert back to 12-bit integers with appropriate clipping and rounding. The quantization noise floor of 12-bit audio (~72 dB below full scale) means the crossfade in §5 should use a minimum of 8 samples to avoid quantization artifacts dominating the splice.

### 7.4 Sample Rate Awareness

Search window sizes and crossfade lengths are specified in milliseconds throughout this document. The implementation must convert to sample counts using the actual sample rate of the loaded sample at runtime. Do not hardcode sample counts.

---

## 8. Library Survey

The following libraries are evaluated for use in a TypeScript/Chrome browser environment. No server-side runtime is required.

### 8.1 [fft.js](https://github.com/indutny/fft.js)

- **Purpose:** FFT for spectral envelope scoring (§4.2, FFT magnitude distance variant)
- **Language:** Pure JavaScript, no WASM
- **License:** MIT
- **Assessment:** Radix-4 FFT, well-maintained, suitable for Web Workers. Requires power-of-two input lengths; apply a Hann window before calling. Does not provide LPC. **Recommended** as the lightweight FFT path.

### 8.2 [Essentia.js](https://mtg.github.io/essentia.js/)

- **Purpose:** LPC computation (§4.2 primary path), onset detection / transient exclusion (§3.2), cross-correlation
- **Language:** C++ compiled to WebAssembly; TypeScript bindings available
- **License:** AGPL-3 for the main library; check individual algorithm modules
- **Assessment:** Produced by Music Technology Group, Universitat Pompeu Fabra. Provides `LPC`, `OnsetDetection`, `AutoCorrelation`, and many other algorithms. Heavier (~2 MB WASM binary); load asynchronously and cache the module. Best option for the LPC spectral scoring path and onset-based transient exclusion. **Recommended** for the spectral scoring and transient exclusion paths.
- **Reference:** Almeida, P., Joglar-Ongay, L., Serra, X., & Bogdanov, D. (2020). Essentia.js: Bring real-time music analysis to the web. *Web Audio Conference 2020*.

### 8.3 [Meyda](https://meyda.js.org/)

- **Purpose:** Alternative/complement to Essentia.js for spectral feature extraction (MFCC, spectral centroid, chroma, RMS)
- **Language:** JavaScript, no WASM
- **License:** MIT
- **Assessment:** Lighter than Essentia.js. Does not provide LPC or onset detection. Useful for the RMS-based transient exclusion path (§3.2 energy envelope method) or as a fallback spectral scorer. **Optional.**

### 8.4 [Rubberband Library](https://breakfastquay.com/rubberband/)

- **Purpose:** Reference for transient detection and phase-coherent windowing
- **Language:** C++ (GPL-2 / commercial); [WASM port exists](https://github.com/canaltecniquesa/rubberband-wasm)
- **License:** GPL-2 for open source use; commercial license available
- **Assessment:** Primarily a time-stretching/pitch-shifting library — out of scope for direct use. Its source (`src/dsp/Transients.cpp`) is a useful algorithmic reference for the transient exclusion implementation. **Reference only.**

### 8.5 [sample-loop-finder](https://github.com/KaleidonKep99/sample-loop-finder)

- **Purpose:** Reference C++ implementation of zero-crossing + correlation loop point search
- **Language:** C++
- **License:** MIT
- **Assessment:** Targets SoundFont/SF2 workflows but the algorithm structure is directly applicable. Not usable in the browser, but worth reading as a reference before writing the TypeScript implementation. **Reference only.**

### 8.6 librosa (Python — offline tooling only)

- **Purpose:** Offline validation, recurrence matrix analysis (§4.4), batch test corpus generation
- **Language:** Python
- **License:** ISC
- **Assessment:** Not usable in the browser. Recommended as an offline tool for generating ground-truth loop point labels for the test corpus (§9) and for prototyping the recurrence matrix approach. `librosa.segment.recurrence_matrix` and `librosa.effects` are directly relevant.
- **Reference:** McFee, B., et al. (2015). librosa: Audio and music signal analysis in Python. *Proceedings of the 14th Python in Science Conference*.

---

## 9. Testing and Validation

### 9.1 Unit Tests

Each algorithm module should have unit tests runnable in Node.js with synthetic signals:

- **ZeroCrossingDetector:** sine wave at known frequency — crossings should occur at predictable indices with correct polarity.
- **NormalizedCrossCorrelation:** NCC between identical windows should return 1.0; between inverted windows, -1.0; between independent noise windows, ≈0.
- **SpectralSimilarityScorer:** two windows of the same sine frequency should score higher than two windows of different frequencies.
- **SpliceSmoother:** a step-function discontinuity in a test buffer should be reduced to below a threshold amplitude after crossfade smoothing.

### 9.2 Perceptual Validation

Automated metrics are necessary but not sufficient. The top-ranked candidate for a set of reference samples should be verified by listening. Recommended test corpus:

- Sustained piano notes (moderate spectral complexity, clear pitch period)
- Sustained strings (vibrato, evolving spectral envelope)
- Sustained brass (strong harmonics, amplitude modulation)
- Flute or whistle (near-sinusoidal, sensitive to phase discontinuity)
- Drum one-shots (validates that transient exclusion correctly prevents looping into the attack)

### 9.3 Hardware Round-Trip Test

The complete pipeline — load sample → detect loop points → write to hardware via SysEx → record playback → verify no click — must be validated as an integration test. This is the only way to confirm that the algorithm output and SysEx encoding are both correct. A click at the loop boundary in hardware playback indicates either a poor loop point or an encoding error; these must be distinguished by checking the raw index values written to the sampler.

---

## 10. References

Bello, J.P., Daudet, L., Abdallah, S., Duxbury, C., Davies, M., & Sandler, M.B. (2005). A tutorial on onset detection in music signals. *IEEE Transactions on Speech and Audio Processing*, 13(5), 1035–1047.

Foote, J. (1999). Visualizing music and audio using self-similarity. *Proceedings of ACM Multimedia 1999*.

Klapuri, A., & Davy, M. (Eds.). (2006). *Signal Processing Methods for Music Transcription*. Springer.

Almeida, P., Joglar-Ongay, L., Serra, X., & Bogdanov, D. (2020). Essentia.js: Bring real-time music analysis to the web. *Web Audio Conference 2020*.

McFee, B., Raffel, C., Liang, D., Ellis, D., McVicar, M., Battenberg, E., & Nieto, O. (2015). librosa: Audio and music signal analysis in Python. *Proceedings of the 14th Python in Science Conference*.

Moulines, E., & Charpentier, F. (1990). Pitch-synchronous waveform processing techniques for text-to-speech synthesis using diphones. *Speech Communication*, 9(5–6), 453–467.

Rabiner, L., & Schafer, R. (2010). *Theory and Applications of Digital Speech Processing*. Prentice Hall.

Roads, C. (1996). *The Computer Music Tutorial*. MIT Press.

Zölzer, U. (Ed.). (2011). *DAFX: Digital Audio Effects* (2nd ed.). Wiley.
