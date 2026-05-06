---
slug: midi-macro-bridge-packaging
targetVersion: "1.0"
date: 2026-05-05
deskwork:
  id: df280d9f-17eb-4193-987d-942dc40492c9
---

# midi-macro-bridge Packaging — Implementation Workplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-platform tarballs (`aarch64-apple-darwin`, `x86_64-unknown-linux-gnu`) of the `midi-macro-bridge` Rust service from each `vX.Y.Z` git tag, plus a Homebrew tap for one-command install.

**Architecture:** Tag push → GitHub Actions parallel build on macOS-14 + ubuntu-latest → tarball assembly script produces `bin/`, `share/`, `doc/` layout → `gh release create` publishes artifacts. A separate `audiocontrol-org/homebrew-audiocontrol` repo hosts the formula. Runtime config/state paths refactored to OS-conventional `audiocontrol/<service>` directories so installed binaries don't depend on launch directory.

**Tech Stack:** Rust 1.70+, `dirs` crate (already a dep) for OS-conventional paths, GitHub Actions, Homebrew Ruby DSL, bash for assembly script.

---

## File Structure

| Path | Responsibility | Phase |
|---|---|---|
| `services/midi-macro-bridge/src/paths.rs` | Resolve config + state paths from flag / env / OS-default / cwd | 1 |
| `services/midi-macro-bridge/src/main.rs` | Wire `--config` flag, env var, paths module | 1 |
| `services/midi-macro-bridge/scripts/package.sh` | Assemble tarball from `cargo build --release` | 2 |
| `services/midi-macro-bridge/scripts/install.sh` | Idempotent install copy embedded in tarball | 2 |
| `services/midi-macro-bridge/share/launchd/com.audiocontrol.midi-macro-bridge.plist` | macOS LaunchAgent template | 2 |
| `services/midi-macro-bridge/share/systemd/midi-macro-bridge.service` | Linux systemd user unit | 2 |
| `services/midi-macro-bridge/QUARANTINE.md` | Unsigned-binary recovery on macOS | 2 |
| `services/midi-macro-bridge/Makefile` | Add `package` target | 2 |
| `.github/workflows/midi-macro-bridge-release.yml` | CI release pipeline | 3 |
| `audiocontrol-org/homebrew-audiocontrol/Formula/midi-macro-bridge.rb` | Homebrew formula (separate repo) | 4 |
| `services/midi-macro-bridge/scripts/update-homebrew-formula.sh` | SHA256 update helper for the formula | 4 |
| `services/midi-macro-bridge/README.md` | Install instructions | 5 |
| `services/midi-macro-bridge/CHANGELOG.md` | Hand-edited release notes | 5 |
| `services/midi-macro-bridge/INSTALL.md` | Opt-in service activation steps | 5 |

---

## Phase 1: Runtime Path Resolution

The bridge currently looks for `config.toml` relative to cwd and writes `url.txt` to `~/Library/Application Support/MidiMacroBridge/`. After this phase: a deterministic resolution chain (`--config` flag → env → OS-conventional → cwd fallback) under the `audiocontrol/<service>` namespace.

### Task 1.1: Define the path resolution module (TDD)

**Files:**
- Create: `services/midi-macro-bridge/src/paths.rs`
- Test: same file, `#[cfg(test)] mod tests`

- [x] **Step 1: Write failing tests for `resolve_config_path`**

Add to `services/midi-macro-bridge/src/paths.rs`:

```rust
//! Resolves config and state paths for the bridge.
//!
//! Resolution order for config:
//!   1. Explicit path argument (e.g., from --config CLI flag)
//!   2. `MIDI_MACRO_BRIDGE_CONFIG` environment variable
//!   3. OS-conventional default under `audiocontrol/midi-macro-bridge/`
//!   4. cwd-relative `config.toml` (legacy / dev fallback)
//!
//! State directory uses the same `audiocontrol/midi-macro-bridge/` namespace
//! under `dirs::data_dir()` (Linux: `~/.local/share`, macOS: Application Support).

use std::path::PathBuf;

const APP_NAMESPACE: &str = "audiocontrol";
const APP_NAME: &str = "midi-macro-bridge";
const CONFIG_FILENAME: &str = "config.toml";
const ENV_VAR: &str = "MIDI_MACRO_BRIDGE_CONFIG";

/// Resolve the config file path. The first resolution that yields an existing
/// path wins. If none of flag / env / OS-default / cwd files exist, returns the
/// OS-default path so the caller can produce a consistent "no config found"
/// error message that points the user at the canonical location.
pub fn resolve_config_path(
    flag: Option<&str>,
    env_lookup: impl Fn(&str) -> Option<String>,
    home_lookup: impl Fn() -> Option<PathBuf>,
    cwd_lookup: impl Fn() -> Option<PathBuf>,
    exists: impl Fn(&std::path::Path) -> bool,
) -> PathBuf {
    if let Some(p) = flag {
        return PathBuf::from(p);
    }
    if let Some(p) = env_lookup(ENV_VAR) {
        return PathBuf::from(p);
    }
    if let Some(home) = home_lookup() {
        let default = home
            .join(APP_NAMESPACE)
            .join(APP_NAME)
            .join(CONFIG_FILENAME);
        if exists(&default) {
            return default;
        }
        if let Some(cwd) = cwd_lookup() {
            let cwd_path = cwd.join(CONFIG_FILENAME);
            if exists(&cwd_path) {
                return cwd_path;
            }
        }
        return default;
    }
    cwd_lookup()
        .map(|c| c.join(CONFIG_FILENAME))
        .unwrap_or_else(|| PathBuf::from(CONFIG_FILENAME))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn home() -> Option<PathBuf> {
        Some(PathBuf::from("/home/test/.config"))
    }
    fn cwd() -> Option<PathBuf> {
        Some(PathBuf::from("/work"))
    }
    fn no_files(_p: &Path) -> bool {
        false
    }
    fn all_files(_p: &Path) -> bool {
        true
    }

    #[test]
    fn flag_wins_over_everything() {
        let p = resolve_config_path(
            Some("/explicit/path/config.toml"),
            |_| Some("/env/path".into()),
            home,
            cwd,
            all_files,
        );
        assert_eq!(p, PathBuf::from("/explicit/path/config.toml"));
    }

    #[test]
    fn env_wins_over_defaults() {
        let p = resolve_config_path(
            None,
            |k| {
                if k == ENV_VAR {
                    Some("/env/path/config.toml".into())
                } else {
                    None
                }
            },
            home,
            cwd,
            all_files,
        );
        assert_eq!(p, PathBuf::from("/env/path/config.toml"));
    }

    #[test]
    fn os_default_when_it_exists() {
        let p = resolve_config_path(None, |_| None, home, cwd, |path| {
            path == Path::new("/home/test/.config/audiocontrol/midi-macro-bridge/config.toml")
        });
        assert_eq!(
            p,
            PathBuf::from("/home/test/.config/audiocontrol/midi-macro-bridge/config.toml")
        );
    }

    #[test]
    fn cwd_fallback_when_os_default_missing() {
        let p = resolve_config_path(None, |_| None, home, cwd, |path| {
            path == Path::new("/work/config.toml")
        });
        assert_eq!(p, PathBuf::from("/work/config.toml"));
    }

    #[test]
    fn returns_os_default_when_nothing_exists() {
        let p = resolve_config_path(None, |_| None, home, cwd, no_files);
        assert_eq!(
            p,
            PathBuf::from("/home/test/.config/audiocontrol/midi-macro-bridge/config.toml")
        );
    }
}
```

- [x] **Step 2: Run tests and verify they fail to compile**

Run: `cd services/midi-macro-bridge && cargo test --lib paths 2>&1 | head -30`

Expected: compile error — `paths` module not yet declared in `lib.rs` / `main.rs`.

- [x] **Step 3: Wire the module**

Edit `services/midi-macro-bridge/src/main.rs`. Find the existing `mod` declarations (typically near the top after `use` statements) and add:

```rust
mod paths;
```

- [x] **Step 4: Run tests and verify they pass**

Run: `cd services/midi-macro-bridge && cargo test paths`

Expected: 5 passed.

- [x] **Step 5: Add `resolve_state_dir` (TDD)**

Append to `services/midi-macro-bridge/src/paths.rs`:

```rust
/// Resolve the state directory (where url.txt and similar runtime files
/// are written). Always returns a path; caller is responsible for creating
/// the directory if needed.
pub fn resolve_state_dir(data_lookup: impl Fn() -> Option<PathBuf>) -> Option<PathBuf> {
    data_lookup().map(|d| d.join(APP_NAMESPACE).join(APP_NAME))
}
```

Add tests:

```rust
    #[test]
    fn state_dir_is_namespaced() {
        let p = resolve_state_dir(|| Some(PathBuf::from("/home/test/.local/share")));
        assert_eq!(
            p,
            Some(PathBuf::from("/home/test/.local/share/audiocontrol/midi-macro-bridge"))
        );
    }

    #[test]
    fn state_dir_returns_none_when_data_dir_missing() {
        let p = resolve_state_dir(|| None);
        assert_eq!(p, None);
    }
```

Run: `cd services/midi-macro-bridge && cargo test paths`. Expected: 7 passed.

- [x] **Step 6: Commit**

```bash
git add services/midi-macro-bridge/src/paths.rs services/midi-macro-bridge/src/main.rs
git commit -m "feat(midi-macro-bridge): add paths module for config/state resolution"
```

### Task 1.2: Wire `--config` flag and env var into main

**Files:**
- Modify: `services/midi-macro-bridge/src/main.rs`

The bridge uses hand-rolled `args.iter().position(...)` argv parsing (see existing `--probe-mcu`, `--list-ports` patterns). Follow the same style for `--config`.

- [x] **Step 1: Locate the config-load site**

Run: `grep -n "config.toml\|Config::load\|fn load" services/midi-macro-bridge/src/main.rs | head -10`

Note the line numbers where config is loaded; you'll modify that block.

- [x] **Step 2: Replace the config load with the resolution chain**

Find the config load (probably near startup, looks like `Config::load_from_path("config.toml")` or similar). Replace it with:

```rust
let config_path = paths::resolve_config_path(
    args.iter()
        .position(|a| a == "--config")
        .and_then(|i| args.get(i + 1))
        .map(|s| s.as_str()),
    |k| std::env::var(k).ok(),
    || dirs::config_dir(),
    || std::env::current_dir().ok(),
    |p| p.exists(),
);
let config = Config::load_from_path(&config_path).unwrap_or_else(|e| {
    warn!(
        path = %config_path.display(),
        error = ?e,
        "config file not found — running with defaults. \
         See services/midi-macro-bridge/config.example.toml."
    );
    Config::default()
});
```

(Adapt the exact API call to whatever `Config::load_from_path` is named — check `src/config.rs`.)

- [x] **Step 3: Update the existing `path=config.toml` log statement**

The current WARN logs `path=config.toml`. Update it to log the resolved path so users know where the bridge actually looked. The replacement above already does this.

- [x] **Step 4: Compile**

Run: `cd services/midi-macro-bridge && cargo build`. Expected: clean build.

- [x] **Step 5: Smoke test the flag**

```bash
cd services/midi-macro-bridge
./target/debug/midi-macro-bridge --config /tmp/nonexistent.toml &
PID=$!
sleep 1
kill $PID 2>/dev/null
```

Expected log line: `path=/tmp/nonexistent.toml` (resolved path is the explicit flag).

- [x] **Step 6: Smoke test the env var**

```bash
MIDI_MACRO_BRIDGE_CONFIG=/tmp/from-env.toml ./target/debug/midi-macro-bridge &
PID=$!
sleep 1
kill $PID 2>/dev/null
```

Expected log line: `path=/tmp/from-env.toml`.

- [x] **Step 7: Commit**

```bash
git add services/midi-macro-bridge/src/main.rs
git commit -m "feat(midi-macro-bridge): wire --config flag and MIDI_MACRO_BRIDGE_CONFIG env var"
```

### Task 1.3: Migrate `url.txt` writer to namespaced state dir

**Files:**
- Modify: `services/midi-macro-bridge/src/main.rs` (the url.txt write site)

- [x] **Step 1: Locate the url.txt write**

Run: `grep -n "url.txt\|MidiMacroBridge\|Application Support" services/midi-macro-bridge/src/main.rs`.

You should see the existing `~/Library/Application Support/MidiMacroBridge/url.txt` writer.

- [x] **Step 2: Replace with `resolve_state_dir`**

Replace the hardcoded `MidiMacroBridge` directory with:

```rust
if let Some(state_dir) = paths::resolve_state_dir(|| dirs::data_dir()) {
    if let Err(e) = std::fs::create_dir_all(&state_dir) {
        warn!(path = %state_dir.display(), error = ?e, "could not create state dir");
    } else {
        let url_file = state_dir.join("url.txt");
        if let Err(e) = std::fs::write(&url_file, format!("http://127.0.0.1:{port}\n")) {
            warn!(path = %url_file.display(), error = ?e, "could not write url.txt");
        } else {
            info!(path = %url_file.display(), "bridge URL written");
        }
    }
}
```

(Adapt port variable and existing logic — preserve any in-flight behavior beyond just the path.)

- [x] **Step 3: Build + smoke test**

```bash
cd services/midi-macro-bridge
cargo build
./target/debug/midi-macro-bridge &
PID=$!
sleep 1
ls -la ~/Library/Application\ Support/audiocontrol/midi-macro-bridge/url.txt
kill $PID 2>/dev/null
```

Expected: file exists at the new path.

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/src/main.rs
git commit -m "refactor(midi-macro-bridge): namespace state dir under audiocontrol/midi-macro-bridge"
```

### Task 1.4: Document path conventions in config.example.toml

**Files:**
- Modify: `services/midi-macro-bridge/config.example.toml`

- [x] **Step 1: Add a header block**

Prepend:

```toml
# midi-macro-bridge config
#
# This file is read from one of these locations, in order:
#   1. Path passed via --config <path> on the command line
#   2. $MIDI_MACRO_BRIDGE_CONFIG environment variable
#   3. OS-conventional default:
#        macOS: ~/Library/Application Support/audiocontrol/midi-macro-bridge/config.toml
#        Linux: ~/.config/audiocontrol/midi-macro-bridge/config.toml
#   4. ./config.toml (current working directory — dev fallback)
#
# To install for the current user:
#   mkdir -p ~/.config/audiocontrol/midi-macro-bridge   # Linux
#   mkdir -p ~/Library/Application\ Support/audiocontrol/midi-macro-bridge   # macOS
#   cp config.example.toml <path-above>/config.toml
```

- [x] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/config.example.toml
git commit -m "docs(midi-macro-bridge): document config path resolution"
```

---

## Phase 2: Tarball Assembly

Build a script that produces a per-platform tarball locally. Drives the same layout the CI workflow will produce.

### Task 2.1: Author the launchd plist + systemd unit + QUARANTINE doc

**Files:**
- Create: `services/midi-macro-bridge/share/launchd/com.audiocontrol.midi-macro-bridge.plist`
- Create: `services/midi-macro-bridge/share/systemd/midi-macro-bridge.service`
- Create: `services/midi-macro-bridge/QUARANTINE.md`

- [x] **Step 1: Write the launchd plist**

Create `services/midi-macro-bridge/share/launchd/com.audiocontrol.midi-macro-bridge.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.audiocontrol.midi-macro-bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/midi-macro-bridge</string>
        <string>--no-open</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/midi-macro-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/midi-macro-bridge.log</string>
</dict>
</plist>
```

- [x] **Step 2: Write the systemd user unit**

Create `services/midi-macro-bridge/share/systemd/midi-macro-bridge.service`:

```ini
[Unit]
Description=midi-macro-bridge — translate MIDI events into keystrokes/macros
Documentation=https://github.com/audiocontrol-org/audiocontrol
After=sound.target

[Service]
Type=simple
ExecStart=/usr/local/bin/midi-macro-bridge --no-open
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
```

- [x] **Step 3: Write QUARANTINE.md**

Create `services/midi-macro-bridge/QUARANTINE.md`:

```markdown
# macOS quarantine workaround

Releases of `midi-macro-bridge` are not (yet) signed and notarized with an
Apple Developer ID. macOS Gatekeeper applies the `com.apple.quarantine`
attribute to anything downloaded via a browser, blocking unsigned binaries
with: "midi-macro-bridge cannot be opened because the developer cannot be
verified."

To run an unsigned release tarball:

    xattr -d com.apple.quarantine /usr/local/bin/midi-macro-bridge

Or right-click the binary in Finder → Open → Open anyway.

If you installed via Homebrew, the formula's bottle install path bypasses
quarantine on most setups; if you still hit Gatekeeper, run the same
`xattr -d` command against the Cellar binary path that `which midi-macro-bridge`
prints.

Notarization is on the roadmap but deferred until v1.x. Track via the
`midi-macro-bridge-packaging` workplan.
```

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/share services/midi-macro-bridge/QUARANTINE.md
git commit -m "feat(midi-macro-bridge): add service unit templates + quarantine doc"
```

### Task 2.2: Author `package.sh`

**Files:**
- Create: `services/midi-macro-bridge/scripts/package.sh`

- [x] **Step 1: Write the script**

Create `services/midi-macro-bridge/scripts/package.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Assemble a release tarball from a `cargo build --release`.
# Usage:
#   scripts/package.sh --target <triple> --version <vX.Y.Z>
#
# Produces under target/release-package/:
#   midi-macro-bridge-<version>-<triple>.tar.gz
#   midi-macro-bridge-<version>-<triple>.tar.gz.sha256

TRIPLE=""
VERSION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --target) TRIPLE="$2"; shift 2 ;;
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done

[[ -n "$TRIPLE" ]] || { echo "ERROR: --target required" >&2; exit 2; }
[[ -n "$VERSION" ]] || { echo "ERROR: --version required" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: --version must start with 'v' (e.g., v0.1.0)" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$SERVICE_DIR"

NAME="midi-macro-bridge-${VERSION}-${TRIPLE}"
STAGING="target/release-package/${NAME}"
OUT_DIR="target/release-package"
TARBALL="${OUT_DIR}/${NAME}.tar.gz"

echo "→ building release binary for ${TRIPLE}"
cargo build --release

echo "→ staging tarball at ${STAGING}"
rm -rf "${STAGING}"
mkdir -p "${STAGING}/bin" "${STAGING}/share/midi-macro-bridge" "${STAGING}/doc"

cp target/release/midi-macro-bridge "${STAGING}/bin/"
cp config.example.toml "${STAGING}/share/midi-macro-bridge/"

case "$TRIPLE" in
    *-apple-darwin)
        cp -R share/launchd "${STAGING}/share/midi-macro-bridge/"
        cp QUARANTINE.md "${STAGING}/doc/"
        ;;
    *-linux-*)
        cp -R share/systemd "${STAGING}/share/midi-macro-bridge/"
        ;;
esac

cp README.md "${STAGING}/doc/"
[[ -f CHANGELOG.md ]] && cp CHANGELOG.md "${STAGING}/doc/"
[[ -f INSTALL.md ]]   && cp INSTALL.md   "${STAGING}/doc/"

# Permissive-licence files live at the repo root.
WORKSPACE_ROOT="$(cd ../.. && pwd -P)"
[[ -f "${WORKSPACE_ROOT}/LICENSE-MIT" ]]    && cp "${WORKSPACE_ROOT}/LICENSE-MIT"    "${STAGING}/doc/"
[[ -f "${WORKSPACE_ROOT}/LICENSE-APACHE" ]] && cp "${WORKSPACE_ROOT}/LICENSE-APACHE" "${STAGING}/doc/"

cp scripts/install.sh "${STAGING}/install.sh"
chmod +x "${STAGING}/install.sh"

echo "→ creating ${TARBALL}"
tar -C "${OUT_DIR}" -czf "${TARBALL}" "${NAME}"

if command -v shasum >/dev/null 2>&1; then
    SHASUM="shasum -a 256"
else
    SHASUM="sha256sum"
fi
( cd "${OUT_DIR}" && ${SHASUM} "${NAME}.tar.gz" > "${NAME}.tar.gz.sha256" )

echo "✓ ${TARBALL}"
echo "✓ ${TARBALL}.sha256 ($(cat ${TARBALL}.sha256))"
```

Make it executable:

```bash
chmod +x services/midi-macro-bridge/scripts/package.sh
```

- [x] **Step 2: Author install.sh**

Create `services/midi-macro-bridge/scripts/install.sh`:

```bash
#!/usr/bin/env bash
# Installs midi-macro-bridge from this tarball to /usr/local or ~/.local.
# Idempotent — replaces an existing install.
set -euo pipefail

PREFIX="${PREFIX:-}"
if [[ -z "$PREFIX" ]]; then
    if [[ "$EUID" -eq 0 ]]; then
        PREFIX="/usr/local"
    else
        PREFIX="$HOME/.local"
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

mkdir -p "$PREFIX/bin" "$PREFIX/share/midi-macro-bridge" "$PREFIX/share/doc/midi-macro-bridge"

install -m 755 "$SCRIPT_DIR/bin/midi-macro-bridge" "$PREFIX/bin/midi-macro-bridge"
cp -R "$SCRIPT_DIR/share/midi-macro-bridge/." "$PREFIX/share/midi-macro-bridge/"
cp -R "$SCRIPT_DIR/doc/." "$PREFIX/share/doc/midi-macro-bridge/"

echo "✓ installed midi-macro-bridge to $PREFIX/bin/midi-macro-bridge"
echo
echo "Next steps:"
echo "  1. Copy the example config:"
echo "       mkdir -p \$HOME/.config/audiocontrol/midi-macro-bridge"
echo "       cp $PREFIX/share/midi-macro-bridge/config.example.toml \\"
echo "          \$HOME/.config/audiocontrol/midi-macro-bridge/config.toml"
echo "  2. Edit it to your MIDI port names."
echo "  3. Run: midi-macro-bridge"
```

Make it executable:

```bash
chmod +x services/midi-macro-bridge/scripts/install.sh
```

- [x] **Step 3: Run package.sh locally**

```bash
cd services/midi-macro-bridge
./scripts/package.sh --target aarch64-apple-darwin --version v0.0.1-test
```

Expected output ends with:

```
✓ target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin.tar.gz
✓ ...sha256 (<64-hex-chars>  midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin.tar.gz)
```

- [x] **Step 4: Verify the tarball contents**

```bash
tar -tzf target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin.tar.gz | head -20
```

Expected: `bin/midi-macro-bridge`, `share/midi-macro-bridge/config.example.toml`, `share/midi-macro-bridge/launchd/com.audiocontrol.midi-macro-bridge.plist`, `doc/README.md`, `doc/QUARANTINE.md`, `install.sh`.

- [x] **Step 5: Smoke test the binary inside the staging dir**

```bash
cd target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin
./bin/midi-macro-bridge &
PID=$!
sleep 2
kill $PID 2>/dev/null
```

Expected: bridge starts, logs `web server listening url=http://127.0.0.1:8765`, stays up until killed.

- [x] **Step 6: Add `target/release-package/` to .gitignore**

Edit `services/midi-macro-bridge/.gitignore` and append:

```
target/release-package/
```

- [x] **Step 7: Commit**

```bash
git add services/midi-macro-bridge/scripts services/midi-macro-bridge/.gitignore
git commit -m "feat(midi-macro-bridge): add package.sh + install.sh for tarball release"
```

### Task 2.3: Add `package` target to service Makefile

**Files:**
- Modify: `services/midi-macro-bridge/Makefile`

- [x] **Step 1: Add the target**

Append to `services/midi-macro-bridge/Makefile`:

```make
# Build a release tarball for the current host triple. Override TRIPLE/VERSION
# to package for cross-targets (CI passes both explicitly).
TRIPLE ?= $(shell rustc -vV | sed -n 's/^host: //p')
VERSION ?= v0.0.1-dev

package:
	./scripts/package.sh --target $(TRIPLE) --version $(VERSION)
```

Add `package` to the `.PHONY` line (find it near the top of the file).

- [x] **Step 2: Verify**

```bash
make -C services/midi-macro-bridge package VERSION=v0.0.1-test 2>&1 | tail -5
```

Expected: produces a tarball at `target/release-package/`.

- [x] **Step 3: Update help text**

In the Makefile's `help:` target, add a line for `package`.

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/Makefile
git commit -m "feat(midi-macro-bridge): add Makefile package target"
```

---

## Phase 3: Local Release Build (Makefile + Docker)

**Scope reshape from the original "Release CI Workflow"**: build and ship from the operator's host instead of GitHub Actions. macOS arm64 builds natively; Linux x86_64 builds inside a `rust:slim-bookworm` Docker container so the operator doesn't need a Linux box. CI is intentionally out of scope for v1; revisit if release cadence makes local builds tedious.

**Verification trade-off**: the macOS binary smoke test (binary stays up 2s, no `MIDI channel disconnected`) runs natively on the build host. The Linux binary smoke test is **deferred to Phase 6 Task 6.4** (real Linux host or privileged Docker with `/dev/snd`) — midir's ALSA backend won't initialise inside a stock unprivileged container. A future improvement (out of scope here) is to convert the regression check into a `cargo test` unit test so it runs cross-platform without ALSA.

### Task 3.1: Linux Docker builder image

**Files:**
- Create: `services/midi-macro-bridge/Dockerfile.linux-builder`
- Create: `services/midi-macro-bridge/scripts/build-in-docker.sh`

- [x] **Step 1: Author the Dockerfile**

Create `services/midi-macro-bridge/Dockerfile.linux-builder`:

```dockerfile
# Linux x86_64 builder for midi-macro-bridge.
# Pinned to a stable Rust + Debian bookworm so reproducibility doesn't drift.
# Used by `make package-linux` from the host; not intended for runtime use.
FROM rust:1.83-slim-bookworm

# midir's ALSA backend needs libasound2 headers at compile time.
# pkg-config helps the build script find it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      pkg-config \
      libasound2-dev \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Pre-create the workspace mount point so bind-mounts have a target.
WORKDIR /workspace

# Default command is overridden by build-in-docker.sh; keep this minimal.
CMD ["bash"]
```

- [x] **Step 2: Author the build wrapper**

Create `services/midi-macro-bridge/scripts/build-in-docker.sh`:

```bash
#!/usr/bin/env bash
# Build the midi-macro-bridge Linux x86_64 release inside a Docker container,
# then assemble the release tarball via package.sh.
#
# Usage:
#   scripts/build-in-docker.sh --version <vX.Y.Z>
#
# Produces under target/release-package/:
#   midi-macro-bridge-<version>-x86_64-unknown-linux-gnu.tar.gz
#   midi-macro-bridge-<version>-x86_64-unknown-linux-gnu.tar.gz.sha256

set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
WORKSPACE_ROOT="$(cd "$SERVICE_DIR/../.." && pwd -P)"

IMAGE_TAG="midi-macro-bridge-linux-builder:latest"

echo "→ building Docker image $IMAGE_TAG"
docker build \
    -t "$IMAGE_TAG" \
    -f "$SERVICE_DIR/Dockerfile.linux-builder" \
    "$SERVICE_DIR"

echo "→ cargo build --release inside container (target=x86_64-unknown-linux-gnu)"
# Bind-mount the entire workspace so package.sh's workspace-root LICENSE lookup
# also works. The cargo target dir is workspace-internal so artifacts persist.
docker run --rm \
    -v "$WORKSPACE_ROOT":/workspace \
    -w /workspace/services/midi-macro-bridge \
    "$IMAGE_TAG" \
    bash -c "cargo build --release && ./scripts/package.sh --target x86_64-unknown-linux-gnu --version $VERSION"

echo "✓ Linux tarball assembled"
```

- [x] **Step 3: Mark scripts executable**

```bash
chmod +x services/midi-macro-bridge/scripts/build-in-docker.sh
```

- [x] **Step 4: Verify the Docker build end-to-end**

```bash
cd services/midi-macro-bridge
./scripts/build-in-docker.sh --version v0.0.1-test
ls -la target/release-package/midi-macro-bridge-v0.0.1-test-x86_64-unknown-linux-gnu.tar.gz
ls -la target/release-package/midi-macro-bridge-v0.0.1-test-x86_64-unknown-linux-gnu.tar.gz.sha256
tar -tzf target/release-package/midi-macro-bridge-v0.0.1-test-x86_64-unknown-linux-gnu.tar.gz | head -20
```

Expected: tarball exists; contents include `bin/midi-macro-bridge` (Linux ELF), `share/midi-macro-bridge/systemd/midi-macro-bridge.service`, `share/midi-macro-bridge/config.example.toml`, `doc/README.md`, `install.sh`. No `launchd/` or `QUARANTINE.md` (those are macOS-only per package.sh).

Confirm the binary is a Linux ELF, not a Mach-O:

```bash
mkdir -p /tmp/extract-linux
tar -xzf target/release-package/midi-macro-bridge-v0.0.1-test-x86_64-unknown-linux-gnu.tar.gz -C /tmp/extract-linux
file /tmp/extract-linux/midi-macro-bridge-v0.0.1-test-x86_64-unknown-linux-gnu/bin/midi-macro-bridge
rm -rf /tmp/extract-linux
```

Expected output contains `ELF 64-bit LSB executable, x86-64`.

- [x] **Step 5: Commit**

```bash
git add services/midi-macro-bridge/Dockerfile.linux-builder \
        services/midi-macro-bridge/scripts/build-in-docker.sh
git commit -m "feat(midi-macro-bridge): add Linux Docker builder for cross-platform release"
```

### Task 3.2: Makefile per-OS package targets

**Files:**
- Modify: `services/midi-macro-bridge/Makefile`

The existing `package` target builds for the host triple (Task 2.3). Add explicit per-OS targets and an aggregate target that produces both tarballs plus an aggregated `SHA256SUMS` file for release distribution.

- [x] **Step 1: Replace the single `package` block with per-OS targets**

Find the existing `package` block in `services/midi-macro-bridge/Makefile` (added in Task 2.3):

```make
# Build a release tarball for the current host triple. Override TRIPLE/VERSION
# to package for cross-targets (CI passes both explicitly).
TRIPLE ?= $(shell rustc -vV | sed -n 's/^host: //p')
VERSION ?= v0.0.1-dev

package:
	./scripts/package.sh --target $(TRIPLE) --version $(VERSION)
```

Replace with:

```make
# Release packaging.
#   make package-macos VERSION=v0.1.0   builds aarch64-apple-darwin natively
#   make package-linux VERSION=v0.1.0   builds x86_64-unknown-linux-gnu via Docker
#   make package-all   VERSION=v0.1.0   both above + aggregate SHA256SUMS
#
# `package` (no -OS suffix) remains as a host-triple convenience for dev use.
TRIPLE ?= $(shell rustc -vV | sed -n 's/^host: //p')
VERSION ?= v0.0.1-dev

package:
	./scripts/package.sh --target $(TRIPLE) --version $(VERSION)

package-macos:
	./scripts/package.sh --target aarch64-apple-darwin --version $(VERSION)

package-linux:
	./scripts/build-in-docker.sh --version $(VERSION)

package-all: package-macos package-linux
	@cd target/release-package && \
	  rm -f SHA256SUMS && \
	  cat midi-macro-bridge-$(VERSION)-aarch64-apple-darwin.tar.gz.sha256 \
	      midi-macro-bridge-$(VERSION)-x86_64-unknown-linux-gnu.tar.gz.sha256 \
	      > SHA256SUMS
	@echo
	@echo "✓ Release artifacts for $(VERSION):"
	@ls -1 target/release-package/midi-macro-bridge-$(VERSION)-*.tar.gz \
	       target/release-package/midi-macro-bridge-$(VERSION)-*.sha256 \
	       target/release-package/SHA256SUMS
```

Add `package-macos package-linux package-all` to the `.PHONY` line.

- [x] **Step 2: Update help text**

Find the help block. Replace the single `package` line with three lines:

```make
	@echo "  package-macos      assemble macOS arm64 tarball"
	@echo "  package-linux      assemble Linux x86_64 tarball via Docker"
	@echo "  package-all        both, plus aggregate SHA256SUMS"
```

(Drop the original generic `package` help line if it's still there, OR keep it as a host-triple convenience and add a brief note. Both are fine; prefer keeping it since `package` is still in the Makefile.)

- [x] **Step 3: Verify**

```bash
cd services/midi-macro-bridge
rm -rf target/release-package
make package-all VERSION=v0.0.1-test 2>&1 | tail -10
ls -la target/release-package/
```

Expected: two tarballs, two `.sha256`, one `SHA256SUMS` aggregate. The macOS smoke test (Task 2.2 Step 5) is implicit via `package-macos` → `package.sh` (which only builds; the runtime smoke is operator-driven).

Manually run the macOS host-binary smoke test once to satisfy Phase 6 acceptance criterion #5:

```bash
cd target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin
./bin/midi-macro-bridge --no-open >/tmp/smoke-macos.log 2>&1 &
PID=$!
sleep 2.5
if kill -0 $PID 2>/dev/null; then echo "STAY_UP: ok"; else echo "STAY_UP: FAIL"; fi
kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
grep -q "MIDI channel disconnected" /tmp/smoke-macos.log && echo "REGRESSION present" || echo "REGRESSION clean"
```

Expected: `STAY_UP: ok`, `REGRESSION clean`.

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/Makefile
git commit -m "feat(midi-macro-bridge): add per-OS package targets + SHA256SUMS aggregate"
```

### Task 3.3: `make release VERSION=...` end-to-end target

**Files:**
- Modify: `services/midi-macro-bridge/Makefile`

One-shot release flow: assert preconditions, build both tarballs, smoke-test macOS, tag, push, upload via `gh release create`. Operator runs `make release VERSION=v0.1.0` and walks away.

- [x] **Step 1: Add the target**

Append to `services/midi-macro-bridge/Makefile`:

```make
# End-to-end release: build → smoke → tag → upload.
#   make release VERSION=v0.1.0
#
# Preconditions enforced before any work:
#   - VERSION starts with 'v'
#   - Cargo.toml version (without 'v') matches VERSION
#   - working tree clean
#   - on main branch (warns; doesn't block)
#   - origin/main matches local main (warns; doesn't block)
#
# After build + smoke pass, this creates and pushes a git tag, then calls
# `gh release create` with the tarballs + SHA256SUMS attached. Release notes
# are extracted from CHANGELOG.md (`## VERSION` section); falls back to a
# generic title if missing.
release:
	@./scripts/release.sh --version $(VERSION)
```

Add `release` to the `.PHONY` line. Add a help text line:

```make
	@echo "  release VERSION=v0.1.0  end-to-end release: build + smoke + tag + upload"
```

- [x] **Step 2: Author the release script**

Create `services/midi-macro-bridge/scripts/release.sh`:

```bash
#!/usr/bin/env bash
# End-to-end release for midi-macro-bridge.
# See services/midi-macro-bridge/Makefile `release` target for usage.
set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required (e.g., v0.1.0)" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: VERSION must start with 'v'" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
WORKSPACE_ROOT="$(cd "$SERVICE_DIR/../.." && pwd -P)"
cd "$WORKSPACE_ROOT"

VERSION_NO_V="${VERSION#v}"

echo "→ pre-release checks"

CARGO_VERSION="$(grep -E '^version = ' "$SERVICE_DIR/Cargo.toml" | head -1 | awk -F\" '{print $2}')"
if [[ "$CARGO_VERSION" != "$VERSION_NO_V" ]]; then
    echo "ERROR: Cargo.toml version ($CARGO_VERSION) does not match VERSION ($VERSION_NO_V)" >&2
    echo "       Update services/midi-macro-bridge/Cargo.toml first." >&2
    exit 1
fi
echo "  ✓ Cargo.toml version: $CARGO_VERSION"

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: working tree has uncommitted changes" >&2
    git status --short
    exit 1
fi
echo "  ✓ working tree clean"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "  ⚠ on branch '$CURRENT_BRANCH' (not main) — proceeding anyway"
fi

if git show-ref --tags --verify --quiet "refs/tags/$VERSION"; then
    echo "ERROR: tag $VERSION already exists locally" >&2
    exit 1
fi
echo "  ✓ tag $VERSION does not yet exist"

echo "→ building both tarballs"
make -C "$SERVICE_DIR" package-all VERSION="$VERSION"

# macOS smoke test (Phase 6 criterion #5: no `MIDI channel disconnected` within 2s).
STAGED="$SERVICE_DIR/target/release-package/midi-macro-bridge-$VERSION-aarch64-apple-darwin"
if [[ ! -d "$STAGED" ]]; then
    echo "ERROR: macOS staging dir missing: $STAGED" >&2
    exit 1
fi
echo "→ smoke testing macOS binary"
SMOKE_LOG="$(mktemp)"
"$STAGED/bin/midi-macro-bridge" --no-open >"$SMOKE_LOG" 2>&1 &
PID=$!
sleep 2.5
if ! kill -0 "$PID" 2>/dev/null; then
    echo "ERROR: macOS binary exited within 2.5s" >&2
    cat "$SMOKE_LOG" >&2
    exit 1
fi
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
if grep -q "MIDI channel disconnected" "$SMOKE_LOG"; then
    echo "ERROR: regression — 'MIDI channel disconnected' in startup log" >&2
    cat "$SMOKE_LOG" >&2
    exit 1
fi
rm -f "$SMOKE_LOG"
echo "  ✓ macOS smoke test clean"

echo "→ tagging $VERSION and pushing"
git tag -a "$VERSION" -m "midi-macro-bridge $VERSION"
git push origin "$VERSION"

echo "→ extracting release notes from CHANGELOG.md"
NOTES_FILE="$(mktemp)"
if [[ -f "$SERVICE_DIR/CHANGELOG.md" ]]; then
    awk -v v="$VERSION" '
        $0 ~ "^## " v "$" {flag=1; next}
        flag && /^## / {exit}
        flag {print}
    ' "$SERVICE_DIR/CHANGELOG.md" > "$NOTES_FILE"
fi
if [[ ! -s "$NOTES_FILE" ]]; then
    echo "midi-macro-bridge $VERSION" > "$NOTES_FILE"
fi

echo "→ creating GitHub Release"
cd "$SERVICE_DIR/target/release-package"
gh release create "$VERSION" \
    --title "midi-macro-bridge $VERSION" \
    --notes-file "$NOTES_FILE" \
    "midi-macro-bridge-$VERSION-aarch64-apple-darwin.tar.gz" \
    "midi-macro-bridge-$VERSION-aarch64-apple-darwin.tar.gz.sha256" \
    "midi-macro-bridge-$VERSION-x86_64-unknown-linux-gnu.tar.gz" \
    "midi-macro-bridge-$VERSION-x86_64-unknown-linux-gnu.tar.gz.sha256" \
    SHA256SUMS

rm -f "$NOTES_FILE"

echo
echo "✓ Released $VERSION"
echo "  https://github.com/audiocontrol-org/audiocontrol/releases/tag/$VERSION"
```

```bash
chmod +x services/midi-macro-bridge/scripts/release.sh
```

- [x] **Step 3: Verify the script's preflight checks (without actually releasing)**

Smoke-test the precondition checks by invoking with a deliberately wrong version:

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
./services/midi-macro-bridge/scripts/release.sh --version v999.99.99 || echo "(expected failure — Cargo.toml mismatch)"
```

Expected: exits non-zero with "Cargo.toml version (...) does not match VERSION (999.99.99)".

Don't run the full release — Phase 6 Task 6.2 is the controlled v0.1.0 invocation.

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/Makefile services/midi-macro-bridge/scripts/release.sh
git commit -m "feat(midi-macro-bridge): add make release end-to-end target"
```

---

## Phase 4: Homebrew Tap

### Task 4.1: Create the tap repo

- [x] **Step 1: Bootstrap the repo on GitHub**

```bash
gh repo create audiocontrol-org/homebrew-audiocontrol \
    --public \
    --description "Homebrew tap for audiocontrol tools" \
    --clone
```

Resulting clone: `~/homebrew-audiocontrol/` (or wherever `gh` deposits it).

- [x] **Step 2: Bootstrap the formula directory**

```bash
cd /path/to/homebrew-audiocontrol
mkdir -p Formula
```

- [x] **Step 3: Write the formula skeleton (placeholder URLs/SHA256s)**

Create `Formula/midi-macro-bridge.rb`:

```ruby
class MidiMacroBridge < Formula
  desc "Translate MIDI events into keystrokes/macros for DAW integration"
  homepage "https://github.com/audiocontrol-org/audiocontrol"
  license any_of: ["MIT", "Apache-2.0"]
  version "0.1.0"

  on_macos do
    on_arm do
      url "https://github.com/audiocontrol-org/audiocontrol/releases/download/v#{version}/midi-macro-bridge-v#{version}-aarch64-apple-darwin.tar.gz"
      sha256 "PLACEHOLDER_MAC_ARM64_SHA256"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/audiocontrol-org/audiocontrol/releases/download/v#{version}/midi-macro-bridge-v#{version}-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "PLACEHOLDER_LINUX_X86_64_SHA256"
    end
  end

  def install
    bin.install "bin/midi-macro-bridge"
    pkgshare.install Dir["share/midi-macro-bridge/*"]
    doc.install Dir["doc/*"]
  end

  def caveats
    <<~EOS
      Configure with:
        mkdir -p ~/.config/audiocontrol/midi-macro-bridge   # Linux
        mkdir -p ~/Library/Application\\ Support/audiocontrol/midi-macro-bridge   # macOS
        cp #{opt_pkgshare}/config.example.toml \\
           <path-above>/config.toml

      Run interactively:
        midi-macro-bridge

      Or as a background service:
        brew services start midi-macro-bridge
    EOS
  end

  service do
    run [opt_bin/"midi-macro-bridge", "--no-open"]
    keep_alive true
    log_path var/"log/midi-macro-bridge.log"
    error_log_path var/"log/midi-macro-bridge.log"
  end

  test do
    assert_match "midi-macro-bridge", shell_output("#{bin}/midi-macro-bridge --help 2>&1", 0)
  end
end
```

- [x] **Step 4: Initial README.md for the tap**

Create `README.md`:

```markdown
# audiocontrol Homebrew tap

Tap:

    brew tap audiocontrol-org/audiocontrol

Install:

    brew install midi-macro-bridge

Run:

    midi-macro-bridge                      # foreground
    brew services start midi-macro-bridge  # daemon
```

- [x] **Step 5: Commit and push the tap**

```bash
cd /path/to/homebrew-audiocontrol
git add Formula/midi-macro-bridge.rb README.md
git commit -m "feat: initial midi-macro-bridge formula (placeholder SHA256s)"
git push origin main
```

### Task 4.2: SHA256 update helper

**Files:** (back in audiocontrol worktree)
- Create: `services/midi-macro-bridge/scripts/update-homebrew-formula.sh`

- [x] **Step 1: Write the helper**

Create `services/midi-macro-bridge/scripts/update-homebrew-formula.sh`:

```bash
#!/usr/bin/env bash
# Updates the Homebrew formula for a given release version.
#
# Usage:
#   scripts/update-homebrew-formula.sh <version> <path-to-tap>
#
# Example:
#   scripts/update-homebrew-formula.sh v0.1.0 ~/work/homebrew-audiocontrol
#
# Pulls the SHA256SUMS file from the GitHub Release and rewrites the
# placeholders in the formula in place. Does NOT commit/push — review first.

set -euo pipefail

VERSION="${1:-}"
TAP_DIR="${2:-}"
[[ -n "$VERSION" && -n "$TAP_DIR" ]] || {
    echo "usage: $0 <version> <path-to-tap>" >&2
    exit 2
}

REPO="audiocontrol-org/audiocontrol"
FORMULA="$TAP_DIR/Formula/midi-macro-bridge.rb"
[[ -f "$FORMULA" ]] || { echo "ERROR: formula not found at $FORMULA" >&2; exit 1; }

SUMS_FILE="$(mktemp)"
gh release download "$VERSION" --repo "$REPO" --pattern 'SHA256SUMS' -O - > "$SUMS_FILE"

MAC_ARM_SHA="$(grep "aarch64-apple-darwin.tar.gz$" "$SUMS_FILE" | awk '{print $1}')"
LINUX_X64_SHA="$(grep "x86_64-unknown-linux-gnu.tar.gz$" "$SUMS_FILE" | awk '{print $1}')"

[[ -n "$MAC_ARM_SHA" ]] || { echo "ERROR: no macOS arm64 SHA in SHA256SUMS" >&2; exit 1; }
[[ -n "$LINUX_X64_SHA" ]] || { echo "ERROR: no Linux x86_64 SHA in SHA256SUMS" >&2; exit 1; }

VERSION_NO_V="${VERSION#v}"

python3 - <<PY
import re
with open("$FORMULA") as f:
    src = f.read()
src = re.sub(r'version "[^"]+"', 'version "$VERSION_NO_V"', src)
src = re.sub(r'PLACEHOLDER_MAC_ARM64_SHA256', '$MAC_ARM_SHA', src)
src = re.sub(r'PLACEHOLDER_LINUX_X86_64_SHA256', '$LINUX_X64_SHA', src)
src = re.sub(r'sha256 "[a-f0-9]{64}".*aarch64-apple-darwin', 'sha256 "$MAC_ARM_SHA"', src)
src = re.sub(r'sha256 "[a-f0-9]{64}".*x86_64-unknown-linux-gnu', 'sha256 "$LINUX_X64_SHA"', src)
with open("$FORMULA", "w") as f:
    f.write(src)
PY

echo "✓ updated $FORMULA"
echo "  version: $VERSION_NO_V"
echo "  macOS arm64 sha256: $MAC_ARM_SHA"
echo "  Linux x86_64 sha256: $LINUX_X64_SHA"
echo
echo "Review the diff, then commit/push the tap repo."
```

Make executable:

```bash
chmod +x services/midi-macro-bridge/scripts/update-homebrew-formula.sh
```

- [x] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/scripts/update-homebrew-formula.sh
git commit -m "feat(midi-macro-bridge): add Homebrew formula SHA256 update helper"
```

---

## Phase 5: Documentation

### Task 5.1: README install section

**Files:**
- Modify: `services/midi-macro-bridge/README.md`

- [x] **Step 1: Replace the existing "Build" section**

Find the `## Setup` section in `services/midi-macro-bridge/README.md`. Replace its body with:

```markdown
## Install

### macOS (Apple Silicon) — Homebrew (recommended)

    brew tap audiocontrol-org/audiocontrol
    brew install midi-macro-bridge

### macOS / Linux — release tarball

Download the latest release tarball from
https://github.com/audiocontrol-org/audiocontrol/releases, then:

    tar -xzf midi-macro-bridge-vX.Y.Z-<triple>.tar.gz
    cd midi-macro-bridge-vX.Y.Z-<triple>
    ./install.sh           # installs to $HOME/.local (or /usr/local if root)

On macOS, unsigned binaries are quarantined by Gatekeeper. See
[QUARANTINE.md](QUARANTINE.md) for the recovery one-liner.

### From source

    cd services/midi-macro-bridge
    cargo build --release
    cp config.example.toml config.toml
```

- [x] **Step 2: Add a "Run" section after install**

```markdown
## Run

    midi-macro-bridge                              # foreground; auto-opens browser
    midi-macro-bridge --no-open                    # foreground; no browser
    midi-macro-bridge --config /path/to/config.toml

The bridge reads its config from (in order):

  1. `--config <path>` flag
  2. `$MIDI_MACRO_BRIDGE_CONFIG` environment variable
  3. macOS: `~/Library/Application Support/audiocontrol/midi-macro-bridge/config.toml`
     Linux: `~/.config/audiocontrol/midi-macro-bridge/config.toml`
  4. `./config.toml` (legacy / dev fallback)

To run as a background service, see [INSTALL.md](INSTALL.md).
```

- [x] **Step 3: Commit**

```bash
git add services/midi-macro-bridge/README.md
git commit -m "docs(midi-macro-bridge): rewrite install + run sections for packaged releases"
```

### Task 5.2: Seed CHANGELOG.md

**Files:**
- Create: `services/midi-macro-bridge/CHANGELOG.md`

- [x] **Step 1: Write the changelog**

Create `services/midi-macro-bridge/CHANGELOG.md`:

```markdown
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
```

- [x] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/CHANGELOG.md
git commit -m "docs(midi-macro-bridge): seed CHANGELOG with v0.1.0 entry"
```

### Task 5.3: INSTALL.md service activation steps

**Files:**
- Create: `services/midi-macro-bridge/INSTALL.md`

- [x] **Step 1: Write the doc**

Create `services/midi-macro-bridge/INSTALL.md`:

```markdown
# Installing midi-macro-bridge as a service

## Homebrew (macOS, Linux)

After `brew install midi-macro-bridge`:

    brew services start midi-macro-bridge

Restart on each login. Stop with `brew services stop midi-macro-bridge`.

## Tarball install — macOS (launchd, per-user)

    cp ~/.local/share/midi-macro-bridge/launchd/com.audiocontrol.midi-macro-bridge.plist \
       ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/com.audiocontrol.midi-macro-bridge.plist

The plist's `ProgramArguments` assumes `/usr/local/bin/midi-macro-bridge`. If
you installed under `~/.local/bin`, edit the path before loading.

To stop:

    launchctl unload ~/Library/LaunchAgents/com.audiocontrol.midi-macro-bridge.plist

## Tarball install — Linux (systemd user)

    mkdir -p ~/.config/systemd/user
    cp ~/.local/share/midi-macro-bridge/systemd/midi-macro-bridge.service \
       ~/.config/systemd/user/
    systemctl --user enable --now midi-macro-bridge.service

The unit assumes `/usr/local/bin/midi-macro-bridge`. Edit `ExecStart=` if you
installed elsewhere.

To stop:

    systemctl --user disable --now midi-macro-bridge.service
```

- [x] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/INSTALL.md
git commit -m "docs(midi-macro-bridge): add service activation instructions"
```

---

## Phase 6: First Release (v0.1.0)

**Reshape note**: this phase was originally tag-driven CI ("push v0.1.0 → GitHub Actions builds and uploads"). It is now **operator-driven local release**: `make release VERSION=v0.1.0` (Phase 3 Task 3.3) runs the full pipeline on the developer's host. The post-release smoke tests (download from GitHub, install, run) and the Homebrew formula update remain.

### Task 6.1: Final pre-release verification

- [x] **Step 1: Confirm Cargo.toml version is `0.1.0`**

```bash
grep '^version = ' services/midi-macro-bridge/Cargo.toml
```

If not, edit it. The `make release` target asserts the match and refuses to proceed if they disagree.

- [x] **Step 2: Confirm CHANGELOG.md has a `## v0.1.0` section**

```bash
grep -n '^## v0.1.0' services/midi-macro-bridge/CHANGELOG.md
```

The `make release` target extracts release notes from this section. Without it, the GitHub Release falls back to a generic title.

- [x] **Step 3: Confirm working tree is clean and on `main`**

```bash
git status
git rev-parse --abbrev-ref HEAD
```

`make release` enforces clean tree; off-main is a warning, not a block, in case you cut from a release branch.

### Task 6.2: Build, smoke-test, tag, and ship v0.1.0

- [x] **Step 1: Run the end-to-end release**

From the workspace root:

```bash
make -C services/midi-macro-bridge release VERSION=v0.1.0
```

The script runs Phase 3 Task 3.3's pipeline: assert preconditions → `package-all` (macOS arm64 native + Linux x86_64 via Docker) → macOS smoke test (regression check for `MIDI channel disconnected`) → tag + push → `gh release create` with both tarballs, both `.sha256`, and the aggregate `SHA256SUMS`.

- [x] **Step 2: Verify the GitHub Release**

```bash
gh release view v0.1.0
```

Expected: lists `midi-macro-bridge-v0.1.0-aarch64-apple-darwin.tar.gz`, `...-x86_64-unknown-linux-gnu.tar.gz`, both `.sha256` files, and `SHA256SUMS`.

### Task 6.3: Smoke-test the macOS arm64 release tarball (download path)

The `make release` smoke test validates the locally-built binary. This task validates the **downloaded** tarball — confirms the upload was complete and the install path works for a fresh user.

- [x] **Step 1: Download and verify checksum**

```bash
mkdir -p /tmp/release-test && cd /tmp/release-test
gh release download v0.1.0 --repo audiocontrol-org/audiocontrol \
    --pattern '*aarch64-apple-darwin*'
shasum -a 256 -c midi-macro-bridge-v0.1.0-aarch64-apple-darwin.tar.gz.sha256
tar -xzf midi-macro-bridge-v0.1.0-aarch64-apple-darwin.tar.gz
cd midi-macro-bridge-v0.1.0-aarch64-apple-darwin
```

- [x] **Step 2: Run install.sh + clear quarantine**

```bash
./install.sh
xattr -d com.apple.quarantine "$HOME/.local/bin/midi-macro-bridge" || true
```

- [x] **Step 3: Run the installed binary from outside the build tree**

```bash
cd /tmp
"$HOME/.local/bin/midi-macro-bridge" --no-open &
PID=$!
sleep 2
if kill -0 $PID 2>/dev/null; then echo "STAY_UP: ok"; else echo "STAY_UP: FAIL"; fi
kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
```

Expected: `STAY_UP: ok`. Confirms `paths.rs` resolution works for an installed binary launched from `/tmp`, not the build directory.

### Task 6.4: Smoke-test the Linux x86_64 release tarball

Two paths — pick one based on what's available:

- [ ] **Path A: Real Linux x86_64 host**

```bash
cd /tmp
curl -L -o midi-macro-bridge.tar.gz \
    "https://github.com/audiocontrol-org/audiocontrol/releases/download/v0.1.0/midi-macro-bridge-v0.1.0-x86_64-unknown-linux-gnu.tar.gz"
tar -xzf midi-macro-bridge.tar.gz
cd midi-macro-bridge-v0.1.0-x86_64-unknown-linux-gnu
./install.sh
~/.local/bin/midi-macro-bridge --no-open &
sleep 2
if kill -0 %1 2>/dev/null; then echo "STAY_UP: ok"; else echo "STAY_UP: FAIL"; fi
kill %1 2>/dev/null || true
```

Expected: `STAY_UP: ok`.

- [ ] **Path B: Privileged Docker (if no Linux host available)**

ALSA-aware container with `/dev/snd` mounted (host must have a sound device). Builds on operator's macOS via Docker Desktop won't have `/dev/snd`; this path is for Linux-on-Linux Docker only.

```bash
docker run --rm \
    --device /dev/snd \
    -v "$(pwd)":/work -w /work \
    debian:bookworm \
    bash -c "
        apt-get update >/dev/null 2>&1 && apt-get install -y -qq libasound2 ca-certificates curl >/dev/null 2>&1
        curl -L -o /tmp/mmb.tar.gz \
            'https://github.com/audiocontrol-org/audiocontrol/releases/download/v0.1.0/midi-macro-bridge-v0.1.0-x86_64-unknown-linux-gnu.tar.gz'
        tar -xzf /tmp/mmb.tar.gz -C /tmp
        /tmp/midi-macro-bridge-v0.1.0-x86_64-unknown-linux-gnu/bin/midi-macro-bridge --no-open &
        PID=\$!
        sleep 2
        if kill -0 \$PID 2>/dev/null; then echo STAY_UP: ok; else echo STAY_UP: FAIL; fi
        kill \$PID 2>/dev/null || true
    "
```

If neither path is available on this machine, mark this task complete with a note in the commit message (e.g., "Linux smoke deferred to next available Linux host").

### Task 6.5: Update Homebrew formula and ship

- [x] **Step 1: Run the SHA256 update helper**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh v0.1.0 \
    /path/to/homebrew-audiocontrol
```

- [x] **Step 2: Review the diff in the tap repo**

```bash
cd /path/to/homebrew-audiocontrol
git diff Formula/midi-macro-bridge.rb
```

Expected: version bump + two real SHA256s replacing placeholders.

- [x] **Step 3: Commit and push the tap**

```bash
git add Formula/midi-macro-bridge.rb
git commit -m "midi-macro-bridge 0.1.0"
git push origin main
```

- [x] **Step 4: End-to-end brew install test**

On a clean macOS Apple Silicon machine (or via `brew uninstall midi-macro-bridge` first):

```bash
brew tap audiocontrol-org/audiocontrol
brew install midi-macro-bridge
midi-macro-bridge --help
brew services start midi-macro-bridge
sleep 3
brew services stop midi-macro-bridge
```

Expected: install succeeds, `--help` prints, `brew services start` launches it as a daemon.

### Task 6.6: Close out the feature

- [x] **Step 1: Update the feature README status table**

Mark phases 1–6 complete in `docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/README.md`.

- [x] **Step 2: Write a DEVELOPMENT-NOTES.md entry**

In `DEVELOPMENT-NOTES.md`, add an entry following the project journal template (see `.claude/CLAUDE.md`'s Development Journal section).

- [ ] **Step 3: Run `/dw-lifecycle:complete`**

The skill will move the feature docs to `002-COMPLETE/`, update ROADMAP.md, and close the GitHub issues.

---

## Acceptance Criteria

A v0.1.0 release passes when:

1. `make release VERSION=v0.1.0` (run from a clean `main` with `Cargo.toml` version `0.1.0`) creates a GitHub Release containing both tarballs, both per-tarball SHA256 files, and an aggregate `SHA256SUMS` — without manual intervention after invocation.
2. `make release` refuses to proceed if `Cargo.toml` version disagrees with `VERSION`, working tree is dirty, or the tag already exists locally.
3. The macOS smoke test inside `make release` does not regress: default-config startup must not produce `MIDI channel disconnected` within 2.5 seconds.
4. The macOS tarball downloaded from the GitHub Release, after `xattr -d com.apple.quarantine`, runs the installed binary successfully from a directory other than the build tree (validates `paths.rs` resolution).
5. The Linux tarball runs the installed binary successfully on a stock Ubuntu/Debian host (or in a privileged Docker container with `/dev/snd`). Mark with a deferral note if no Linux host is reachable from this session.
6. `brew tap audiocontrol-org/audiocontrol && brew install midi-macro-bridge` succeeds on macOS Apple Silicon, and `brew services start midi-macro-bridge` launches it as a daemon.

---

## Phase 7: macOS .app + .dmg distribution

> **Design spec:** [`2026-05-05-macos-app-distribution-design.md`](2026-05-05-macos-app-distribution-design.md). The spec is the source of truth for architecture, defaults, and acceptance criteria. This workplan section translates the spec into bite-sized implementation tasks.

**Goal:** Ship a signed and notarized `MidiMacroBridge.app` inside a signed and notarized `.dmg` alongside the existing tarballs. Native AppKit window via `wry` + `tao` hosts the existing HTMX web UI.

**Architecture:** New `gui.rs` module opens a `wry::WebView` window pointed at `http://127.0.0.1:8765` when the binary detects it's running from a `.app` bundle (or when `--gui` is passed). Window close → same graceful halt path as the existing HALT button. Reuses midi-server's macOS signing infrastructure (Developer ID + notarytool credentials) without duplicating it.

**Tech Stack:** Rust 1.85+ on the host, `tao = "0.30"`, `wry = "0.45"` (macOS-only deps), `codesign`, `productsign`, `hdiutil`, `xcrun notarytool`, `xcrun stapler`, `spctl`.

---

### File Structure

| Path | Responsibility | Created in task |
|---|---|---|
| `services/midi-macro-bridge/Cargo.toml` | Add `tao` + `wry` under `[target.'cfg(target_os = "macos")'.dependencies]` | 7.1 |
| `services/midi-macro-bridge/src/gui.rs` | `run_window(url, halt) -> Result<()>` — tao event loop + wry WebView | 7.2 |
| `services/midi-macro-bridge/src/main.rs` | Wire bundle detection + `--gui`/`--no-gui` flags + call `gui::run_window` after web server binds | 7.3 |
| `services/midi-macro-bridge/packaging/macos/Info.plist.tmpl` | Template; `__VERSION__` substituted at build time | 7.4 |
| `services/midi-macro-bridge/packaging/macos/entitlements.plist` | Network server + client only (no JIT, no sandbox) | 7.4 |
| `services/midi-macro-bridge/packaging/macos/AppIcon.icns` | Placeholder icon (generic) for v0.2.0 | 7.4 |
| `services/midi-macro-bridge/scripts/package-app.sh` | Build → assemble `.app` → codesign → verify | 7.5 |
| `services/midi-macro-bridge/scripts/package-dmg.sh` | Stage → `hdiutil create` → codesign → notarize → staple → spctl assess | 7.6 |
| `services/midi-macro-bridge/Makefile` | Add `package-app`, `package-dmg`; extend `package-all` to include `.dmg` | 7.7 |
| `services/midi-macro-bridge/scripts/release.sh` | Extend `gh release create` to attach `.dmg` + `.sha256` | 7.8 |
| `services/midi-macro-bridge/README.md` | New "macOS .app" install path under Install section | 7.9 |
| `services/midi-macro-bridge/INSTALL.md` | New "Install via .dmg" subsection | 7.9 |
| `services/midi-macro-bridge/CHANGELOG.md` | Seed `## v0.2.0` entry mentioning .app + .dmg | 7.9 |
| (PRD + workplan + GitHub issues) | File issues for each deferred item per AC #9 | 7.10 |

---

### Task 7.1: Add tao + wry dependencies + gui.rs scaffolding

**Files:**
- Modify: `services/midi-macro-bridge/Cargo.toml`
- Create: `services/midi-macro-bridge/src/gui.rs`
- Modify: `services/midi-macro-bridge/src/main.rs`

- [x] **Step 1: Add macOS-gated dependencies**

Edit `services/midi-macro-bridge/Cargo.toml`. Find the `[dependencies]` block. After it, add a new section:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
tao = "0.30"
wry = "0.45"
```

- [x] **Step 2: Create the gui.rs module stub**

Create `services/midi-macro-bridge/src/gui.rs`:

```rust
//! Native AppKit window hosting the embedded web UI via wry/WebView.
//!
//! Compiled only on macOS. Other platforms skip the module entirely
//! (the `mod gui;` declaration in main.rs is also cfg-gated).

use std::sync::mpsc;

/// Channel sender used by the existing HALT button path. The window-close
/// handler reuses this to graceful-shutdown the bridge — no second shutdown
/// path to maintain.
pub type HaltSender = mpsc::Sender<()>;

/// Open a native AppKit window pointing at `url`. Blocks the calling thread
/// (must be the main thread on macOS) until the user closes the window or
/// `halt` fires from another source (e.g., the in-page HALT button).
pub fn run_window(_url: &str, _halt: HaltSender) -> anyhow::Result<()> {
    // Real implementation lands in Task 7.2.
    Ok(())
}
```

- [x] **Step 3: Wire the module into main.rs (cfg-gated)**

Edit `services/midi-macro-bridge/src/main.rs`. Find the existing `mod` declarations (around line 17-26). Add a cfg-gated declaration alphabetically:

```rust
#[cfg(target_os = "macos")]
mod gui;
```

- [x] **Step 4: Verify clean build**

Run from the worktree root:

```bash
cd services/midi-macro-bridge && cargo build 2>&1 | tail -10
```

Expected: clean build, possibly some `unused_variables` warnings on the stub function (they go away in Task 7.2). No errors.

- [x] **Step 5: Commit**

```bash
git add services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/src/gui.rs services/midi-macro-bridge/src/main.rs
git commit -m "feat(midi-macro-bridge): scaffold gui module + wry/tao deps (macOS only)"
```

---

### Task 7.2: Implement gui::run_window with tao + wry

**Files:**
- Modify: `services/midi-macro-bridge/src/gui.rs`

- [x] **Step 1: Replace the stub with a real implementation**

Open `services/midi-macro-bridge/src/gui.rs`. Replace the entire `run_window` function body with:

```rust
use std::sync::mpsc;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

pub type HaltSender = mpsc::Sender<()>;

pub fn run_window(url: &str, halt: HaltSender) -> anyhow::Result<()> {
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("MIDI Macro Bridge")
        .with_inner_size(tao::dpi::LogicalSize::new(900.0, 700.0))
        .build(&event_loop)?;

    // wry attaches the WebView to the tao window.
    let _webview = WebViewBuilder::new()
        .with_url(url)
        .build(&window)?;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            // Window close = same graceful shutdown path as the HALT button.
            // The receiver side is the main MIDI loop; ignore send errors
            // (already-closed channel = bridge is already shutting down).
            let _ = halt.send(());
            *control_flow = ControlFlow::Exit;
        }
    });
    // event_loop.run never returns on macOS; this line is unreachable but
    // keeps the function signature honest for non-macOS callers.
    #[allow(unreachable_code)]
    Ok(())
}
```

- [x] **Step 2: Verify compile**

```bash
cd services/midi-macro-bridge && cargo build 2>&1 | tail -10
```

Expected: clean build. wry pulls in WebKit framework links; the link line gets longer but should succeed on stock macOS.

- [x] **Step 3: Smoke test the window in isolation (manual)**

Add a temporary test runner. We don't commit this — it's an inline verification. Open a Rust REPL or write a 5-line throwaway:

```bash
cd services/midi-macro-bridge
cat > /tmp/gui-smoke.rs <<'EOF'
fn main() {
    let (tx, _rx) = std::sync::mpsc::channel();
    midi_macro_bridge::gui::run_window("http://example.com", tx).unwrap();
}
EOF
```

Actually skip the throwaway — Task 7.3 wires `--gui` into the real binary, which is the proper smoke. Move to Task 7.3 and verify there.

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/src/gui.rs
git commit -m "feat(midi-macro-bridge): implement gui::run_window with tao + wry WebView"
```

---

### Task 7.3: Bundle context detection + main.rs flag wiring

**Files:**
- Modify: `services/midi-macro-bridge/src/main.rs`

- [x] **Step 1: Add bundle detection helper**

Edit `services/midi-macro-bridge/src/main.rs`. Add this helper function near the top (after the `use` block but before `fn main`):

```rust
/// Detect whether the current executable lives inside a macOS .app bundle.
/// Returns false on non-macOS platforms.
fn launched_from_app_bundle() -> bool {
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe) = std::env::current_exe() {
            return exe.to_string_lossy().contains(".app/Contents/MacOS/");
        }
        false
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}
```

- [x] **Step 2: Add the gui-mode resolver**

After `launched_from_app_bundle`, add:

```rust
/// Resolve whether the binary should open a native window:
///   - `--gui` flag forces ON
///   - `--no-gui` flag forces OFF
///   - Otherwise, true iff launched from an .app bundle
fn resolve_gui_mode(args: &[String]) -> bool {
    if args.iter().any(|a| a == "--no-gui") {
        return false;
    }
    if args.iter().any(|a| a == "--gui") {
        return true;
    }
    launched_from_app_bundle()
}
```

- [x] **Step 3: Wire the call site**

Find the existing `open_browser(&url)` call in `main.rs` (search: `grep -n 'open_browser' services/midi-macro-bridge/src/main.rs`). It's currently gated by `config.web.auto_open_browser && !no_open`. Wrap it with the new gui-mode check. Replace the existing block:

```rust
if config.web.auto_open_browser && !no_open {
    open_browser(&url);
}
```

with:

```rust
if resolve_gui_mode(&args) {
    #[cfg(target_os = "macos")]
    {
        // run_window blocks the main thread until the window closes or halt fires.
        // Bridge exits cleanly afterward via the same path as the HALT button.
        if let Err(e) = gui::run_window(&url, halt_tx.clone()) {
            warn!(error = ?e, "gui window failed to open; falling back to web-only");
            if config.web.auto_open_browser && !no_open {
                open_browser(&url);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        warn!("--gui requested but only macOS supports the wry window today; falling back to web-only");
        if config.web.auto_open_browser && !no_open {
            open_browser(&url);
        }
    }
} else if config.web.auto_open_browser && !no_open {
    open_browser(&url);
}
```

(Adapt `halt_tx` to whatever the existing channel sender is named — look for the symbol the HALT-API handler posts to. It's likely a `Cmd` enum variant via `mpsc::Sender<Cmd>`; in that case, define a small adapter closure that wraps `halt.send(()) -> tx.send(Cmd::Halt)`.)

- [x] **Step 4: Test --gui smoke (with browser fallback to verify default path)**

Build and run. From the worktree root:

```bash
cd services/midi-macro-bridge && cargo build 2>&1 | tail -5
```

Expected: clean build.

Default behavior (no flag) — should still open browser:

```bash
./target/debug/midi-macro-bridge --no-open >/tmp/gui-default.log 2>&1 &
PID=$!
sleep 2
if kill -0 $PID 2>/dev/null; then echo "STAY_UP: ok"; else echo "STAY_UP: FAIL"; fi
kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
grep -q "MIDI channel disconnected" /tmp/gui-default.log && echo "REGRESSION present" || echo "REGRESSION clean"
```

`--gui` flag should open the window. This requires interactive verification on macOS:

```bash
./target/debug/midi-macro-bridge --gui
```

Expected: a 900x700 native AppKit window opens within ~2s showing the bridge's HTMX UI. Click the HALT button (3-second hold) — bridge exits. OR close the window with red X / Cmd-W — bridge exits the same way.

- [x] **Step 5: Commit**

```bash
git add services/midi-macro-bridge/src/main.rs
git commit -m "feat(midi-macro-bridge): wire --gui flag + bundle detection; window path uses gui::run_window"
```

---

### Task 7.4: Authoring Info.plist template, entitlements, and placeholder icon

**Files:**
- Create: `services/midi-macro-bridge/packaging/macos/Info.plist.tmpl`
- Create: `services/midi-macro-bridge/packaging/macos/entitlements.plist`
- Create: `services/midi-macro-bridge/packaging/macos/AppIcon.icns`

- [x] **Step 1: Author Info.plist template**

Create `services/midi-macro-bridge/packaging/macos/Info.plist.tmpl`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>midi-macro-bridge</string>
    <key>CFBundleIdentifier</key>
    <string>org.audiocontrol.midi-macro-bridge</string>
    <key>CFBundleName</key>
    <string>MIDI Macro Bridge</string>
    <key>CFBundleDisplayName</key>
    <string>MIDI Macro Bridge</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleVersion</key>
    <string>__VERSION__</string>
    <key>CFBundleShortVersionString</key>
    <string>__VERSION__</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
```

`LSUIElement = false` keeps the Dock icon visible (per spec defaults). `__VERSION__` is a sed-substituted placeholder; package-app.sh fills it in.

- [x] **Step 2: Lint the plist template**

```bash
plutil -lint services/midi-macro-bridge/packaging/macos/Info.plist.tmpl
```

Expected: `OK`. (The `__VERSION__` placeholder is a string value, so plutil parses it as valid XML.)

- [x] **Step 3: Author entitlements.plist**

Create `services/midi-macro-bridge/packaging/macos/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

```bash
plutil -lint services/midi-macro-bridge/packaging/macos/entitlements.plist
```

Expected: `OK`.

- [x] **Step 4: Generate a placeholder AppIcon.icns**

Use `sips` + `iconutil` (both ship with macOS). Build an iconset from a single 1024x1024 PNG with a generic glyph, then convert.

```bash
mkdir -p /tmp/AppIcon.iconset
# Generate a 1024x1024 dark square with white "MMB" text using sips's image-creation isn't built in;
# use an alternate one-liner with `qlmanage` or `convert` if ImageMagick is installed,
# or hand-craft the PNG. Here we generate a flat color square:
python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGBA', (1024, 1024), (28, 28, 32, 255))
d = ImageDraw.Draw(img)
try:
    f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 320)
except Exception:
    f = ImageFont.load_default()
text = 'MMB'
bbox = d.textbbox((0, 0), text, font=f)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((1024 - w) / 2 - bbox[0], (1024 - h) / 2 - bbox[1]), text, fill=(220, 220, 230, 255), font=f)
img.save('/tmp/AppIcon.iconset/icon_1024x1024.png')
PY

# Generate the required size variants from the 1024x1024 master.
cd /tmp/AppIcon.iconset
for sz in 16 32 64 128 256 512; do
    sips -z $sz $sz icon_1024x1024.png --out icon_${sz}x${sz}.png >/dev/null
    sips -z $((sz*2)) $((sz*2)) icon_1024x1024.png --out icon_${sz}x${sz}@2x.png >/dev/null
done
sips -z 1024 1024 icon_1024x1024.png --out icon_512x512@2x.png >/dev/null

iconutil -c icns -o /tmp/AppIcon.icns /tmp/AppIcon.iconset
mv /tmp/AppIcon.icns /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging/services/midi-macro-bridge/packaging/macos/AppIcon.icns
rm -rf /tmp/AppIcon.iconset
```

If `python3` doesn't have PIL: `pip3 install --user Pillow` first, or skip the Python step and place a hand-made 1024x1024 PNG at `/tmp/AppIcon.iconset/icon_1024x1024.png`. The placeholder content doesn't matter for v0.2.0 — a real icon ships later (per spec Non-goals).

Verify the icon:

```bash
file services/midi-macro-bridge/packaging/macos/AppIcon.icns
```

Expected: `Mac OS X icon`.

- [x] **Step 5: Commit**

```bash
git add services/midi-macro-bridge/packaging/macos/
git commit -m "feat(midi-macro-bridge): add Info.plist template + entitlements + placeholder AppIcon"
```

---

### Task 7.5: package-app.sh — assemble + sign .app

**Files:**
- Create: `services/midi-macro-bridge/scripts/package-app.sh`

- [x] **Step 1: Locate the midi-server signing config**

The script sources `release.config.sh` and `release-secrets.sh` from the midi-server repo. Verify the path before authoring the script:

```bash
ls /Users/orion/work/midi-server-work/midi-server/packaging/macos/release.config.sh
ls /Users/orion/work/midi-server-work/midi-server/packaging/macos/release-secrets.sh
```

Expected: both files exist. If the path differs on this machine, set `AUDIOCONTROL_SIGNING_INFRA_DIR` accordingly.

- [x] **Step 2: Author the script**

Create `services/midi-macro-bridge/scripts/package-app.sh`:

```bash
#!/usr/bin/env bash
# Assemble + sign MidiMacroBridge.app from a release binary.
#
# Usage:
#   scripts/package-app.sh --version <vX.Y.Z>
#
# Produces under target/release-package/:
#   MidiMacroBridge-<version>.app  (signed, NOT notarized — that happens in package-dmg.sh)

set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required (e.g., v0.2.0)" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: VERSION must start with 'v'" >&2; exit 2; }

VERSION_NO_V="${VERSION#v}"
SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$SERVICE_DIR"

# Source midi-server's signing config + secrets.
SIGNING_INFRA_DIR="${AUDIOCONTROL_SIGNING_INFRA_DIR:-$HOME/work/midi-server-work/midi-server/packaging/macos}"
[[ -f "$SIGNING_INFRA_DIR/release.config.sh" ]] || {
    echo "ERROR: signing config not found at $SIGNING_INFRA_DIR/release.config.sh" >&2
    echo "       Set AUDIOCONTROL_SIGNING_INFRA_DIR to the correct path." >&2
    exit 1
}
# shellcheck disable=SC1091
source "$SIGNING_INFRA_DIR/release.config.sh"
# Secrets script reads $RELEASE_SECRETS_PASSWORD from the env, decrypts and exports
# APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD. We don't need them for codesign — only for
# notarytool in package-dmg.sh — but sourcing here lets us fail fast if creds aren't
# available before doing the build.
# shellcheck disable=SC1091
source "$SIGNING_INFRA_DIR/release-secrets.sh"

DEVELOPER_ID_APP="${DEVELOPER_ID_APP:-$DEVELOPER_ID_APP_DEFAULT}"
[[ -n "$DEVELOPER_ID_APP" ]] || { echo "ERROR: DEVELOPER_ID_APP unset" >&2; exit 1; }

APP_NAME="MidiMacroBridge.app"
STAGING="target/release-package/$APP_NAME"
TRIPLE="aarch64-apple-darwin"

echo "→ building release binary for $TRIPLE"
cargo build --release --target "$TRIPLE"

echo "→ assembling $STAGING"
rm -rf "$STAGING"
mkdir -p "$STAGING/Contents/MacOS" "$STAGING/Contents/Resources"

cp "target/$TRIPLE/release/midi-macro-bridge" "$STAGING/Contents/MacOS/"

# Substitute __VERSION__ into Info.plist.
python3 -c "
import sys
src = open('packaging/macos/Info.plist.tmpl').read()
out = src.replace('__VERSION__', '$VERSION_NO_V')
open('$STAGING/Contents/Info.plist', 'w').write(out)
"

# PkgInfo is a 4-byte type code + 4-byte signature. APPLE_PACKAGE_TYPE = APPL.
printf 'APPL????' > "$STAGING/Contents/PkgInfo"

cp packaging/macos/AppIcon.icns "$STAGING/Contents/Resources/AppIcon.icns"

echo "→ codesigning"
codesign --force --options runtime \
    --entitlements packaging/macos/entitlements.plist \
    --sign "$DEVELOPER_ID_APP" \
    "$STAGING/Contents/MacOS/midi-macro-bridge"

codesign --force --options runtime \
    --entitlements packaging/macos/entitlements.plist \
    --sign "$DEVELOPER_ID_APP" \
    "$STAGING"

echo "→ verifying signature"
codesign --verify --deep --strict --verbose=2 "$STAGING"

echo "✓ $STAGING (signed, not yet notarized)"
echo "  Run scripts/package-dmg.sh --version $VERSION to produce a notarized .dmg."
```

Mark executable:

```bash
chmod +x services/midi-macro-bridge/scripts/package-app.sh
```

- [x] **Step 3: Smoke test**

```bash
cd services/midi-macro-bridge && ./scripts/package-app.sh --version v0.0.2-test 2>&1 | tail -10
```

Expected output ends with:
```
→ verifying signature
target/release-package/MidiMacroBridge.app: valid on disk
target/release-package/MidiMacroBridge.app: satisfies its Designated Requirement
✓ target/release-package/MidiMacroBridge.app (signed, not yet notarized)
```

- [x] **Step 4: Manual launch test**

```bash
open services/midi-macro-bridge/target/release-package/MidiMacroBridge.app
```

Expected: a native AppKit window opens within ~2s showing the bridge's HTMX UI. Close the window; bridge exits cleanly.

- [x] **Step 5: Commit**

```bash
git add services/midi-macro-bridge/scripts/package-app.sh
git commit -m "feat(midi-macro-bridge): add package-app.sh — assemble + sign MidiMacroBridge.app"
```

---

### Task 7.6: package-dmg.sh — wrap, notarize, staple

**Files:**
- Create: `services/midi-macro-bridge/scripts/package-dmg.sh`

- [x] **Step 1: Author the script**

Create `services/midi-macro-bridge/scripts/package-dmg.sh`:

```bash
#!/usr/bin/env bash
# Wrap MidiMacroBridge.app in a signed + notarized .dmg.
#
# Usage:
#   scripts/package-dmg.sh --version <vX.Y.Z>
#
# Requires that scripts/package-app.sh has already produced
# target/release-package/MidiMacroBridge.app for the matching version.
#
# Produces:
#   target/release-package/MidiMacroBridge-<version>.dmg
#   target/release-package/MidiMacroBridge-<version>.dmg.sha256

set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: VERSION must start with 'v'" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$SERVICE_DIR"

# Build the .app first if not present (idempotent — package-app.sh handles its own staging).
if [[ ! -d "target/release-package/MidiMacroBridge.app" ]]; then
    echo "→ MidiMacroBridge.app not found; running package-app.sh first"
    ./scripts/package-app.sh --version "$VERSION"
fi

SIGNING_INFRA_DIR="${AUDIOCONTROL_SIGNING_INFRA_DIR:-$HOME/work/midi-server-work/midi-server/packaging/macos}"
# shellcheck disable=SC1091
source "$SIGNING_INFRA_DIR/release.config.sh"
# shellcheck disable=SC1091
source "$SIGNING_INFRA_DIR/release-secrets.sh"

DEVELOPER_ID_APP="${DEVELOPER_ID_APP:-$DEVELOPER_ID_APP_DEFAULT}"
[[ -n "$DEVELOPER_ID_APP" ]] || { echo "ERROR: DEVELOPER_ID_APP unset" >&2; exit 1; }
[[ -n "${APPLE_ID:-}" ]] || { echo "ERROR: APPLE_ID unset (release-secrets.sh failed?)" >&2; exit 1; }
[[ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]] || { echo "ERROR: APPLE_APP_SPECIFIC_PASSWORD unset" >&2; exit 1; }
[[ -n "${APPLE_TEAM_ID:-}" ]] || APPLE_TEAM_ID="${APPLE_TEAM_ID_DEFAULT:-}"
[[ -n "$APPLE_TEAM_ID" ]] || { echo "ERROR: APPLE_TEAM_ID unset" >&2; exit 1; }

DMG_NAME="MidiMacroBridge-${VERSION}.dmg"
DMG_PATH="target/release-package/$DMG_NAME"
STAGING="target/release-package/dmg-staging"

echo "→ staging DMG contents at $STAGING"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R target/release-package/MidiMacroBridge.app "$STAGING/"
ln -s /Applications "$STAGING/Applications"

echo "→ creating $DMG_PATH (hdiutil)"
rm -f "$DMG_PATH"
hdiutil create \
    -volname "MIDI Macro Bridge" \
    -srcfolder "$STAGING" \
    -ov \
    -format UDZO \
    "$DMG_PATH"

echo "→ codesigning DMG"
codesign --force --sign "$DEVELOPER_ID_APP" "$DMG_PATH"

echo "→ submitting to notarytool (this takes ~2-5 min)"
xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

echo "→ stapling notarization ticket"
xcrun stapler staple "$DMG_PATH"

echo "→ Gatekeeper assessment"
spctl --assess --type install --verbose=2 "$DMG_PATH"

echo "→ computing SHA256"
( cd target/release-package && shasum -a 256 "$DMG_NAME" > "${DMG_NAME}.sha256" )

# Cleanup staging dir.
rm -rf "$STAGING"

echo
echo "✓ $DMG_PATH"
echo "✓ ${DMG_PATH}.sha256 ($(cat ${DMG_PATH}.sha256))"
```

Mark executable:

```bash
chmod +x services/midi-macro-bridge/scripts/package-dmg.sh
```

- [x] **Step 2: Smoke test (full pipeline including notarization)**

This takes ~3-7 minutes due to the notarization round trip. Make sure `RELEASE_SECRETS_PASSWORD` is set in the environment before running:

```bash
cd services/midi-macro-bridge && ./scripts/package-dmg.sh --version v0.0.2-test 2>&1 | tail -20
```

Expected output ends with:
```
→ Gatekeeper assessment
target/release-package/MidiMacroBridge-v0.0.2-test.dmg: accepted
source=Notarized Developer ID
→ computing SHA256
✓ target/release-package/MidiMacroBridge-v0.0.2-test.dmg
✓ target/release-package/MidiMacroBridge-v0.0.2-test.dmg.sha256 (<sha>  MidiMacroBridge-v0.0.2-test.dmg)
```

- [x] **Step 3: Manual install test**

```bash
open target/release-package/MidiMacroBridge-v0.0.2-test.dmg
```

Expected: Finder mounts the DMG, shows MidiMacroBridge.app + an Applications symlink. Drag the .app to Applications. Eject. Then:

```bash
open /Applications/MidiMacroBridge.app
```

Expected: window opens, bridge runs, no Gatekeeper warning (because notarized). Close the window; bridge exits.

Cleanup:

```bash
rm -rf /Applications/MidiMacroBridge.app
```

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/scripts/package-dmg.sh
git commit -m "feat(midi-macro-bridge): add package-dmg.sh — wrap + notarize + staple"
```

---

### Task 7.7: Makefile targets

**Files:**
- Modify: `services/midi-macro-bridge/Makefile`

- [x] **Step 1: Add new targets**

Edit `services/midi-macro-bridge/Makefile`. Find the `package-all` target. Modify the file to add `package-app` and `package-dmg` targets and extend `package-all` to depend on `package-dmg`:

```make
package-app:
	./scripts/package-app.sh --version $(VERSION)

package-dmg:
	./scripts/package-dmg.sh --version $(VERSION)

package-all: package-macos package-linux package-dmg
	@cd target/release-package && \
	  rm -f SHA256SUMS && \
	  cat midi-macro-bridge-$(VERSION)-aarch64-apple-darwin.tar.gz.sha256 \
	      midi-macro-bridge-$(VERSION)-x86_64-unknown-linux-gnu.tar.gz.sha256 \
	      MidiMacroBridge-$(VERSION).dmg.sha256 \
	      > SHA256SUMS
	@echo
	@echo "✓ Release artifacts for $(VERSION):"
	@ls -1 target/release-package/midi-macro-bridge-$(VERSION)-*.tar.gz \
	       target/release-package/midi-macro-bridge-$(VERSION)-*.sha256 \
	       target/release-package/MidiMacroBridge-$(VERSION).dmg \
	       target/release-package/MidiMacroBridge-$(VERSION).dmg.sha256 \
	       target/release-package/SHA256SUMS
```

Add `package-app package-dmg` to the `.PHONY` line.

- [x] **Step 2: Update help text**

Add to the help block:

```make
	@echo "  package-app        assemble + sign MidiMacroBridge.app (no notarize)"
	@echo "  package-dmg        wrap .app in notarized + stapled .dmg"
```

- [x] **Step 3: Verify**

```bash
cd services/midi-macro-bridge && rm -rf target/release-package && make package-all VERSION=v0.0.2-test 2>&1 | tail -15
```

Expected: 5 artifacts (2 tarballs, .dmg, 3 .sha256, 1 aggregate SHA256SUMS) listed at the end. Notarization round-trip means this takes ~5-10 minutes total.

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/Makefile
git commit -m "feat(midi-macro-bridge): wire .dmg into Makefile package-all + add per-target shortcuts"
```

---

### Task 7.8: Extend release.sh to upload .dmg

**Files:**
- Modify: `services/midi-macro-bridge/scripts/release.sh`

- [x] **Step 1: Update the gh release create call**

Edit `services/midi-macro-bridge/scripts/release.sh`. Find the `gh release create` invocation near the end. Add the .dmg + .sha256 to the asset list:

```bash
gh release create "$VERSION" \
    --title "midi-macro-bridge $VERSION" \
    --notes-file "$NOTES_FILE" \
    "midi-macro-bridge-$VERSION-aarch64-apple-darwin.tar.gz" \
    "midi-macro-bridge-$VERSION-aarch64-apple-darwin.tar.gz.sha256" \
    "midi-macro-bridge-$VERSION-x86_64-unknown-linux-gnu.tar.gz" \
    "midi-macro-bridge-$VERSION-x86_64-unknown-linux-gnu.tar.gz.sha256" \
    "MidiMacroBridge-$VERSION.dmg" \
    "MidiMacroBridge-$VERSION.dmg.sha256" \
    SHA256SUMS
```

The macOS smoke test (which currently runs against the staged tarball binary) should ALSO smoke-test the staged .app:

```bash
echo "→ smoke testing macOS .app"
APP_PATH="$SERVICE_DIR/target/release-package/MidiMacroBridge.app"
if [[ ! -d "$APP_PATH" ]]; then
    echo "ERROR: MidiMacroBridge.app missing: $APP_PATH" >&2
    exit 1
fi
# Just verify the signature is valid; runtime smoke needs interactive launch.
codesign --verify --deep --strict "$APP_PATH"
echo "  ✓ MidiMacroBridge.app signature valid"
```

Add this smoke step after the existing macOS tarball smoke test, before the tagging step.

- [x] **Step 2: Verify by running release.sh against a non-existent version**

The preflight should still reject mismatches:

```bash
./services/midi-macro-bridge/scripts/release.sh --version v9.99.99 2>&1 | head -5
```

Expected: same `Cargo.toml` mismatch error as before; release.sh extension didn't break preflight.

- [x] **Step 3: Commit**

```bash
git add services/midi-macro-bridge/scripts/release.sh
git commit -m "feat(midi-macro-bridge): extend release.sh to attach .dmg to GitHub Release + smoke .app"
```

---

### Task 7.9: Documentation updates

**Files:**
- Modify: `services/midi-macro-bridge/README.md`
- Modify: `services/midi-macro-bridge/INSTALL.md`
- Modify: `services/midi-macro-bridge/CHANGELOG.md`

- [x] **Step 1: Add .dmg path to README Install section**

In `services/midi-macro-bridge/README.md`, find the `## Install` section. Add a new subsection AT THE TOP (before Homebrew) since the .dmg is the most user-friendly path:

```markdown
### macOS (Apple Silicon) — drag-to-Applications .dmg (easiest, no Terminal)

Download `MidiMacroBridge-vX.Y.Z.dmg` from the
[latest release](https://github.com/audiocontrol-org/audiocontrol/releases),
double-click to mount, drag `MidiMacroBridge.app` to Applications,
double-click the app to launch.

A native window opens showing the bridge's web UI. Close the window
to quit; the bridge runs only while the window is open. The .dmg is
signed and notarized — no Gatekeeper workaround needed.

For service / daemon / always-on use, see Homebrew below or
[INSTALL.md](INSTALL.md).
```

- [x] **Step 2: Add .dmg flow to INSTALL.md**

In `services/midi-macro-bridge/INSTALL.md`, add a section near the top:

```markdown
## .app installed from .dmg (interactive launch)

The .dmg distribution installs `MidiMacroBridge.app` to `/Applications`.
Launch it like any macOS app — by double-clicking. **The .app does not
register itself as a daemon, LaunchAgent, or Login Item.** This is
intentional: the .app is for interactive use; if you want the bridge
running continuously in the background, use the Homebrew install path
with `brew services start midi-macro-bridge` instead.

Quitting:
- Click the **HALT** button in the app window (3-second hold), or
- Close the window (red X / Cmd-W), or
- Cmd-Q (when implemented in a future version with proper menubar)

All three trigger the same graceful shutdown.
```

- [x] **Step 3: Seed CHANGELOG v0.2.0 entry**

In `services/midi-macro-bridge/CHANGELOG.md`, add a new section ABOVE `## v0.1.0`:

```markdown
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
```

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/README.md services/midi-macro-bridge/INSTALL.md services/midi-macro-bridge/CHANGELOG.md
git commit -m "docs(midi-macro-bridge): document .dmg install path + seed CHANGELOG v0.2.0"
```

---

### Task 7.10: Phase 7 close-out — file deferred-item issues + back-fill

**Files (multiple GitHub issues + spec + workplan + PRD):**

This task implements **AC #9** from the spec. Per the spec's "Deferred to later releases" table, every item must be tracked as a GitHub issue + PRD entry + workplan entry before Phase 7 can move to Complete.

- [x] **Step 1: File one GitHub issue per deferred item**

For each row in the spec's "Deferred to later releases" table, run:

```bash
# Phase 8a: Status bar icon
gh issue create --repo audiocontrol-org/audiocontrol \
    --title "[midi-macro-bridge-packaging] Phase 8a: Status bar icon for MidiMacroBridge.app" \
    --body "Tracks the deferred 'status bar icon / menubar item' from the v0.2.0 macOS .app design spec. Adds the tray-icon crate and a status item with HALT/About menu items. See spec: https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/2026-05-05-macos-app-distribution-design.md" \
    --label enhancement
```

Repeat for each row in the table (Phase 8a, 8b, 8c, 8d, plus four PRD-only items: Linux/Windows GUI, custom DMG layout, universal binary, brew bottling). Capture each new issue number.

- [x] **Step 2: Back-fill issue numbers into the spec**

In the spec's "Deferred to later releases" table, edit each row to append the issue number:

```
| Status bar icon / menubar item (`tray-icon` crate) | `Phase 8a: Status bar icon for MidiMacroBridge.app` ([#XYZ](...)) | New Phase 8a in workplan; PRD Future Phases |
```

- [x] **Step 3: Update the PRD's Out-of-Scope section**

In `docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/prd.md`, add a "Future phases" subsection under "Out of Scope" listing each deferred item with its issue link.

- [x] **Step 4: Add Phase 8 stubs to workplan**

Append placeholder Phase 8a / 8b / 8c / 8d sections to the workplan, each with a one-line description and a link to the corresponding GitHub issue. The actual implementation tasks for Phase 8 are out of scope for now — but the phase scaffolding ensures the work is tracked structurally.

- [x] **Step 5: Mark all Phase 7 checkboxes complete**

```bash
python3 -c "
from pathlib import Path
p = Path('docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/workplan.md')
lines = p.read_text().splitlines(keepends=True)
flipped = 0
in_phase7 = False
for i, line in enumerate(lines):
    if line.startswith('## Phase 7:'):
        in_phase7 = True
    elif line.startswith('## Phase ') and in_phase7:
        in_phase7 = False
    if in_phase7 and line.startswith('- [ ] '):
        lines[i] = '- [x] ' + line[6:]
        flipped += 1
p.write_text(''.join(lines))
print(f'flipped {flipped} Phase 7 checkboxes')
"
```

- [x] **Step 6: Update README phase status row**

Flip the Phase 7 row in `docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/README.md` from "In progress" → "Complete". Note: per AC #9, do NOT mark Complete until Steps 1-4 above are done.

- [x] **Step 7: Comment on the Phase 7 GitHub issue with completion summary**

Use `gh issue comment <phase7-issue-number> --body-file <file>` with a summary of the commits, the GitHub Release URL, the .dmg SHA, and the back-filled deferred-item issue numbers. Don't autonomously close the issue (per project memory).

- [x] **Step 8: Cut v0.2.0 release**

After the close-out is documented:

```bash
make -C services/midi-macro-bridge release VERSION=v0.2.0
```

This invokes `release.sh` which now produces the .dmg alongside tarballs (Tasks 7.6–7.8) and uploads everything to a v0.2.0 GitHub Release.

- [x] **Step 9: Update Homebrew formula**

After v0.2.0 ships:

```bash
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh v0.2.0 \
    /Users/orion/work/audiocontrol-work/homebrew-audiocontrol
```

Review diff in the tap repo, commit, push.

- [x] **Step 10: Final commit + push to main**

```bash
git add docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/
git commit -m "docs(midi-macro-bridge-packaging): close out Phase 7 — v0.2.0 shipped + deferred items tracked"
git push origin HEAD:main
```

---

## Phase 7 Acceptance Criteria

(Mirrors `2026-05-05-macos-app-distribution-design.md` §"Acceptance criteria".)

1. `make package-app VERSION=v0.0.2-test` produces a signed `MidiMacroBridge.app`. `codesign --verify --deep --strict` passes.
2. Double-click the `.app` from Finder → a native AppKit window opens within ~2s showing the bridge's existing HTMX UI. The HALT button quits the app cleanly. Closing the window (red X / Cmd-W) also quits cleanly.
3. `make package-dmg VERSION=v0.0.2-test` produces a signed and notarized `.dmg`. `spctl --assess --type install` passes.
4. Mounting the `.dmg`, dragging `MidiMacroBridge.app` to Applications, and double-clicking from `/Applications` reproduces the same launch flow as #2 — confirms `paths.rs` resolution works for an installed `.app`.
5. Brew install and tarball install (Phase 2 + 3) continue to work unchanged. The new GUI code path is gated by bundle detection or `--gui` flag and does not affect the headless service modes.
6. `make release VERSION=v0.2.0` includes the `.dmg` in the GitHub Release alongside the existing tarballs.
7. Phase 6 regression check (no `MIDI channel disconnected` within 2.5s of default-config startup) still passes for the GUI-launched binary.
8. The `.app` does not register a `LaunchAgent`, Login Items entry, or any other auto-start mechanism (per spec Non-goals). Verified: a freshly-installed `.app` does not appear in System Settings → General → Login Items, and `launchctl list | grep midi-macro-bridge` returns nothing after a double-click launch + window close.
9. Every item in the spec's "Deferred to later releases" table has a corresponding GitHub issue filed against the audiocontrol repo, with the issue number back-filled into the spec, AND a mirrored entry in the PRD's Out-of-Scope section AND in the workplan's Future Phases section. Phase 7 cannot move to Complete until this gate passes.


---

## Future Phases (deferred from Phase 7)

Stub references — full task breakdowns get authored when each phase is picked up.

### Phase 8a — Status bar icon for `MidiMacroBridge.app`

[#368](https://github.com/audiocontrol-org/audiocontrol/issues/368). Adds the `tray-icon` crate; persistent menubar item with bridge state indicator, "Open Window" menu item (re-show closed window), Quit. Requires reworking `gui::run_window` to be re-entrant or surfacing window state separately.

### Phase 8b — Single-instance lock for `MidiMacroBridge.app`

[#369](https://github.com/audiocontrol-org/audiocontrol/issues/369). Detect existing instance via lockfile or Mach port; second launch focuses the first window instead of failing on the CoreMIDI UniqueID collision.

### Phase 8c — Sparkle auto-updater

[#370](https://github.com/audiocontrol-org/audiocontrol/issues/370). Integrate Sparkle (or Tauri's updater) so installed `.app`s auto-update from GitHub Releases. Requires signed update feeds and the `SUPublicEDKey` for verification.

### Phase 8d — macOS menubar with Quit/About

[#376](https://github.com/audiocontrol-org/audiocontrol/issues/376). Proper macOS menubar via `tao`'s window-menu API: Cmd-Q (quit), Cmd-W (close window — same as today), About dialog, Preferences (open browser to `/api/config-form`).

### Polish + design assets

- [#371](https://github.com/audiocontrol-org/audiocontrol/issues/371) — wry GUI for Linux + Windows
- [#372](https://github.com/audiocontrol-org/audiocontrol/issues/372) — Pretty DMG layout (`create-dmg`)
- [#373](https://github.com/audiocontrol-org/audiocontrol/issues/373) — Universal binary (arm64 + Intel)
- [#374](https://github.com/audiocontrol-org/audiocontrol/issues/374) — Commission real `AppIcon.icns`
- [#375](https://github.com/audiocontrol-org/audiocontrol/issues/375) — Brew formula bottling the `.app`

---

## Phase 9: v0.2.1 polish — UI cleanup + tooling fixes

**Goal:** Resolve the three audiocontrol-repo bugs surfaced during the v0.2.0 release process. Ship as `v0.2.1`.

**Architecture:** Three independent fixes — HALT button removal in the embedded web UI, wiring `env!("CARGO_PKG_VERSION")` into the served HTML, and rewriting `update-homebrew-formula.sh`'s sha256 substitution to be structure-aware. None depend on each other; could be done in parallel, but workplan orders them by file locality (web/ then scripts/).

**Tech Stack:** No new dependencies. Existing Rust + Python 3 + bash.

---

### File Structure

| Path | Responsibility | Phase |
|---|---|---|
| `services/midi-macro-bridge/web/index.html` | Remove `.mmb-halt` div; replace `v1.0` literal with `__VERSION__` placeholder | 9.1 + 9.2 |
| `services/midi-macro-bridge/web/app.js` | Remove HALT hold-confirm logic | 9.1 |
| `services/midi-macro-bridge/web/app.css` | Remove `.mmb-halt` and related rules | 9.1 |
| `services/midi-macro-bridge/src/web/mod.rs` | Substitute `__VERSION__` for `env!("CARGO_PKG_VERSION")` in served `index.html`; optional: remove `POST /api/halt` route | 9.1 + 9.2 |
| `services/midi-macro-bridge/scripts/update-homebrew-formula.sh` | Rewrite sha256 substitution as structure-aware (URL-anchored) | 9.3 |

---

### Task 9.1: Remove HALT button (resolves #377)

**Files:**
- Modify: `services/midi-macro-bridge/web/index.html`
- Modify: `services/midi-macro-bridge/web/app.js`
- Modify: `services/midi-macro-bridge/web/app.css`
- Modify: `services/midi-macro-bridge/src/web/mod.rs` (optional — keep `/api/halt` as undocumented escape hatch, OR remove)

- [x] **Step 1: Locate the HALT button markup**

```bash
grep -n 'mmb-halt\|HALT\|halt' services/midi-macro-bridge/web/index.html
```

Note the line range of the `.mmb-halt` div in `index.html`.

- [x] **Step 2: Remove the markup from index.html**

Open `services/midi-macro-bridge/web/index.html`. Find the `<div class="mmb-halt">...</div>` block (likely a sibling of the `.mmb-version` span in the top-bar area). Delete the entire div. Preserve surrounding markup.

- [x] **Step 3: Locate and remove the JS handler**

```bash
grep -n 'halt\|setupHaltButton\|holdToConfirm\|/api/halt' services/midi-macro-bridge/web/app.js
```

Delete:
- The `setupHaltButton` function (or whatever the hold-to-confirm handler is named)
- Its registration in the DOMContentLoaded / module init
- Any helper functions used only by HALT (`startHaltTimer`, `cancelHaltTimer`, etc.)

If the helpers are also used by other parts of the UI, leave them but rename if their HALT-flavored names are now misleading.

- [x] **Step 4: Remove the CSS rules**

```bash
grep -n 'mmb-halt\|halt-' services/midi-macro-bridge/web/app.css
```

Delete `.mmb-halt`, `.mmb-halt:hover`, `.halt-ring`, `.halt-fill`, and any other `.halt-*` selectors.

- [x] **Step 5: Decide on the route**

The `POST /api/halt` route in `src/web/mod.rs` either stays (as an undocumented escape hatch reachable via curl) or goes (full removal of the surface).

**Recommendation:** keep the route. It's small (~5 lines), provides a graceful curl-driven shutdown for headless brew users who want a remote stop without `brew services stop`, and removing it requires also removing the `Cmd::Halt` channel sender — more code surface for marginal benefit.

If you choose to remove it: delete the route registration in `mod.rs`, remove the handler function, optionally remove the `Cmd::Halt` variant if no other consumer remains. Verify build clean.

- [x] **Step 6: Build + manual verify**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
cargo build --release --target aarch64-apple-darwin --manifest-path services/midi-macro-bridge/Cargo.toml 2>&1 | tail -3
```

Expected: clean build.

Open the running bridge in a browser (or via the .app's window). Verify:
- HALT button is gone from the top-bar UI.
- Layout doesn't have a hole where the button used to be (CSS adjacent margins look right).
- Status indicator + version string remain.

- [x] **Step 7: Commit**

```bash
git add services/midi-macro-bridge/web/ services/midi-macro-bridge/src/web/mod.rs
git commit -m "fix(midi-macro-bridge): remove HALT button from web UI (#377)"
```

---

### Task 9.2: Wire `CARGO_PKG_VERSION` into the web UI (resolves #378)

**Files:**
- Modify: `services/midi-macro-bridge/web/index.html`
- Modify: `services/midi-macro-bridge/src/web/mod.rs`

- [x] **Step 1: Replace the static literal with a placeholder**

Edit `services/midi-macro-bridge/web/index.html`. The `mmb-version` span currently contains the literal `v1.0`. Replace with a substitution placeholder:

```html
<span class="mmb-version">__VERSION__</span>
```

(Reuse the same `__VERSION__` token convention used by Phase 7's `Info.plist.tmpl` for consistency.)

- [x] **Step 2: Substitute at server startup in src/web/mod.rs**

Find the route handler that serves `/` (returns the embedded `index.html`). It looks something like:

```rust
async fn serve_index() -> impl IntoResponse {
    Html(WebAssets::get("index.html").unwrap().data.into_owned())
}
```

(Adapt to whatever the existing handler shape is — `axum::response::Html<String>` or equivalent.)

Add a module-level `OnceLock<String>` for the rendered HTML so we only do the substitution once:

```rust
use std::sync::OnceLock;

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn rendered_index() -> &'static str {
    static CACHED: OnceLock<String> = OnceLock::new();
    CACHED.get_or_init(|| {
        let raw = WebAssets::get("index.html")
            .expect("index.html embedded via rust_embed");
        let html = std::str::from_utf8(&raw.data)
            .expect("index.html is valid UTF-8");
        html.replace("__VERSION__", VERSION)
    })
}
```

Update the `/` handler to serve `rendered_index()`:

```rust
async fn serve_index() -> impl IntoResponse {
    Html(rendered_index())
}
```

- [x] **Step 3: Build + verify**

```bash
cd services/midi-macro-bridge && cargo build 2>&1 | tail -3
./target/debug/midi-macro-bridge --no-open >/tmp/version-smoke.log 2>&1 &
PID=$!
sleep 2
curl -s http://127.0.0.1:8765/ | grep -o '<span class="mmb-version">[^<]*</span>'
kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
```

Expected output: `<span class="mmb-version">0.2.1</span>` (whatever the current Cargo.toml version is at the time of the run).

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/web/index.html services/midi-macro-bridge/src/web/mod.rs
git commit -m "fix(midi-macro-bridge): wire CARGO_PKG_VERSION into web UI (#378)"
```

---

### Task 9.3: Fix `update-homebrew-formula.sh` regex (resolves #379)

**Files:**
- Modify: `services/midi-macro-bridge/scripts/update-homebrew-formula.sh`

- [x] **Step 1: Replace the broken substitution block**

Open `services/midi-macro-bridge/scripts/update-homebrew-formula.sh`. Find the Python heredoc that does `re.sub`. Replace the body with a structure-aware version that anchors by URL:

```python
import re

with open("$FORMULA") as f:
    src = f.read()

# Update the version literal first.
src = re.sub(r'version "[^"]+"', 'version "$VERSION_NO_V"', src)

# First-install path: replace placeholder strings if still present.
src = src.replace('PLACEHOLDER_MAC_ARM64_SHA256', '$MAC_ARM_SHA')
src = src.replace('PLACEHOLDER_LINUX_X86_64_SHA256', '$LINUX_X64_SHA')

# Subsequent-install path: replace the sha256 line that immediately follows
# a url containing the platform substring. Multi-line, structure-aware:
def replace_sha_for_platform(src, platform_substr, new_sha):
    pattern = re.compile(
        r'(url\s+"[^"]*' + re.escape(platform_substr) + r'[^"]*"\s*\n\s*sha256\s+")[a-f0-9]{64}(")',
        re.MULTILINE,
    )
    new_src, n = pattern.subn(rf'\g<1>{new_sha}\g<2>', src)
    return new_src, n

src, mac_n = replace_sha_for_platform(src, 'aarch64-apple-darwin', '$MAC_ARM_SHA')
src, linux_n = replace_sha_for_platform(src, 'x86_64-unknown-linux-gnu', '$LINUX_X64_SHA')

# Verify substitutions actually happened. Refuse silent success.
if mac_n == 0:
    raise SystemExit('ERROR: failed to substitute macOS arm64 sha256 — formula structure may have changed')
if linux_n == 0:
    raise SystemExit('ERROR: failed to substitute Linux x86_64 sha256 — formula structure may have changed')

with open("$FORMULA", "w") as f:
    f.write(src)

print(f'  ✓ macOS arm64 sha256 substitution: {mac_n} match(es)')
print(f'  ✓ Linux x86_64 sha256 substitution: {linux_n} match(es)')
```

The key changes:
1. Multi-line URL-then-sha256 pattern (was single-line).
2. `subn` instead of `sub` — counts matches.
3. Hard fail if either substitution didn't happen.

- [x] **Step 2: Smoke test on the live tap**

The tap at `/Users/orion/work/audiocontrol-work/homebrew-audiocontrol` is currently at v0.2.0. Test the script against a synthetic v0.2.0-test pretending we're updating to it. We'll undo afterward.

```bash
# Save the current formula so we can restore it.
cp /Users/orion/work/audiocontrol-work/homebrew-audiocontrol/Formula/midi-macro-bridge.rb /tmp/midi-macro-bridge.rb.bak

# Run the script. Should now substitute the SHAs even though placeholders are absent.
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh v0.2.0 \
    /Users/orion/work/audiocontrol-work/homebrew-audiocontrol 2>&1 | tail -10

# Verify.
diff /tmp/midi-macro-bridge.rb.bak /Users/orion/work/audiocontrol-work/homebrew-audiocontrol/Formula/midi-macro-bridge.rb
# Expected: no diff (re-applying v0.2.0 over v0.2.0 is a no-op).

# Restore (in case anything drifted).
cp /tmp/midi-macro-bridge.rb.bak /Users/orion/work/audiocontrol-work/homebrew-audiocontrol/Formula/midi-macro-bridge.rb
```

The new "fail loudly if substitution didn't match" behavior will be exercised on the next real release (v0.2.1 will be the first end-to-end test).

- [x] **Step 3: Commit**

```bash
git add services/midi-macro-bridge/scripts/update-homebrew-formula.sh
git commit -m "fix(midi-macro-bridge): structure-aware sha256 substitution in update-homebrew-formula.sh (#379)"
```

---

### Task 9.4: Phase 9 close-out + v0.2.1 release

- [ ] **Step 1: Bump Cargo.toml to 0.2.1**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
```

Edit `services/midi-macro-bridge/Cargo.toml` line 3:

```toml
version = "0.2.1"
```

Refresh Cargo.lock:

```bash
cargo build --release --target aarch64-apple-darwin --manifest-path services/midi-macro-bridge/Cargo.toml 2>&1 | tail -3
```

- [ ] **Step 2: Add v0.2.1 entry to CHANGELOG.md**

Insert above the existing `## v0.2.0` section in `services/midi-macro-bridge/CHANGELOG.md`:

```markdown
## v0.2.1

### Highlights
- Removed HALT button from the web UI (#377). The .app's window-close + brew services stop already provide graceful shutdown; the hold-to-confirm UX was non-discoverable and redundant.
- Fixed the version string shown in the web UI — now reads from `CARGO_PKG_VERSION` instead of the hardcoded `v1.0` literal (#378).
- Fixed `update-homebrew-formula.sh` to do structure-aware sha256 substitution; the script now fails loudly if substitution didn't match (#379). Previously, subsequent releases would silently ship stale SHAs.
```

- [ ] **Step 3: Commit version + changelog**

```bash
git add services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/Cargo.lock services/midi-macro-bridge/CHANGELOG.md
git commit -m "chore(midi-macro-bridge): bump to v0.2.1 + changelog entry"
```

- [x] **Step 4: Mark Phase 9 checkboxes complete in workplan**

```bash
python3 -c "
from pathlib import Path
p = Path('docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/workplan.md')
lines = p.read_text().splitlines(keepends=True)
flipped = 0
in_phase9 = False
for i, line in enumerate(lines):
    if line.startswith('## Phase 9:'):
        in_phase9 = True
        continue
    if line.startswith('## Phase ') and in_phase9:
        in_phase9 = False
    if in_phase9 and line.startswith('- [ ] '):
        lines[i] = '- [x] ' + line[6:]
        flipped += 1
p.write_text(''.join(lines))
print(f'flipped {flipped} Phase 9 checkboxes')
"
```

- [ ] **Step 5: Flip README phase 9 row to Complete**

```bash
sed -i '' 's|^| 9 | v0.2.1 polish.*Not started.*$| 9 | v0.2.1 polish — UI cleanup + tooling fixes (HALT button removed; version string wired to CARGO_PKG_VERSION; formula update script regex fixed) | Complete |g' \
    docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/README.md
```

(If sed isn't a clean fit, edit the README phase table line manually with the Edit tool.)

- [ ] **Step 6: Cut the release**

```bash
make -C services/midi-macro-bridge release VERSION=v0.2.1
```

Expected: preflight passes, `package-all` builds tarballs + .dmg with notarization, .app smoke test passes, tag pushed, GitHub Release created with all 7 artifacts.

- [ ] **Step 7: Update Homebrew formula**

```bash
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh v0.2.1 \
    /Users/orion/work/audiocontrol-work/homebrew-audiocontrol
```

Verify the diff in the tap repo. The Task 9.3 fix means the SHAs should now actually update (and fail loudly if they don't).

```bash
cd /Users/orion/work/audiocontrol-work/homebrew-audiocontrol
git diff Formula/midi-macro-bridge.rb  # version + 2 sha256s should change
git add Formula/midi-macro-bridge.rb
git commit -m "midi-macro-bridge 0.2.1"
git push origin main
```

- [ ] **Step 8: Push feature branch HEAD to main**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
git push origin HEAD:main
```

- [ ] **Step 9: Comment on each fixed issue with the v0.2.1 release link**

```bash
for issue in 377 378 379; do
    gh issue comment $issue --repo audiocontrol-org/audiocontrol \
        --body "Fixed in v0.2.1: https://github.com/audiocontrol-org/audiocontrol/releases/tag/v0.2.1"
done
```

Don't autonomously close — leave for user acceptance per project memory rule.

---

## Phase 9 Acceptance Criteria

1. `make package-app VERSION=v0.0.2-test-p9` (from a clean state) produces a signed `.app` whose web UI shows the actual version (`0.0.2-test-p9`) and has no HALT button.
2. The `.app`'s window-close still triggers graceful shutdown (regression check).
3. The `.app`'s web UI status indicator + config form + event stream + apply-button work as before — only the HALT button is gone.
4. `update-homebrew-formula.sh v0.2.1 <tap>` produces a formula with the correct v0.2.1 SHAs (no manual editing required).
5. If the regex substitution fails to match (e.g., we change the formula's structure later), the script exits non-zero with an explicit error rather than reporting silent success.
6. v0.2.1 ships via `make release` with all three fixes landed.

---

## Phase 8: Mac-app polish — status bar + single-instance + menubar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle three tightly-related Mac-app-feel improvements that share `tao`/`tray-icon` infrastructure: a persistent menubar (status bar) icon, a single-instance lock that focuses the existing window on second launch, and a proper macOS app menubar (Cmd-Q, About, Preferences). Ship as **v0.3.0**.

**Architecture:** The current `gui::run_window` blocks the main thread on a single tao event loop and exits when the window closes. Phase 8 inverts this: the event loop persists for the lifetime of the process, the window becomes a child surface that can be hidden+reshown without exiting, and a status bar item provides always-visible presence + a "Show Window" / "Quit" menu. Single-instance enforcement uses a lockfile + Unix domain socket — second launch sends a "show" message to the existing instance and exits. The macOS app menubar uses `tao`'s built-in menu APIs (no extra crate).

**Tech Stack:** `tray-icon = "0.21"` (or current; macOS-gated like `tao`/`wry`); existing `tao 0.30` for menubar via its `MenuBuilder`; standard library `std::os::unix::net::UnixListener` + `flock` for single-instance.

---

### File Structure

| Path | Responsibility | Task |
|---|---|---|
| `services/midi-macro-bridge/Cargo.toml` | Add `tray-icon` macOS-gated dep | 8.1 |
| `services/midi-macro-bridge/src/gui.rs` | Refactor `run_window` to non-exiting model; expose `WindowHandle` to outside; install status bar item | 8.1 |
| `services/midi-macro-bridge/src/single_instance.rs` (new) | Lockfile + Unix-socket "show" IPC; binds at startup, exits early if another instance owns the lock and successfully relays the message | 8.2 |
| `services/midi-macro-bridge/src/main.rs` | Wire single-instance check before web server bind; pass `WindowHandle` to single-instance handler | 8.2 |
| `services/midi-macro-bridge/src/gui_menu.rs` (new) | macOS app menubar via `tao::menu::MenuBuilder`: About / Preferences / Quit | 8.3 |
| `services/midi-macro-bridge/CHANGELOG.md` | Seed `## v0.3.0` entry | 8.4 |
| `services/midi-macro-bridge/Cargo.toml` | Bump version to 0.3.0 | 8.4 |

---

### Task 8.1: Status bar icon via `tray-icon` (resolves #368)

**Files:**
- Modify: `services/midi-macro-bridge/Cargo.toml`
- Modify: `services/midi-macro-bridge/src/gui.rs`

The current `run_window` blocks until the window closes, then exits. After 8.1, `run_window` runs an event loop that:
- Manages the wry window (still WKWebView-backed)
- Hosts a `tray_icon::TrayIcon` in the macOS menubar with a "Show Window" + "Quit" menu
- On window close → hide window (don't exit). On tray "Show Window" → unhide + raise.
- On tray "Quit" → `halt.send()`, then break the event loop.

- [x] **Step 1: Add the `tray-icon` dep**

Edit `services/midi-macro-bridge/Cargo.toml`. Add to the macOS-gated deps section (where `tao` and `wry` already live):

```toml
[target.'cfg(target_os = "macos")'.dependencies]
tao = "0.30"
wry = "0.45"
tray-icon = "0.21"
```

- [x] **Step 2: Embed a status bar icon image**

Create a 22x22 PNG (macOS menubar standard icon size) at `services/midi-macro-bridge/packaging/macos/StatusBarIcon.png`. Generate via the same approach as the AppIcon placeholder (Phase 7 Task 7.4) but at 22x22 — text "M" or a single bridge glyph.

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
sips -z 22 22 services/midi-macro-bridge/packaging/macos/AppIcon.icns --out /tmp/StatusBarIcon.png 2>/dev/null
# If sips can't read .icns directly, extract via iconutil:
iconutil -c iconset -o /tmp/AppIcon.iconset services/midi-macro-bridge/packaging/macos/AppIcon.icns
sips -z 22 22 /tmp/AppIcon.iconset/icon_16x16@2x.png --out /tmp/StatusBarIcon.png
mv /tmp/StatusBarIcon.png services/midi-macro-bridge/packaging/macos/StatusBarIcon.png
rm -rf /tmp/AppIcon.iconset
file services/midi-macro-bridge/packaging/macos/StatusBarIcon.png
```

Expected: `PNG image data, 22 x 22, 8-bit/color RGBA`.

- [x] **Step 3: Embed the icon at compile time + refactor `run_window`**

Replace `services/midi-macro-bridge/src/gui.rs` with the new event-loop-persistent version:

```rust
//! Native AppKit window hosting the embedded web UI via wry/WebView,
//! plus a persistent status bar item and signal-driven shutdown.
//!
//! Compiled only on macOS. Other platforms skip the module entirely.

use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop, EventLoopBuilder};
use tao::menu::{ContextMenu, MenuItemAttributes};
use tao::system_tray::SystemTrayBuilder;
use tao::window::{Window, WindowBuilder};
use tray_icon::menu::{Menu, MenuEvent, MenuItem};
use tray_icon::{Icon, TrayIconBuilder};
use wry::WebViewBuilder;

const STATUS_BAR_ICON_PNG: &[u8] = include_bytes!("../packaging/macos/StatusBarIcon.png");

/// Open the bridge UI window and run the macOS event loop until the user
/// quits via the status bar menu OR `halt` fires from another source
/// (e.g., the in-page HALT button in earlier versions, or signal handler).
pub fn run_window(url: &str, halt: impl Fn() + Send + 'static) -> anyhow::Result<()> {
    let event_loop: EventLoop<UserEvent> = EventLoopBuilder::with_user_event().build();
    let event_loop_proxy = event_loop.create_proxy();

    let window = build_window(&event_loop)?;
    let _webview = WebViewBuilder::new(&window)
        .with_url(url)
        .build()?;

    let (tray, _menu_show, _menu_quit) = build_tray_icon(&event_loop_proxy)?;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            // Window close → hide window, keep the app alive (status bar still there).
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                window.set_visible(false);
            }
            Event::UserEvent(UserEvent::ShowWindow) => {
                window.set_visible(true);
                window.set_focus();
            }
            Event::UserEvent(UserEvent::Quit) => {
                halt();
                drop(tray.clone()); // explicit teardown; macOS clears the menubar item
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });

    #[allow(unreachable_code)]
    Ok(())
}

#[derive(Debug, Clone)]
enum UserEvent {
    ShowWindow,
    Quit,
}

fn build_window(event_loop: &EventLoop<UserEvent>) -> anyhow::Result<Window> {
    Ok(WindowBuilder::new()
        .with_title("MIDI Macro Bridge")
        .with_inner_size(LogicalSize::new(900.0, 700.0))
        .build(event_loop)?)
}

fn build_tray_icon(
    proxy: &tao::event_loop::EventLoopProxy<UserEvent>,
) -> anyhow::Result<(tray_icon::TrayIcon, MenuItem, MenuItem)> {
    let icon = Icon::from_rgba_bytes(STATUS_BAR_ICON_PNG, 22, 22)?;
    let menu = Menu::new();
    let show = MenuItem::new("Show Window", true, None);
    let quit = MenuItem::new("Quit MIDI Macro Bridge", true, None);
    menu.append(&show)?;
    menu.append(&quit)?;

    let tray = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_icon(icon)
        .with_tooltip("MIDI Macro Bridge")
        .build()?;

    // Wire menu events to the tao event loop's user-event channel.
    let proxy_clone = proxy.clone();
    let show_id = show.id().clone();
    let quit_id = quit.id().clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        let _ = if event.id == show_id {
            proxy_clone.send_event(UserEvent::ShowWindow)
        } else if event.id == quit_id {
            proxy_clone.send_event(UserEvent::Quit)
        } else {
            Ok(())
        };
    }));

    Ok((tray, show, quit))
}
```

(The exact `tray-icon` API may have shifted — adapt as needed. Intent: 22x22 menubar icon; menu with "Show Window" + "Quit"; menu events route through the tao event-loop proxy.)

- [x] **Step 4: Build + verify**

```bash
cd services/midi-macro-bridge && cargo build 2>&1 | tail -10
```

Expected: clean build. tray-icon pulls in a few macOS framework links; first build takes 1-3 minutes.

- [x] **Step 5: Manual smoke test**

```bash
./target/debug/midi-macro-bridge --gui &
PID=$!
sleep 3
echo "Visible status bar icon? Click it."
# Wait for user to verify; then quit via the menu.
wait $PID 2>/dev/null || true
```

Acceptance: 22x22 menubar icon visible in macOS status bar; clicking it opens a menu with "Show Window" + "Quit MIDI Macro Bridge"; closing the window hides it (icon stays); clicking "Show Window" re-opens it; clicking "Quit MIDI Macro Bridge" exits cleanly.

- [x] **Step 6: Commit**

```bash
git add services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/Cargo.lock services/midi-macro-bridge/src/gui.rs services/midi-macro-bridge/packaging/macos/StatusBarIcon.png
git commit -m "feat(midi-macro-bridge): persistent status bar icon (#368)"
```

---

### Task 8.2: Single-instance lock + focus-existing-window (resolves #369)

**Files:**
- Create: `services/midi-macro-bridge/src/single_instance.rs`
- Modify: `services/midi-macro-bridge/src/main.rs`

Pattern: at startup, try to acquire an exclusive `flock` on `~/Library/Application Support/audiocontrol/midi-macro-bridge/instance.lock`. If held by another process, send a "show" message via a Unix domain socket at `~/Library/Application Support/audiocontrol/midi-macro-bridge/instance.sock` and exit cleanly.

The first instance owns both the lock and the socket; it accepts incoming "show" messages and forwards them to the gui event loop's `UserEvent::ShowWindow`.

- [x] **Step 1: Author `single_instance.rs`**

Create `services/midi-macro-bridge/src/single_instance.rs`:

```rust
//! Single-instance enforcement via lockfile + Unix socket IPC.
//!
//! At process start: try to flock(LOCK_EX|LOCK_NB) the instance.lock file.
//! - Success → we are the primary; spawn a Unix-socket listener that emits
//!   "show" requests to a callback when a secondary tries to launch.
//! - Failure → there's already a primary; connect to the socket, send a
//!   one-byte "show" command, exit 0.
//!
//! macOS-only for now (the rest of the GUI stack is too).

use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;

use crate::paths;

/// Returned to the caller. Holds the lock for the lifetime of the value.
/// Drop to release.
pub struct InstanceLock {
    _file: File,
}

/// Try to become the primary instance. Returns `Ok(InstanceLock)` if we
/// succeeded; returns `Err(SecondaryInstance)` if another primary exists.
/// On secondary case, the function ALREADY relayed the "show" message to
/// the primary before returning the error.
pub enum AcquireOutcome {
    Primary(InstanceLock, UnixListener),
    Secondary, // we already messaged the primary; caller exits 0
}

pub fn acquire() -> anyhow::Result<AcquireOutcome> {
    let state_dir = paths::resolve_state_dir(|| dirs::data_dir())
        .ok_or_else(|| anyhow::anyhow!("no data dir available; cannot acquire instance lock"))?;
    std::fs::create_dir_all(&state_dir)?;

    let lock_path = state_dir.join("instance.lock");
    let sock_path = state_dir.join("instance.sock");

    let lock_file = OpenOptions::new()
        .create(true)
        .write(true)
        .open(&lock_path)?;

    // flock LOCK_EX | LOCK_NB
    let fd = lock_file.as_raw_fd();
    let r = unsafe { libc::flock(fd, libc::LOCK_EX | libc::LOCK_NB) };
    if r != 0 {
        // Couldn't lock → secondary. Send "show" to primary.
        let mut stream = UnixStream::connect(&sock_path)?;
        stream.write_all(b"show\n")?;
        return Ok(AcquireOutcome::Secondary);
    }

    // We're primary. Replace any stale socket; create a new listener.
    let _ = std::fs::remove_file(&sock_path);
    let listener = UnixListener::bind(&sock_path)?;

    Ok(AcquireOutcome::Primary(
        InstanceLock { _file: lock_file },
        listener,
    ))
}

/// Spawn a thread that accepts incoming connections to the listener and
/// invokes `on_show()` for each "show" message received.
pub fn spawn_listener_thread(listener: UnixListener, on_show: Arc<dyn Fn() + Send + Sync>) {
    thread::Builder::new()
        .name("instance-listener".into())
        .spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { continue };
                let mut buf = [0u8; 16];
                let _ = s.read(&mut buf);
                if buf.starts_with(b"show") {
                    on_show();
                }
            }
        })
        .expect("instance-listener thread spawn");
}
```

Add `libc = "0.2"` to `Cargo.toml` regular deps (not macOS-gated; it's already used on Linux).

- [x] **Step 2: Wire into `main.rs`**

Find `fn main` in `services/midi-macro-bridge/src/main.rs`. After args parsing but before the web server bind, add:

```rust
// Single-instance check (macOS GUI mode only).
#[cfg(target_os = "macos")]
let _instance_lock = if resolve_gui_mode(&args) {
    match single_instance::acquire()? {
        single_instance::AcquireOutcome::Primary(lock, listener) => {
            // We'll wire the listener thread once the gui's UserEvent
            // proxy is constructed (see gui::run_window). For now, hold
            // the listener and pass it down.
            Some((lock, listener))
        }
        single_instance::AcquireOutcome::Secondary => {
            info!("another instance already running; messaged primary and exiting");
            return Ok(());
        }
    }
} else {
    None
};
```

Also add `mod single_instance;` to the existing module declarations (cfg-gated on macos).

The listener-thread wiring requires passing the `EventLoopProxy<UserEvent>` from `gui::run_window` out to the listener. Refactor `gui::run_window` to accept an optional setup callback that runs immediately after the proxy is constructed:

```rust
// In gui.rs, change run_window's signature:
pub fn run_window(
    url: &str,
    halt: impl Fn() + Send + 'static,
    setup: impl FnOnce(tao::event_loop::EventLoopProxy<UserEvent>) + Send + 'static,
) -> anyhow::Result<()> {
    let event_loop: EventLoop<UserEvent> = EventLoopBuilder::with_user_event().build();
    let proxy = event_loop.create_proxy();
    setup(proxy.clone()); // give the caller a handle to wake the loop
    // ... rest unchanged ...
}
```

Then `main.rs` passes a `setup` closure that takes the listener and spawns the thread:

```rust
let listener = _instance_lock.as_mut().map(|(_, l)| l.try_clone().unwrap());
gui::run_window(&url, halt_closure, move |proxy| {
    if let Some(listener) = listener {
        single_instance::spawn_listener_thread(
            listener,
            Arc::new(move || {
                let _ = proxy.send_event(gui::UserEvent::ShowWindow);
            }),
        );
    }
})?;
```

(Adapt to whatever the existing main.rs structure is; the key is that the listener thread runs INSIDE the primary instance and forwards "show" messages to the gui event loop.)

- [x] **Step 3: Smoke test single-instance behavior**

```bash
./target/debug/midi-macro-bridge --gui &
PID1=$!
sleep 2
echo "Primary launched (PID=$PID1)"
./target/debug/midi-macro-bridge --gui &
PID2=$!
sleep 2
echo "Second launch (PID=$PID2) should have exited 0; PID1 window should be visible/focused"
ps -p $PID2 2>/dev/null && echo "FAIL: secondary still running" || echo "PASS: secondary exited"
kill $PID1 2>/dev/null || true
wait $PID1 2>/dev/null || true
```

Acceptance: PID2 exits cleanly; PID1's window comes to the front (or unhides if it was hidden).

- [x] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/src/single_instance.rs services/midi-macro-bridge/src/main.rs services/midi-macro-bridge/src/gui.rs services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/Cargo.lock
git commit -m "feat(midi-macro-bridge): single-instance lock + focus-existing-window (#369)"
```

---

### Task 8.3: macOS app menubar (resolves #376)

**Files:**
- Create: `services/midi-macro-bridge/src/gui_menu.rs`
- Modify: `services/midi-macro-bridge/src/gui.rs`

Add a proper macOS app menubar with:
- **Application menu** — "About MIDI Macro Bridge" (modal showing CARGO_PKG_VERSION + license), "Preferences..." (Cmd-, opens browser to `/api/config-form`), separator, "Quit MIDI Macro Bridge" (Cmd-Q).
- **Window menu** — "Close Window" (Cmd-W) routed to the existing window-close handler.

`tao` provides menubar APIs via its `Menu` and `MenuBar` types; on macOS these become `NSMenu`-backed.

- [x] **Step 1: Author `gui_menu.rs`**

Create `services/midi-macro-bridge/src/gui_menu.rs`:

```rust
//! macOS app menubar — App menu (About / Preferences / Quit) + Window menu (Close).
//!
//! Routes menu actions through the same `UserEvent` channel the status bar
//! item uses (see gui.rs).

use tao::keyboard::{Key, ModifiersState};
use tao::menu::{Menu, MenuBar, MenuItemAttributes};

use crate::gui::UserEvent;

pub fn build_menubar() -> MenuBar {
    let mut menubar = MenuBar::new();

    // Application menu (first-position menus on macOS get the app name).
    let mut app_menu = Menu::new();
    app_menu.add_item(
        MenuItemAttributes::new("About MIDI Macro Bridge")
            .with_id(MenuId::About.into()),
    );
    app_menu.add_native_item(tao::menu::MenuItem::Separator);
    app_menu.add_item(
        MenuItemAttributes::new("Preferences...")
            .with_id(MenuId::Preferences.into())
            .with_accelerators(&Key::Character(",".into()), ModifiersState::SUPER),
    );
    app_menu.add_native_item(tao::menu::MenuItem::Separator);
    app_menu.add_item(
        MenuItemAttributes::new("Quit MIDI Macro Bridge")
            .with_id(MenuId::Quit.into())
            .with_accelerators(&Key::Character("q".into()), ModifiersState::SUPER),
    );
    menubar.add_submenu("MIDI Macro Bridge", true, app_menu);

    // Window menu.
    let mut window_menu = Menu::new();
    window_menu.add_item(
        MenuItemAttributes::new("Close Window")
            .with_id(MenuId::CloseWindow.into())
            .with_accelerators(&Key::Character("w".into()), ModifiersState::SUPER),
    );
    menubar.add_submenu("Window", true, window_menu);

    menubar
}

#[derive(Copy, Clone, Debug)]
pub enum MenuId {
    About,
    Preferences,
    Quit,
    CloseWindow,
}

impl From<MenuId> for tao::menu::MenuId {
    fn from(id: MenuId) -> Self {
        tao::menu::MenuId::new(match id {
            MenuId::About => "about",
            MenuId::Preferences => "preferences",
            MenuId::Quit => "quit",
            MenuId::CloseWindow => "close-window",
        })
    }
}

pub fn route_menu_event(
    event: tao::menu::MenuId,
    proxy: &tao::event_loop::EventLoopProxy<UserEvent>,
) -> bool {
    let s = event.0;
    match s.as_str() {
        "about" => { let _ = proxy.send_event(UserEvent::ShowAbout); true }
        "preferences" => { let _ = proxy.send_event(UserEvent::OpenPreferences); true }
        "quit" => { let _ = proxy.send_event(UserEvent::Quit); true }
        "close-window" => { let _ = proxy.send_event(UserEvent::CloseWindow); true }
        _ => false,
    }
}
```

(Tao's `Menu` API has shifted across versions; adapt the exact builder calls as needed. Intent: app menu with three items + window menu with Close.)

- [x] **Step 2: Wire into `gui.rs`**

Add `mod gui_menu;` to gui.rs (or keep as a sibling of gui.rs — adjust `mod` declarations in main.rs accordingly).

Extend `UserEvent`:

```rust
pub enum UserEvent {
    ShowWindow,
    CloseWindow,
    ShowAbout,
    OpenPreferences,
    Quit,
}
```

In `WindowBuilder` chain, attach the menubar:

```rust
let menubar = gui_menu::build_menubar();
let window = WindowBuilder::new()
    .with_title("MIDI Macro Bridge")
    .with_inner_size(LogicalSize::new(900.0, 700.0))
    .with_menu(menubar)
    .build(&event_loop)?;
```

Add event handlers in the event loop:

```rust
Event::MenuEvent { menu_id, .. } => {
    gui_menu::route_menu_event(menu_id, &proxy);
}
Event::UserEvent(UserEvent::CloseWindow) => {
    window.set_visible(false);
}
Event::UserEvent(UserEvent::ShowAbout) => {
    show_about_dialog(&window);  // small NSAlert call; see Step 3
}
Event::UserEvent(UserEvent::OpenPreferences) => {
    let _ = std::process::Command::new("open")
        .arg(format!("{}/api/config-form", url))
        .spawn();
}
```

- [x] **Step 3: Implement `show_about_dialog`**

For minimum viable About: use macOS's built-in NSAlert via `objc2`:

```rust
fn show_about_dialog(_window: &Window) {
    use objc2::rc::Retained;
    use objc2_app_kit::NSAlert;
    use objc2_foundation::NSString;
    let alert = unsafe { NSAlert::new() };
    let title = NSString::from_str("MIDI Macro Bridge");
    let info = NSString::from_str(&format!(
        "Version {}\n\nMIT OR Apache-2.0",
        env!("CARGO_PKG_VERSION")
    ));
    unsafe {
        alert.setMessageText(&title);
        alert.setInformativeText(&info);
        alert.runModal();
    }
}
```

Add `objc2 = "0.5"`, `objc2-foundation = "0.2"`, `objc2-app-kit = "0.2"` to the macOS-gated deps. (Versions may shift; `cargo add` to lock current.)

- [x] **Step 4: Build + smoke**

```bash
cd services/midi-macro-bridge && cargo build 2>&1 | tail -5
./target/debug/midi-macro-bridge --gui &
sleep 2
# Manually verify:
# - Cmd-Q exits cleanly
# - Cmd-W closes the window (status bar icon stays; "Show Window" reopens)
# - "MIDI Macro Bridge → About" shows version 0.3.0
# - "MIDI Macro Bridge → Preferences..." (Cmd-,) opens browser to /api/config-form
```

- [x] **Step 5: Commit**

```bash
git add services/midi-macro-bridge/src/gui_menu.rs services/midi-macro-bridge/src/gui.rs services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/Cargo.lock
git commit -m "feat(midi-macro-bridge): macOS app menubar with About/Preferences/Quit (#376)"
```

---

### Task 8.4: Phase 8 close-out + v0.3.0 release

- [ ] **Step 1: Bump Cargo.toml to 0.3.0**

Edit `services/midi-macro-bridge/Cargo.toml`:

```toml
version = "0.3.0"
```

Refresh `Cargo.lock`:

```bash
cd services/midi-macro-bridge && cargo build --release --target aarch64-apple-darwin 2>&1 | tail -3
```

- [ ] **Step 2: Add v0.3.0 entry to CHANGELOG.md**

Insert above `## v0.2.x` (whatever the current top entry is) in `services/midi-macro-bridge/CHANGELOG.md`:

```markdown
## v0.3.0

### Highlights
- **Status bar icon** (#368). Persistent menubar item with "Show Window" + "Quit" — bridge stays running with no Dock icon when the window is closed.
- **Single-instance lock** (#369). Second launch of the .app focuses the existing window via Unix-socket IPC instead of failing on CoreMIDI UniqueID collision.
- **Proper macOS app menubar** (#376). Cmd-Q quits, Cmd-W closes the window (status bar reopens it), Cmd-, opens preferences in the browser, About dialog shows the actual version.

### Notes
- The window now hides on close instead of exiting. Use the status bar icon's "Quit" or Cmd-Q to fully exit.
- Headless / brew-services modes unchanged — single-instance + status bar are macOS GUI-only.
```

- [x] **Step 3: Mark Phase 8 checkboxes complete**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
python3 -c "
from pathlib import Path
p = Path('docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/workplan.md')
lines = p.read_text().splitlines(keepends=True)
flipped = 0
in_phase8 = False
for i, line in enumerate(lines):
    if line.startswith('## Phase 8:'):
        in_phase8 = True
        continue
    if line.startswith('## Phase ') and in_phase8:
        in_phase8 = False
    if in_phase8 and line.startswith('- [ ] '):
        lines[i] = '- [x] ' + line[6:]
        flipped += 1
p.write_text(''.join(lines))
print(f'flipped {flipped} Phase 8 checkboxes')
"
```

- [x] **Step 4: Flip README phase 8 row to Complete**

Edit `docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/README.md` — change Phase 8's status column from "Not started" to "Complete; v0.3.0 shipped".

- [ ] **Step 5: Commit version bump + CHANGELOG**

```bash
git add services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/Cargo.lock services/midi-macro-bridge/CHANGELOG.md docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/
git commit -m "chore(midi-macro-bridge): bump to v0.3.0 + Phase 8 close-out"
```

- [ ] **Step 6: Cut the release**

```bash
make -C services/midi-macro-bridge release VERSION=v0.3.0
```

Expected: preflight passes, `package-all` builds tarballs + .dmg with notarization, .app smoke test passes, tag pushed, GitHub Release created.

- [ ] **Step 7: Update Homebrew formula**

```bash
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh v0.3.0 \
    /Users/orion/work/audiocontrol-work/homebrew-audiocontrol
```

If Phase 9 Task 9.3 has shipped (regex fix), substitution succeeds automatically. Otherwise, manually verify SHAs as we did for v0.2.0.

```bash
cd /Users/orion/work/audiocontrol-work/homebrew-audiocontrol
git diff Formula/midi-macro-bridge.rb
git add Formula/midi-macro-bridge.rb
git commit -m "midi-macro-bridge 0.3.0"
git push origin main
```

- [ ] **Step 8: Push feature branch HEAD to main**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
git push origin HEAD:main
```

- [ ] **Step 9: Comment on each child issue with the v0.3.0 release link**

```bash
for issue in 368 369 376; do
    gh issue comment $issue --repo audiocontrol-org/audiocontrol \
        --body "Fixed in v0.3.0: https://github.com/audiocontrol-org/audiocontrol/releases/tag/v0.3.0"
done
```

Don't autonomously close — leave for user acceptance.

---

## Phase 8 Acceptance Criteria

1. `make package-app VERSION=v0.0.3-test` produces a signed `.app`. Launching it shows a 22x22 status bar icon in the macOS menubar.
2. Closing the window (red X / Cmd-W) hides it. The status bar icon stays. Clicking "Show Window" in the status bar menu re-opens the window.
3. Clicking "Quit MIDI Macro Bridge" in the status bar menu, OR pressing Cmd-Q, exits the bridge cleanly (drains MIDI, closes web server).
4. Launching the `.app` while another instance is already running: the second launch exits cleanly; the first instance's window comes to the front.
5. The `MIDI Macro Bridge → About` menu item shows a dialog with `Version 0.3.0` (or whatever the current Cargo.toml version is).
6. Cmd-, (or `MIDI Macro Bridge → Preferences...`) opens the system default browser to `http://127.0.0.1:8765/api/config-form`.
7. Brew install + tarball install paths still work unchanged. Status bar / single-instance / menubar are macOS GUI-only; service modes are not affected.
8. Phase 6 regression check (`MIDI channel disconnected` within 2.5s of default-config startup) still passes.
