---
slug: midi-macro-bridge-packaging
targetVersion: "1.0"
date: 2026-05-05
branch: feature/midi-macro-bridge-packaging
parentIssue: 358
---

# Feature: midi-macro-bridge packaging and release

Ship per-platform tarballs (`aarch64-apple-darwin`, `x86_64-unknown-linux-gnu`) of the `midi-macro-bridge` Rust service for each `vX.Y.Z` release, plus a Homebrew tap for one-command install. Replaces the current "clone the monorepo and `cargo build`" workflow with `brew install midi-macro-bridge` (or a tarball download + `install.sh`), and refactors runtime config/state paths under an OS-conventional `audiocontrol/<service>` namespace so installed binaries don't depend on launch directory.

Build and release happen **locally** via Makefile + Docker (no GitHub Actions); the operator runs `make release VERSION=v0.1.0` on their host to assemble both tarballs (macOS arm64 native; Linux x86_64 via Docker), run smoke tests, tag, and upload via `gh release create`. This is an explicit scope reshape from the original tag-driven CI design — see issues [#361](https://github.com/audiocontrol-org/audiocontrol/issues/361) and [#358](https://github.com/audiocontrol-org/audiocontrol/issues/358) for context.

## Status

| Phase | Description | Status |
|---|---|---|
| 1 | Runtime path resolution (`paths.rs` + `--config` flag + env var + namespaced state dir) | Complete ([#359](https://github.com/audiocontrol-org/audiocontrol/issues/359)) |
| 2 | Tarball assembly (`package.sh`, `install.sh`, launchd plist, systemd unit, QUARANTINE.md, Makefile target) | Complete ([#360](https://github.com/audiocontrol-org/audiocontrol/issues/360)) |
| 3 | Local release build — Linux Docker builder + `make package-{macos,linux,all}` targets, host-driven smoke tests, SHA256SUMS aggregation | Not started ([#366](https://github.com/audiocontrol-org/audiocontrol/issues/366) — replaces closed [#361](https://github.com/audiocontrol-org/audiocontrol/issues/361)) |
| 4 | Homebrew tap (`audiocontrol-org/homebrew-audiocontrol` repo + formula + SHA256 update helper) | Not started ([#362](https://github.com/audiocontrol-org/audiocontrol/issues/362)) |
| 5 | Documentation (README install section, CHANGELOG seed, INSTALL.md service activation steps) | Not started ([#363](https://github.com/audiocontrol-org/audiocontrol/issues/363)) |
| 6 | First release v0.1.0 — operator-driven `make release VERSION=v0.1.0` (build → smoke → tag → upload via `gh release create`) | Not started ([#364](https://github.com/audiocontrol-org/audiocontrol/issues/364)) |

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
