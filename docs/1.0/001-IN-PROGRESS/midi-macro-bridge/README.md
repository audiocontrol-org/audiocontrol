# MIDI Macro Bridge

**Branch:** `feature/midi-macro-bridge-ableton`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge`
**Overall Status:** Phases 1-2 shipped via [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316). Phases 3-4 shipped via [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317). Decade-boundary tolerance fix shipped via [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318). Idle byte-trace shipped via [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319). Phase 5 (LCXL3 multi-input) + Ableton compatibility shipped via [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326). Phase 6 (Embedded Web Control Interface) planned.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Integration and Build | Complete | Shipped in #316. |
| Phase 2: Hardware Validation | Complete | MC-500 → 828mk3 → LUNA transport round trip verified. Shipped in #316. |
| Phase 3: MCU Transport + Closed-Loop Locate Implementation | Complete | MCU input parser, heartbeat responder, byte-sequence discovery, Backend trait (MCU default / keystrokes fallback), Locating state, LocateController, main-loop integration, stable CoreMIDI UniqueIDs, sync-on-stop. 84 unit tests passing. |
| Phase 4: Hardware Validation | Complete (core scenarios) | User confirmed MCU transport with LUNA backgrounded + forward/backward locate + post-locate PLAY + sync-on-stop. Edge-case scenarios (TS changes, nudge-size misconfig, LUNA disconnect mid-locate, keystrokes regression) covered by unit tests; not exercised on hardware this session. |
| Tolerance: decade-boundary overshoot | Complete | Shipped in [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318). Closed-loop locate to LUNA was overshooting at every decade crossing because the controller consumed only the first of LUNA's two-phase d7+d8 CC pair. Fixed by draining companion CCs (5 ms settle) before reporting bar; tracker filter for bar=0 transient as defense-in-depth. Hardware-validated. |
| Idle byte-trace | Complete | Shipped in [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319). Mirrored locate-window debug logging into `handle_mcu_byte_idle` so a single `RUST_LOG=debug` run captures every byte the DAW emits. Earned its keep diagnosing the Ableton multi-message-packet issue. |
| Ableton parser fixes | Complete | Shipped in [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326). Multi-message MIDI splitter in `midi.rs` plus BBT separator-bit mask in `mcu.rs::DigitChar::from_byte`. Ableton bundles 10+ messages per CoreMIDI packet and uses `0x70-0x79` for "digit + dot" — both prevented its position CCs from being parsed. Tests added; bridge correctly tracks Ableton's playhead. |
| Phase 5: LCXL3 multi-input | Complete | Shipped in [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326). LCXL3 as a second input source alongside MC-500. Sub-phases 5a (lcxl3 protocol module), 5b (state-machine variants), 5c (config), 5d (main wiring), 5e (hardware validation). Hardware-validated 2026-04-27: Play/Stop toggle drives LUNA, jog encoder nudges bars, LED follows state, encoder during playback ignored, sync-on-stop still fires. 122 unit tests passing. |
| Phase 6: Web Control Interface | Planned | Embedded htmx + axum web UI on `http://127.0.0.1:8765`, auto-opened on startup. Live MIDI port pickers, in-process config reload, transport status readout, SSE event stream, hold-to-confirm HALT. "Studio Rack Utility" aesthetic. Distribution work (.pkg, launchd, signing) is a separate follow-on feature. Design captured in [web-ui-design.md](web-ui-design.md). |
| Phase 7: MIDI Subsystem Abstraction + Hot-Plug | Planned | `MidiSubsystem` trait isolates CoreMIDI/midir behind a single boundary so future Linux/Windows hot-plug work is purely additive. macOS `CoreMidiSubsystem` subscribes to `MIDIClientCreateWithBlock` notifications; topology changes push a named SSE event to the browser. UI shows an opt-in "PORTS UPDATED — REFRESH" pill that the user clicks to refresh dropdown options in place, preserving selected values and in-flight edits. |
| Phase 8: Brand Alignment + Status Wiring | Planned | Fixes Phase 6 UI: the visible transport readout / routing matrix LEDs / master LED don't update (they're hardcoded; status only fetched once). 8a wires `/api/status` polling with OOB swaps so live state reaches the visible UI. 8b copies audiocontrol.org's canonical `design-tokens.css` ("service-manual / flight-instrumentation" — warm-ink background, phosphor amber, Departure Mono headlines, IBM Plex Sans body, JetBrains Mono numerics, `.signal-led` / `.dimension-bracket` / `.card-glow` / atmospheric-grain utility classes) into the bridge bundle so the embedded UI reads as part of the parent product. |

## Documentation

- [PRD](prd.md)
- [Workplan](workplan.md)
- [Implementation Summary](implementation-summary.md)
- [LCXL3 handshake trace](lcxl3-handshake-trace.md) — annotated decode of the captured Live → LCXL3 init sequence (Phase 5 reference)
- [Web UI design](web-ui-design.md) — UX/UI specification for the Phase 6 embedded control interface

## GitHub Tracking

- Phases 1-2 Pull Request: [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged)
- Phases 3-4 Pull Request: [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317) (merged)
- Tolerance fix Pull Request: [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318) (merged)
- Idle byte-trace Pull Request: [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319) (merged)
- Phase 5 Parent Issue: [#320](https://github.com/audiocontrol-org/audiocontrol/issues/320)
- Phase 5a–5e Issues: [#321](https://github.com/audiocontrol-org/audiocontrol/issues/321), [#322](https://github.com/audiocontrol-org/audiocontrol/issues/322), [#323](https://github.com/audiocontrol-org/audiocontrol/issues/323), [#324](https://github.com/audiocontrol-org/audiocontrol/issues/324), [#325](https://github.com/audiocontrol-org/audiocontrol/issues/325)
- Phase 5 + Ableton Pull Request: [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326) (merged)
- Phase 6 Parent Issue: [#327](https://github.com/audiocontrol-org/audiocontrol/issues/327)
- Phase 6a–6i Issues: [#328](https://github.com/audiocontrol-org/audiocontrol/issues/328), [#329](https://github.com/audiocontrol-org/audiocontrol/issues/329), [#330](https://github.com/audiocontrol-org/audiocontrol/issues/330), [#331](https://github.com/audiocontrol-org/audiocontrol/issues/331), [#332](https://github.com/audiocontrol-org/audiocontrol/issues/332), [#333](https://github.com/audiocontrol-org/audiocontrol/issues/333), [#334](https://github.com/audiocontrol-org/audiocontrol/issues/334), [#335](https://github.com/audiocontrol-org/audiocontrol/issues/335), [#336](https://github.com/audiocontrol-org/audiocontrol/issues/336)
- Phase 7 Parent Issue: [#337](https://github.com/audiocontrol-org/audiocontrol/issues/337)
- Phase 7a–7d Issues: [#338](https://github.com/audiocontrol-org/audiocontrol/issues/338), [#339](https://github.com/audiocontrol-org/audiocontrol/issues/339), [#340](https://github.com/audiocontrol-org/audiocontrol/issues/340), [#341](https://github.com/audiocontrol-org/audiocontrol/issues/341)
- Phase 8 Parent Issue: [#342](https://github.com/audiocontrol-org/audiocontrol/issues/342)
- Phase 8a–8c Issues: [#343](https://github.com/audiocontrol-org/audiocontrol/issues/343), [#344](https://github.com/audiocontrol-org/audiocontrol/issues/344), [#345](https://github.com/audiocontrol-org/audiocontrol/issues/345)
- Milestone: TBD
