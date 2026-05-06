# Changelog

All notable changes to `midi-macro-bridge` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v0.1.0

First public release.

### Highlights
- macOS Apple Silicon and Linux x86_64 binary tarballs.
- Homebrew tap (`audiocontrol-org/audiocontrol`).
- Opt-in launchd / systemd service templates.
- OS-conventional config + state paths under `audiocontrol/midi-macro-bridge/`.

### Phases included (from feature midi-macro-bridge in the audiocontrol monorepo)
- Phase 1–2: MC-500 → LUNA transport bridge.
- Phase 3–4: MCU transport with closed-loop locate.
- Phase 5: LCXL3 multi-input + Ableton compat.
- Phase 6: Embedded web control interface (`http://127.0.0.1:8765`).
- Phase 8a: SSE-driven live status.
- Phase 9: LCXL3 DAW Mixer + plug-in control.
- Phase 10 (scaffolding): Page-aware V-pot mapping.

### Known limitations
- Binaries are unsigned. macOS users may need the quarantine workaround.
- LUNA does not accept Song Position Pointer; absolute locate to LUNA isn't possible.
- Linux: midir's virtual MCU endpoints have ephemeral UniqueIDs.
