---
slug: midi-macro-bridge-packaging
title: midi-macro-bridge packaging and release
targetVersion: "1.0"
date: 2026-05-05
parentIssue: 358
deskwork:
  id:
---

# PRD: midi-macro-bridge packaging and release

## Problem Statement

The `midi-macro-bridge` Rust service in `services/midi-macro-bridge/` currently has no packaging or release artifacts. To run it, a user must clone the monorepo, install Rust, run `cargo build --release`, copy `config.example.toml` to `config.toml` in the same directory, and execute the binary from that directory. The binary writes runtime state to `~/Library/Application Support/MidiMacroBridge/url.txt` but reads its config relative to the current working directory, which breaks any installation outside the build tree. There are no GitHub Releases, no tags, no CHANGELOG, and no install path that a non-developer can follow.

This blocks distribution to anyone who isn't already an audiocontrol contributor. A small Rust tool that opens a web UI on `127.0.0.1:8765` and registers a virtual MCU MIDI endpoint should be a `brew install` (or tarball + `install.sh`) away — not a dev-environment setup. The packaging-and-release feature builds that path: a versioned, downloadable, OS-aware artifact pipeline producing macOS Apple Silicon and Linux x86_64 binaries from each tagged release.

## Solution

A **local Makefile + Docker** release pipeline, invoked by the operator on their host with one command (`make release VERSION=vX.Y.Z`). macOS arm64 builds natively via `cargo build --release`. Linux x86_64 builds inside a `rust:slim-bookworm` Docker container so the same operator host can produce both artifacts without provisioning a Linux box. The release script asserts preconditions (`Cargo.toml` version matches `VERSION`, working tree clean, tag doesn't yet exist), runs both builds, executes the macOS smoke test (regression coverage for `MIDI channel disconnected`), creates and pushes the git tag, then calls `gh release create` to upload both tarballs, both per-tarball SHA256s, and an aggregate `SHA256SUMS` file.

Each tarball contains the binary under `bin/`, opt-in service files (launchd plist for macOS, systemd unit for Linux) under `share/`, license + README + CHANGELOG + QUARANTINE doc under `doc/`, and an idempotent `install.sh` at the root.

A separate `audiocontrol-org/homebrew-audiocontrol` tap repo carries a thin formula that downloads the GitHub Release tarball, installs the binary to `bin/`, places `share/` contents under `pkgshare`, and provides a `brew services` integration block. `brew install audiocontrol-org/audiocontrol/midi-macro-bridge` becomes the canonical macOS install path. Linux users either use Homebrew on Linux or extract the tarball manually.

Inside the binary itself, a small refactor introduces a `paths.rs` module that resolves config from `--config` flag → `$MIDI_MACRO_BRIDGE_CONFIG` env → OS-conventional default → cwd fallback. OS defaults are namespaced under `audiocontrol/<service>` so future services in this monorepo don't trample each other. The existing `url.txt` state file relocates to the same namespaced state directory.

**Reshape note**: this solution intentionally drops the originally-planned tag-driven GitHub Actions workflow. Local-build keeps iteration fast (no CI feedback loop), avoids long CI iteration cycles, and is sufficient at the expected v1 release cadence (low). CI can be added later if release frequency grows or contributors need automated builds without the operator being present.

## Acceptance Criteria

- [ ] `make release VERSION=v0.1.0` (run from a clean `main` with `services/midi-macro-bridge/Cargo.toml` version `0.1.0`) creates a GitHub Release with both tarballs, both per-tarball SHA256 files, and an aggregate `SHA256SUMS` file attached — without manual intervention after invocation.
- [ ] The release script refuses to proceed if `Cargo.toml` version disagrees with `VERSION`, working tree is dirty, or the tag already exists locally.
- [ ] The macOS smoke test inside `make release` boots the binary briefly with default config and asserts it stays up — encoding the `MIDI channel disconnected` regression fix from commit `814e7d27` as durable coverage.
- [ ] The macOS tarball, after `xattr -d com.apple.quarantine`, runs the installed binary successfully from a directory other than the build tree.
- [ ] The Linux tarball runs the installed binary successfully on a stock Ubuntu/Debian host (or a privileged Docker container with `/dev/snd`).
- [ ] `brew tap audiocontrol-org/audiocontrol && brew install midi-macro-bridge` succeeds on macOS Apple Silicon, and `brew services start midi-macro-bridge` launches it as a daemon.
- [ ] The installed binary reads its config from the OS-conventional path (`~/Library/Application Support/audiocontrol/midi-macro-bridge/config.toml` on macOS; `~/.config/audiocontrol/midi-macro-bridge/config.toml` on Linux) without `cd`-ing into the install dir.

## Out of Scope

- **GitHub Actions release workflow.** Build and ship are operator-driven from a local host. Revisit if release cadence outgrows the local model.
- ~~macOS code signing and notarization.~~ Implemented in v0.2.0 (Phase 7). Developer ID Application cert + notarytool keychain profile pipeline.
- Crash reporting / telemetry.
- Additional Linux targets: `aarch64-unknown-linux-gnu`, `musl` static variant, AUR `PKGBUILD`, `.deb` / `.rpm` packages.
- Cross-platform Linux binary smoke testing in CI. Linux smoke runs at Phase 6 on a real Linux host or privileged Docker; the Docker builder only validates the build, not the runtime.
- `cargo-release` workflow tooling for local release-cutting ergonomics.
- `git-cliff` automated CHANGELOG generation. Revisit when release cadence makes hand-editing tedious.
- Multi-service tag scheme (`midi-macro-bridge-vX.Y.Z`). Plain `vX.Y.Z` is fine while midi-macro-bridge owns the version namespace; revisit when another service in the repo also wants tagged releases.

### Future phases (deferred from Phase 7 / v0.2.0)

Tracked separately as GitHub issues per Phase 7 AC #9:

- [#368](https://github.com/audiocontrol-org/audiocontrol/issues/368) — Phase 8a: Status bar icon for `MidiMacroBridge.app` (`tray-icon` crate)
- [#369](https://github.com/audiocontrol-org/audiocontrol/issues/369) — Phase 8b: Single-instance lock + focus-existing-window
- [#370](https://github.com/audiocontrol-org/audiocontrol/issues/370) — Phase 8c: Sparkle auto-updater
- [#371](https://github.com/audiocontrol-org/audiocontrol/issues/371) — wry GUI for Linux + Windows distributions
- [#372](https://github.com/audiocontrol-org/audiocontrol/issues/372) — Pretty DMG layout via `create-dmg`
- [#373](https://github.com/audiocontrol-org/audiocontrol/issues/373) — Universal binary (arm64 + Intel)
- [#374](https://github.com/audiocontrol-org/audiocontrol/issues/374) — Real `AppIcon.icns` (replace v0.2 placeholder)
- [#375](https://github.com/audiocontrol-org/audiocontrol/issues/375) — Brew formula bottling the `.app`
- [#376](https://github.com/audiocontrol-org/audiocontrol/issues/376) — Phase 8d: macOS menubar with Quit/About
- Auto-update mechanism (covered by #370 above; no separate item)
- Intel Mac universal binary (covered by #373 above)

## Technical Approach

The release pipeline is operator-driven, invoked via `make release VERSION=vX.Y.Z` from the workspace root on a macOS Apple Silicon host. The macOS arm64 build runs natively on the host. The Linux x86_64 build runs inside a `rust:slim-bookworm` Docker container that bind-mounts the workspace and runs `cargo build --release` — the host doesn't need a Linux toolchain installed. Both builds delegate to the shared `services/midi-macro-bridge/scripts/package.sh` for tarball layout + SHA256 computation. The release script (`services/midi-macro-bridge/scripts/release.sh`) orchestrates: precondition checks → `make package-all` → macOS smoke test → `git tag` + push → `gh release create` with both tarballs, both `.sha256`, and an aggregate `SHA256SUMS`. CHANGELOG.md's `## VERSION` section is extracted as release notes; missing entries fall back to a generic title.

The path-resolution refactor (`services/midi-macro-bridge/src/paths.rs`) wraps the existing `dirs` crate dependency: `dirs::config_dir()` for config, `dirs::data_dir()` for state. Resolution is implemented as a pure function that takes closures for env/home/cwd/exists lookups, making it trivially unit-testable with no I/O. The `--config` flag follows the existing argv-parsing style in `main.rs` (`args.iter().position(|a| a == "...")`) — no new dependencies. The cwd-relative lookup is preserved as the lowest-precedence fallback so the dev workflow (`cd services/midi-macro-bridge && ./target/release/midi-macro-bridge`) continues to work unchanged.

The Homebrew formula lives in a separate `audiocontrol-org/homebrew-audiocontrol` repo (a Homebrew "tap"). The formula references the GitHub Release URL by `version`, embeds the SHA256, and provides a `service do` block giving users `brew services start midi-macro-bridge` for daemon mode. A helper script (`services/midi-macro-bridge/scripts/update-homebrew-formula.sh`) downloads the published `SHA256SUMS` file, rewrites the formula in place, and exits — leaving the developer to review and push. Automation of the formula update is out of scope for v1; manual is acceptable at the expected release cadence.

Service activation is intentionally opt-in. The bridge is a desktop tool that auto-opens a browser, which doesn't fit a "auto-start on every login" model. The launchd plist and systemd unit ship in `share/` so users who want a daemon can copy them into `~/Library/LaunchAgents/` or `~/.config/systemd/user/`. Homebrew users get `brew services` as a free third option.
