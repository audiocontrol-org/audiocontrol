# PRD: standalone-sampler

## Problem Statement

The audiocontrol editors currently require external hardware samplers (S3000XL, S-330, S-550, etc.) to produce sound. Users without hardware cannot preview or play programs, and there is no way to use the editor UI as a creative instrument in its own right.

A standalone software sampler using synth-core as the sound engine would let users load samples, build programs with keygroups and zones, and play them via MIDI controller or on-screen keyboard -- no hardware required.

This feature is also the foundation for a future hardware product that combines a standalone sampler with a controller/editor for external hardware samplers.

## User Stories

1. **As a user without hardware**, I want to create programs with keygroups and zones so that I can build playable instruments entirely in the browser.

2. **As a user**, I want to load samples from the common-area library into keygroups so that I can use my existing sample collection without importing/exporting to a hardware device.

3. **As a user**, I want to play programs polyphonically via a connected MIDI controller so that I can use the standalone sampler as a real instrument.

4. **As a user without a MIDI controller**, I want to play programs via an on-screen keyboard so that I can audition and perform without any external hardware.

5. **As a user**, I want to map each keygroup to a key range and velocity range with a sample assignment so that I can build multi-sampled instruments with velocity layers.

6. **As a user**, I want per-zone filter, amplitude envelope, and pitch parameters so that I can shape the sound of each zone independently.

7. **As a user**, I want the editor UI to follow the same patterns as the Akai and Roland editors (parameter sections, zone mapping, library browser) so that the experience is consistent across the application.

8. **As a user**, I want to save programs to and load programs from the common-area library so that my work persists and is available to other editors.

9. **As a user**, I want the sampler to work as a web app with no hardware dependencies so that I can use it on any machine with a browser.

## Acceptance Criteria

- Users can create, edit, and play programs with keygroups, zones, filter/amp/pitch -- like the Akai editor but entirely software-based
- Samples load from the common-area library
- Programs play polyphonically via MIDI controller input or on-screen keyboard
- Each keygroup maps to a key range and velocity range with a sample assignment
- Per-zone filter, amp, and pitch parameters are supported
- The editor UI follows the same patterns as Akai/Roland editors (parameter sections, zone mapping, library browser)
- Programs can be saved to and loaded from the common-area library
- The sampler works as a web app with no hardware dependencies

## Out of Scope

- **Hardware device integration** -- Electron shell, GPIO, kiosk mode, hardware controller. These belong to a future hardware-product feature.
- **Hardware sampler communication** -- No SysEx, no MIDI device protocol. This sampler is software-only.
- **DAW plugin format (VST/AU)** -- This is a web app. Plugin formats are a separate feature if pursued.

## Dependencies

| Dependency | Relationship |
|------------|-------------|
| `synth-core` | Must be extended with multi-keygroup playback (Phase 1 of this feature) |
| `akai-ux-improvement` | Building program editor UI patterns (parameter sections, keygroup list) that should be reused |
| `program-based-slicing` | Defines the `program.yaml` schema this sampler will consume |
| `feature/library-ux` | Has the latest library browser patterns for sample/program browsing |

## Open Questions

1. **Program format** -- Should the standalone sampler use the same `program.yaml` format from program-based-slicing, or does it need its own format with additional parameters (e.g., effects routing, modulation)?

2. **Parameter set** -- What filter/amp/pitch parameters should synth-core support? Match the S3000XL parameter set? A subset? A superset with modern additions?

3. **On-screen keyboard scope** -- Should the on-screen keyboard be a shared editor-core component (usable by all editors) or standalone-sampler specific?

4. **Effects routing** -- How should effects be handled -- per-voice, per-keygroup, or per-program? This affects both the synth-core architecture and the UI.
