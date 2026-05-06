# Changelog

All notable changes to `midi-macro-bridge` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v0.3.0

### Highlights
- **macOS app polish**: persistent menubar status bar icon, single-instance lock (second launch focuses the existing window), proper macOS app menubar with Cmd-Q / Cmd-W / Cmd-, accelerators and a native About panel.
- **Brand mark**: pixel-grid "M" glyph mirroring the audiocontrol.org family — phosphor amber on warm-ink, 2×2-pixel cells on a centered grid. Replaces the Phase 7 placeholder icon. New status bar icon is a macOS template image (auto-tinted by the system per menubar appearance).
- **Web UI cleanup**: removed the HALT button (bad hold-to-confirm UX, redundant in v0.2.0+ where window-close already triggers graceful shutdown). The `POST /api/halt` route remains as an undocumented curl escape hatch.
- **Version string**: web UI now reads from `CARGO_PKG_VERSION` at server startup instead of the hardcoded `v1.0` literal.
- **Tooling fix**: `update-homebrew-formula.sh` now does structure-aware sha256 substitution and fails loudly if it can't match — previously silently shipped stale SHAs on subsequent releases.

### Notes
- The window now hides on close instead of exiting. Use the status bar icon's "Quit" or Cmd-Q to fully exit.
- Headless / brew-services modes unchanged — status bar icon, single-instance, and menubar are macOS GUI-only.
- Subsumes the originally-planned v0.2.1; Phase 9 fixes ship as part of this release.

## v0.2.0

### Highlights
- macOS `.app` distribution via signed + notarized `.dmg`.
- Native AppKit window via `wry` + `tao` hosts the existing web UI — feels like a real Mac app, not a browser tab.
- New `--gui` and `--no-gui` flags; bundle context auto-detected.
- Reuses midi-server's macOS code-signing infrastructure (no duplication).

### Notes
- The `.app` is interactive-launch-only by design. For daemon / always-on use, the Homebrew + `brew services` install path remains.
- Linux + Windows GUI is supported by `wry` but out of scope for this release.
- v0.2.0 ships a placeholder app icon; a real icon is planned for a later release.

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
