---
slug: midi-macro-bridge-packaging
targetVersion: "1.0"
date: 2026-05-05
branch: feature/midi-macro-bridge-packaging
parentIssue: 358
---

# Feature: midi-macro-bridge packaging and release

Ship per-platform tarballs (`aarch64-apple-darwin`, `x86_64-unknown-linux-gnu`) of the `midi-macro-bridge` Rust service from each `vX.Y.Z` git tag, plus a Homebrew tap for one-command install. Replaces the current "clone the monorepo and `cargo build`" workflow with `brew install midi-macro-bridge` (or a tarball download + `install.sh`), and refactors runtime config/state paths under an OS-conventional `audiocontrol/<service>` namespace so installed binaries don't depend on launch directory.

## Status

| Phase | Description | Status |
|---|---|---|
| 1 | Runtime path resolution (`paths.rs` + `--config` flag + env var + namespaced state dir) | Complete ([#359](https://github.com/audiocontrol-org/audiocontrol/issues/359)) |
| 2 | Tarball assembly (`package.sh`, `install.sh`, launchd plist, systemd unit, QUARANTINE.md, Makefile target) | Not started ([#360](https://github.com/audiocontrol-org/audiocontrol/issues/360)) |
| 3 | Release CI workflow (tag-driven, parallel macOS-14 + ubuntu-latest builds, smoke test, version assertion) | Not started ([#361](https://github.com/audiocontrol-org/audiocontrol/issues/361)) |
| 4 | Homebrew tap (`audiocontrol-org/homebrew-audiocontrol` repo + formula + SHA256 update helper) | Not started ([#362](https://github.com/audiocontrol-org/audiocontrol/issues/362)) |
| 5 | Documentation (README install section, CHANGELOG seed, INSTALL.md service activation steps) | Not started ([#363](https://github.com/audiocontrol-org/audiocontrol/issues/363)) |
| 6 | First release v0.1.0 (workflow_dispatch dry run, tag, end-to-end smoke tests, formula publish) | Not started ([#364](https://github.com/audiocontrol-org/audiocontrol/issues/364)) |

## Key Links

- Branch: `feature/midi-macro-bridge-packaging`
- Worktree: `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging`
- PRD: [prd.md](prd.md)
- Workplan: [workplan.md](workplan.md)
- Parent Issue: [#358](https://github.com/audiocontrol-org/audiocontrol/issues/358)

## Out of Scope (deferred)

- macOS code signing / notarization
- Auto-update
- Crash reporting / telemetry
- AUR / .deb / .rpm packages
- Intel Mac (`x86_64-apple-darwin`) build / universal binary
- Linux aarch64 / `musl` static variant
- `cargo-release` workflow tooling
- `git-cliff` automated CHANGELOG generation
