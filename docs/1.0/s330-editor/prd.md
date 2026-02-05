# S-330 Editor - Product Requirements Document

**Created:** 2026-02-05
**Status:** Approved
**Owner:** Orion Letizi

## Problem Statement

The Roland S-330 web editor was originally developed in the `ol_dsp` repository and migrated to the `audiocontrol` monorepo. During migration, the feature branch (`feature/roland-s330-support` in ol_dsp) diverged from the deployed code (`deploy/s330-editor` in audiocontrol). Approximately 40 commits of feature work remain in ol_dsp that were never ported to audiocontrol, including the Virtual Front Panel, hardware parameter listener, and progressive UI loading. Meanwhile, audiocontrol's version independently evolved with corrected tone addressing and a simplified client architecture.

This feature branch reconciles the two codebases, bringing the ol_dsp feature work into the audiocontrol architecture.

## User Stories

- As a musician, I want a Virtual Front Panel in the web editor so that I can remotely control my S-330 without reaching for the hardware
- As a musician, I want real-time sync between the hardware and UI so that changes made on the S-330 front panel are reflected immediately in the editor
- As a musician, I want progressive loading with progress feedback so that I can start working before all data is loaded
- As a developer, I want the canonical S-330 codebase to live in audiocontrol so that ol_dsp is no longer the source of truth for this feature

## Success Criteria

- [ ] All unique ol_dsp feature work is ported to audiocontrol
- [ ] Tone addressing uses the empirically-verified values from audiocontrol
- [ ] Virtual Front Panel renders and sends correct SysEx button commands
- [ ] Hardware parameter listener detects DT1 messages and updates UI
- [ ] Progressive loading with progress bar works for patch/tone data
- [ ] All existing tests pass after reconciliation
- [ ] `pnpm --filter @audiocontrol/s330-editor... build` succeeds

## Scope

### In Scope

- Port Virtual Front Panel components from ol_dsp
- Port hardware parameter change listener from ol_dsp
- Port `useFrontPanel` React hook from ol_dsp
- Port utility scripts (sysex monitor, button sender) from ol_dsp
- Port front panel SysEx documentation from ol_dsp
- Reconcile S330 client caching/progress with audiocontrol's architecture
- Port video demo scripts and overlay definitions from ol_dsp

### Out of Scope

- Changing the tone addressing (audiocontrol's empirical values are correct)
- Reverting the audiocontrol client architecture to ol_dsp's cached pattern
- Porting Library/Sampling page changes (audiocontrol already has these)
- MAX_PATCHES change (audiocontrol's 64 is correct vs ol_dsp's 16)

## Divergence Analysis

### ol_dsp has (not in audiocontrol)

| Component | Description | Lines |
|-----------|-------------|-------|
| `front-panel/` components | VirtualFrontPanel, NavigationPad, FunctionButtonRow, ValueButtons, FrontPanelButton | ~650 |
| `s330-front-panel.ts` | Button codes, controller factory | 283 |
| `s330-parameter-listener.ts` | DT1 message parser for real-time sync | 233 |
| `useFrontPanel.ts` | React hook for front panel control | 202 |
| `s330-button-sender.ts` | Utility script for testing buttons | 160 |
| `s330-sysex-monitor.ts` | Utility script for monitoring SysEx | 170 |
| Front panel SysEx docs | Protocol documentation | 251 |
| Video demo scripts | overlays.yaml, video script | 361 |
| Feature documentation | prd, workplan, implementation summary | ~420 |

### audiocontrol has (not in ol_dsp)

| Component | Description |
|-----------|-------------|
| Corrected tone addressing | `0x02` base, empirical byte2 formula |
| `MAX_PATCHES = 64` | Increased from ol_dsp's 16 |
| Stateless client API | request/send pattern vs cached get/set |
| Two-tier store | Name lists + on-demand full data |
| Library/Sampling pages | Additional UI routes |
| `build:deploy` script | Netlify deployment build |

### Resolution Strategy

Keep audiocontrol's architecture as the base. Port ol_dsp's unique features (front panel, parameter listener, utility scripts, documentation) into the audiocontrol codebase, adapting them to use the existing audiocontrol client API patterns and namespace (`@audiocontrol/`).

## Dependencies

- `@audiocontrol/sampler-devices` module (device communication layer)
- `@audiocontrol/sampler-midi` module (MIDI protocol)
- `@audiocontrol/sampler-lib` module (shared data structures)
- WebMIDI API for browser-based MIDI communication

## Open Questions

- [x] Which tone addressing is correct? audiocontrol's empirical values
- [x] Which client architecture to use? audiocontrol's stateless approach
- [ ] Should the caching/progress infrastructure from ol_dsp be adapted to audiocontrol's store pattern, or should it live in the client?
