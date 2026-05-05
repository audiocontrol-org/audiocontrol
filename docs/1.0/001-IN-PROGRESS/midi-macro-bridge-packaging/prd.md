---
slug: midi-macro-bridge-packaging
title: midi-macro-bridge packaging and release
targetVersion: "1.0"
date: 2026-05-05
parentIssue: TBD
deskwork:
  id:
---

# PRD: midi-macro-bridge packaging and release

## Problem Statement

The `midi-macro-bridge` Rust service in `services/midi-macro-bridge/` currently has no packaging or release artifacts. To run it, a user must clone the monorepo, install Rust, run `cargo build --release`, copy `config.example.toml` to `config.toml` in the same directory, and execute the binary from that directory. The binary writes runtime state to `~/Library/Application Support/MidiMacroBridge/url.txt` but reads its config relative to the current working directory, which breaks any installation outside the build tree. There are no GitHub Releases, no tags, no CHANGELOG, and no install path that a non-developer can follow.

This blocks distribution to anyone who isn't already an audiocontrol contributor. A small Rust tool that opens a web UI on `127.0.0.1:8765` and registers a virtual MCU MIDI endpoint should be a `brew install` (or tarball + `install.sh`) away — not a dev-environment setup. The packaging-and-release feature builds that path: a versioned, downloadable, OS-aware artifact pipeline producing macOS Apple Silicon and Linux x86_64 binaries from each tagged release.

## Solution

A tag-driven GitHub Actions workflow on this repo produces two artifact tarballs per `vX.Y.Z` tag — one for `aarch64-apple-darwin` (built on a `macos-14` runner), one for `x86_64-unknown-linux-gnu` (built on `ubuntu-latest`). Each tarball contains the binary under `bin/`, opt-in service files (launchd plist for macOS, systemd unit for Linux) under `share/`, license + README + CHANGELOG + QUARANTINE doc under `doc/`, and an idempotent `install.sh` at the root. The workflow attaches the tarballs, per-tarball SHA256s, and an aggregate `SHA256SUMS` file to a GitHub Release.

A separate `audiocontrol-org/homebrew-audiocontrol` tap repo carries a thin formula that downloads the GitHub Release tarball, installs the binary to `bin/`, places `share/` contents under `pkgshare`, and provides a `brew services` integration block. `brew install audiocontrol-org/audiocontrol/midi-macro-bridge` becomes the canonical macOS install path. Linux users either use Homebrew on Linux or extract the tarball manually.

Inside the binary itself, a small refactor introduces a `paths.rs` module that resolves config from `--config` flag → `$MIDI_MACRO_BRIDGE_CONFIG` env → OS-conventional default → cwd fallback. OS defaults are namespaced under `audiocontrol/<service>` so future services in this monorepo don't trample each other. The existing `url.txt` state file relocates to the same namespaced state directory.

## Acceptance Criteria

- [ ] Pushing tag `v0.1.0` on `main` (with `services/midi-macro-bridge/Cargo.toml` version `0.1.0`) creates a GitHub Release with both tarballs, both per-tarball SHA256 files, and an aggregate `SHA256SUMS` file attached automatically.
- [ ] The pre-flight CI job refuses the release if `Cargo.toml` version disagrees with the pushed tag.
- [ ] A smoke test runs in each build job that boots the binary briefly with default config and asserts it stays up — encoding the `MIDI channel disconnected` regression fix from commit `814e7d27` as durable coverage.
- [ ] The macOS tarball, after `xattr -d com.apple.quarantine`, runs the installed binary successfully from a directory other than the build tree.
- [ ] The Linux tarball runs the installed binary successfully on a stock Ubuntu/Debian host.
- [ ] `brew tap audiocontrol-org/audiocontrol && brew install midi-macro-bridge` succeeds on macOS Apple Silicon, and `brew services start midi-macro-bridge` launches it as a daemon.
- [ ] The installed binary reads its config from the OS-conventional path (`~/Library/Application Support/audiocontrol/midi-macro-bridge/config.toml` on macOS; `~/.config/audiocontrol/midi-macro-bridge/config.toml` on Linux) without `cd`-ing into the install dir.

## Out of Scope

- macOS code signing and notarization. Released binaries will be unsigned for v1; `QUARANTINE.md` documents the `xattr -d com.apple.quarantine` workaround. Revisit when there's user demand and an Apple Developer Program membership.
- Auto-update mechanism.
- Crash reporting / telemetry.
- Additional Linux targets: `aarch64-unknown-linux-gnu`, `musl` static variant, AUR `PKGBUILD`, `.deb` / `.rpm` packages.
- Intel Mac (`x86_64-apple-darwin`) build / universal binary.
- `cargo-release` workflow tooling for local release-cutting ergonomics.
- `git-cliff` automated CHANGELOG generation. Revisit when release cadence makes hand-editing tedious.
- Multi-service tag scheme (`midi-macro-bridge-vX.Y.Z`). Plain `vX.Y.Z` is fine while midi-macro-bridge owns the version namespace; revisit when another service in the repo also wants tagged releases.

## Technical Approach

The release CI uses GitHub-hosted runners exclusively — no local cross-compilation. The macOS arm64 build runs natively on `macos-14`, the Linux x86_64 build runs natively on `ubuntu-latest`. Each runner runs `cargo build --release`, then a shared `services/midi-macro-bridge/scripts/package.sh` script that assembles the tarball layout and computes SHA256. A final release job downloads both runners' artifacts and calls `gh release create` with a CHANGELOG excerpt as release notes.

The path-resolution refactor (`services/midi-macro-bridge/src/paths.rs`) wraps the existing `dirs` crate dependency: `dirs::config_dir()` for config, `dirs::data_dir()` for state. Resolution is implemented as a pure function that takes closures for env/home/cwd/exists lookups, making it trivially unit-testable with no I/O. The `--config` flag follows the existing argv-parsing style in `main.rs` (`args.iter().position(|a| a == "...")`) — no new dependencies. The cwd-relative lookup is preserved as the lowest-precedence fallback so the dev workflow (`cd services/midi-macro-bridge && ./target/release/midi-macro-bridge`) continues to work unchanged.

The Homebrew formula lives in a separate `audiocontrol-org/homebrew-audiocontrol` repo (a Homebrew "tap"). The formula references the GitHub Release URL by `version`, embeds the SHA256, and provides a `service do` block giving users `brew services start midi-macro-bridge` for daemon mode. A helper script (`services/midi-macro-bridge/scripts/update-homebrew-formula.sh`) downloads the published `SHA256SUMS` file, rewrites the formula in place, and exits — leaving the developer to review and push. Automation of the formula update is out of scope for v1; manual is acceptable at the expected release cadence.

Service activation is intentionally opt-in. The bridge is a desktop tool that auto-opens a browser, which doesn't fit a "auto-start on every login" model. The launchd plist and systemd unit ship in `share/` so users who want a daemon can copy them into `~/Library/LaunchAgents/` or `~/.config/systemd/user/`. Homebrew users get `brew services` as a free third option.
