# Loop Point Detection & Splicing - Product Requirements Document

**Feature:** Loop Point Auto-Detection
**Target Devices:** Roland S-550 / S-330
**Status:** In Development

---

## Problem Statement

Finding seamless loop points in audio samples is time-consuming and error-prone when done manually. Users must align waveforms by eye and ear, iterating many times to find a click-free loop. This process can take several minutes per sample and requires significant expertise.

The AudioControl Editor already provides a visual loop editor for S-550/S-330 samples. Adding automatic loop point detection would dramatically improve the user experience by:

1. Reducing loop point selection time from minutes to seconds
2. Providing consistent, high-quality results
3. Enabling users without audio engineering experience to create professional loops

---

## User Stories

### Primary User Stories

1. **Auto-Detection**
   As a sampler user, I want to automatically find loop point candidates so I can quickly create seamless loops without manual trial and error.

2. **Candidate Audition**
   As a sampler user, I want to audition multiple loop candidates so I can choose the one that sounds best for my specific use case.

3. **Splice Smoothing**
   As a sampler user, I want optional splice smoothing applied to my selected loop points so that any residual clicks are eliminated.

### Secondary User Stories

4. **Progress Feedback**
   As a sampler user, I want to see progress during auto-detection so I know the system is working and how long to wait.

5. **Score Visibility**
   As a sampler user, I want to see quality scores for each candidate so I can understand why certain loop points are ranked higher.

---

## Functional Requirements

### FR-1: Zero-Crossing Detection

The system shall identify zero-crossing points in the audio waveform where:
- The waveform crosses from negative to positive (positive-going)
- The waveform crosses from positive to negative (negative-going)
- Points are aligned to 2-byte boundaries per S-550/S-330 hardware requirements

### FR-2: Transient Exclusion

The system shall exclude the attack transient region from loop start candidates to prevent looping into the attack portion of the sample.

### FR-3: Candidate Scoring

The system shall score loop point candidates using:
- **Normalized Cross-Correlation (NCC):** Time-domain waveform similarity
- **Spectral Envelope Similarity:** Frequency-domain timbral match
- **Slope Match:** First-derivative continuity

### FR-4: Composite Ranking

The system shall combine individual scores into a composite score with configurable weights:
- NCC: 50% (default)
- Spectral: 35% (default)
- Slope: 15% (default)

### FR-5: Top-K Results

The system shall return the top K (default: 10) candidates sorted by composite score for user selection.

### FR-6: Hardware Constraint Enforcement

The system shall enforce S-550/S-330 hardware constraints:
- All indices must be even (2-byte alignment)
- Minimum loop length of 32 samples
- Maximum sample length within device limits

### FR-7: Splice Smoothing

The system shall provide optional crossfade smoothing:
- Linear crossfade (default)
- Equal-power crossfade
- Configurable crossfade length (default: 32 samples)

### FR-8: UI Integration

The system shall integrate with the existing LoopEditor component:
- "Auto-Detect" button to trigger search
- Progress indicator during search
- Candidate markers on waveform display
- Candidate list with scores
- Preview/audition button for each candidate

---

## Non-Functional Requirements

### NFR-1: Performance

- Search shall complete within 5 seconds for typical sample lengths (< 1 second at 30kHz)
- Search shall not block the UI thread (Web Worker implementation)

### NFR-2: Accuracy

- Auto-detection shall find at least one perceptually seamless loop point for 90% of sustained samples
- Sustained samples include: piano, strings, brass, woodwinds, pads

### NFR-3: Hardware Compatibility

- All generated loop points shall be valid for transmission to S-550/S-330 hardware via SysEx
- Loop playback on hardware shall be click-free for top-ranked candidates

---

## Success Criteria

1. **Functional:** Auto-detection identifies loop points that produce click-free loops on actual S-550/S-330 hardware
2. **Performance:** Search completes within 5 seconds for samples under 1 second
3. **Usability:** Users can trigger auto-detection, view candidates, and select a loop point within 3 clicks
4. **Quality:** Top-ranked candidate produces perceptually seamless loop in 90%+ of sustained samples

---

## Out of Scope (v1)

The following features are explicitly excluded from the initial implementation:

- **Pitch-synchronous overlap-add (PSOLA):** Advanced technique for difficult material
- **Recurrence matrix analysis:** Global structure analysis for complex sounds
- **Real-time preview during search:** Preview available only after search completes
- **S-550 ping-pong loop optimization:** Forward loop only in v1
- **Automated quality verification:** Manual audition required

---

## Technical Specification

See [loop-editor-spec.md](./loop-editor-spec.md) for detailed algorithm specifications, implementation guidance, and library recommendations.

---

## References

- Roads, C. (1996). *The Computer Music Tutorial*, Chapter 2. MIT Press.
- Zölzer, U. (Ed.). (2011). *DAFX: Digital Audio Effects* (2nd ed.). Wiley.
- Bello, J.P., et al. (2005). A tutorial on onset detection in music signals. *IEEE TSAP*.
