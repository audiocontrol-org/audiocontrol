# MIDI Macro Bridge

**Branch:** `feature/midi-macro-bridge-ableton`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge`
**Overall Status:** Phases 1-2 shipped via [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316). Phases 3-4 shipped via [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317). Decade-boundary tolerance fix shipped via [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318). Idle byte-trace shipped via [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319). Phase 5 (LCXL3 multi-input) + Ableton compatibility shipped via [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326). Phase 6 (Embedded Web Control Interface) + Phase 8a (SSE-driven live status) shipped via [#346](https://github.com/audiocontrol-org/audiocontrol/pull/346). Phase 7 (MIDI subsystem abstraction + hot-plug) and Phase 8b/c (brand realignment + hardware validation) planned.

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
| Phase 6: Web Control Interface | Complete | Shipped in [#346](https://github.com/audiocontrol-org/audiocontrol/pull/346). Embedded htmx + axum web UI on `http://127.0.0.1:8765`, auto-opened on startup. Live MIDI port pickers, in-process config reload, transport status readout, SSE event stream, hold-to-confirm HALT. Sub-phases 6a (server skeleton + reload), 6b (status APIs), 6c (assets + base layout), 6d (studio-rack stylesheet — superseded by Phase 8b), 6e (config form + APPLY), 6f (event stream UI), 6g (HALT + master LED), 6h (auto-open + first-run polish) all shipped. 6i formal hardware validation deferred — informally validated this session via Playwright snapshots, live SSE inspection, and HALT live-test (LCXL3 deactivation SysEx confirmed firing before exit). 242 unit tests passing. |
| Phase 7: MIDI Subsystem Abstraction + Hot-Plug | Planned | `MidiSubsystem` trait isolates CoreMIDI/midir behind a single boundary so future Linux/Windows hot-plug work is purely additive. macOS `CoreMidiSubsystem` subscribes to `MIDIClientCreateWithBlock` notifications; topology changes push a named SSE event to the browser. UI shows an opt-in "PORTS UPDATED — REFRESH" pill that the user clicks to refresh dropdown options in place, preserving selected values and in-flight edits. |
| Phase 8a: SSE-Driven Live Status | Complete | Shipped in [#346](https://github.com/audiocontrol-org/audiocontrol/pull/346). Replaces Phase 6's hardcoded indicators with push-driven live updates. `SseFrame::StatusUpdated(html)` named SSE event broadcast by a tokio task watching `status_rx.changed()`. Time-elapsed displays tick smoothly client-side via `setInterval` against `data-timestamp` attributes embedded in the payload — no per-second HTTP traffic. Verified via Playwright snapshot showing live port LEDs, transport state, and routing matrix populated from real config. |
| Phase 8b: Brand Realignment | Planned | Copy audiocontrol.org's canonical `design-tokens.css` ("service-manual / flight-instrumentation" — warm-ink background, phosphor amber, Departure Mono headlines, IBM Plex Sans body, JetBrains Mono numerics, `.signal-led` / `.dimension-bracket` / `.card-glow` / atmospheric-grain utility classes) into the bridge bundle so the embedded UI reads as part of the parent product. Supersedes Phase 6d's bespoke "Studio Rack Utility" stylesheet. |
| Phase 8c: Hardware Validation | Planned | End-to-end verification across the rebrand and wiring fixes. |
| Phase 9: LCXL3 DAW Mixer + Plugin Control | Planned | Extends Phase 5's transport-only mapping to the LCXL3's DAW Mixer mode (faders → LUNA channel volume, V-pots → pan, fader buttons → mute/solo/arm/select, banking, LED feedback) and — scope contingent on Phase 9a research — the LCXL3's plugin-parameter control. Requires research on LCXL3's two DAW sub-modes (DAW Control vs DAW Mixer) and LUNA's MCU mixer/plugin byte vocabulary. Sub-phases: 9a research + profiling, 9b mixer mode implementation, 9c plugin / DAW control extension (scope per 9a), 9d hardware validation. |
| Phase 10: LCXL3 Page-Aware V-Pot Mapping | Planned | Phase 9b mapped all 3 V-pot rows to pan; Phase 10 implements Page Up/Down navigation that determines what the top two V-pot rows control. Page 0 (default) = Row 1 Trim, Row 2 Tape saturation; Pages 1-4 = paired Sends. Bottom row always Pan. DAW Control mode V-pots map to EQ / focused-plugin per LCXL3 reference. Single LCXL3 LCD mirrors LUNA's parameter-display SysEx (Live/Logic style — name + value of adjusting control). Sub-phases: 10a drill-down + LCD profiling, 10b page-aware state machine + LCD mirror, 10c hardware validation. Page-state scaffold landed in main.rs; full routing requires 10a profiling. |

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
- Phase 6 + 8a Pull Request: [#346](https://github.com/audiocontrol-org/audiocontrol/pull/346) (merged 2026-04-28)
- Phase 9 Parent Issue: [#347](https://github.com/audiocontrol-org/audiocontrol/issues/347)
- Phase 9a–9d Issues: [#348](https://github.com/audiocontrol-org/audiocontrol/issues/348), [#349](https://github.com/audiocontrol-org/audiocontrol/issues/349), [#350](https://github.com/audiocontrol-org/audiocontrol/issues/350), [#351](https://github.com/audiocontrol-org/audiocontrol/issues/351)
- Phase 10 Parent Issue: [#352](https://github.com/audiocontrol-org/audiocontrol/issues/352)
- Phase 10a–10c Issues: [#353](https://github.com/audiocontrol-org/audiocontrol/issues/353), [#354](https://github.com/audiocontrol-org/audiocontrol/issues/354), [#355](https://github.com/audiocontrol-org/audiocontrol/issues/355)
- Milestone: TBD
