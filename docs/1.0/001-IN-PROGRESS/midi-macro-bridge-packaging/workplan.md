---
slug: midi-macro-bridge-packaging
targetVersion: "1.0"
date: 2026-05-05
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

- [ ] **Step 1: Write the launchd plist**

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

- [ ] **Step 2: Write the systemd user unit**

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

- [ ] **Step 3: Write QUARANTINE.md**

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

- [ ] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/share services/midi-macro-bridge/QUARANTINE.md
git commit -m "feat(midi-macro-bridge): add service unit templates + quarantine doc"
```

### Task 2.2: Author `package.sh`

**Files:**
- Create: `services/midi-macro-bridge/scripts/package.sh`

- [ ] **Step 1: Write the script**

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

- [ ] **Step 2: Author install.sh**

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

- [ ] **Step 3: Run package.sh locally**

```bash
cd services/midi-macro-bridge
./scripts/package.sh --target aarch64-apple-darwin --version v0.0.1-test
```

Expected output ends with:

```
✓ target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin.tar.gz
✓ ...sha256 (<64-hex-chars>  midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin.tar.gz)
```

- [ ] **Step 4: Verify the tarball contents**

```bash
tar -tzf target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin.tar.gz | head -20
```

Expected: `bin/midi-macro-bridge`, `share/midi-macro-bridge/config.example.toml`, `share/midi-macro-bridge/launchd/com.audiocontrol.midi-macro-bridge.plist`, `doc/README.md`, `doc/QUARANTINE.md`, `install.sh`.

- [ ] **Step 5: Smoke test the binary inside the staging dir**

```bash
cd target/release-package/midi-macro-bridge-v0.0.1-test-aarch64-apple-darwin
./bin/midi-macro-bridge &
PID=$!
sleep 2
kill $PID 2>/dev/null
```

Expected: bridge starts, logs `web server listening url=http://127.0.0.1:8765`, stays up until killed.

- [ ] **Step 6: Add `target/release-package/` to .gitignore**

Edit `services/midi-macro-bridge/.gitignore` and append:

```
target/release-package/
```

- [ ] **Step 7: Commit**

```bash
git add services/midi-macro-bridge/scripts services/midi-macro-bridge/.gitignore
git commit -m "feat(midi-macro-bridge): add package.sh + install.sh for tarball release"
```

### Task 2.3: Add `package` target to service Makefile

**Files:**
- Modify: `services/midi-macro-bridge/Makefile`

- [ ] **Step 1: Add the target**

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

- [ ] **Step 2: Verify**

```bash
make -C services/midi-macro-bridge package VERSION=v0.0.1-test 2>&1 | tail -5
```

Expected: produces a tarball at `target/release-package/`.

- [ ] **Step 3: Update help text**

In the Makefile's `help:` target, add a line for `package`.

- [ ] **Step 4: Commit**

```bash
git add services/midi-macro-bridge/Makefile
git commit -m "feat(midi-macro-bridge): add Makefile package target"
```

---

## Phase 3: Release CI Workflow

### Task 3.1: Author the workflow file

**Files:**
- Create: `.github/workflows/midi-macro-bridge-release.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/midi-macro-bridge-release.yml`:

```yaml
name: midi-macro-bridge release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag for dry-run (e.g. v0.0.1-rc1). No release will be published.'
        required: true

permissions:
  contents: write

jobs:
  preflight:
    name: Pre-flight checks
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.resolve.outputs.version }}
      is_dry_run: ${{ steps.resolve.outputs.is_dry_run }}
    steps:
      - uses: actions/checkout@v4

      - name: Resolve version
        id: resolve
        run: |
          if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]; then
            echo "version=${{ github.event.inputs.version }}" >> "$GITHUB_OUTPUT"
            echo "is_dry_run=true" >> "$GITHUB_OUTPUT"
          else
            echo "version=${GITHUB_REF#refs/tags/}" >> "$GITHUB_OUTPUT"
            echo "is_dry_run=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Assert Cargo.toml version matches tag
        run: |
          TAG="${{ steps.resolve.outputs.version }}"
          CARGO_VERSION="$(grep -E '^version = ' services/midi-macro-bridge/Cargo.toml | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
          EXPECTED="${TAG#v}"
          if [[ "$CARGO_VERSION" != "$EXPECTED" ]]; then
            echo "::error::Cargo.toml version ($CARGO_VERSION) does not match tag ($EXPECTED)"
            exit 1
          fi
          echo "✓ version match: $CARGO_VERSION"

  build:
    name: Build ${{ matrix.target }}
    needs: preflight
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-14
            target: aarch64-apple-darwin
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: services/midi-macro-bridge

      - name: Build + test
        working-directory: services/midi-macro-bridge
        run: |
          cargo test --release
          cargo build --release --target ${{ matrix.target }}
          # package.sh expects target/release/<bin>; symlink for cross-target builds.
          mkdir -p target/release
          cp target/${{ matrix.target }}/release/midi-macro-bridge target/release/

      - name: Smoke test (binary stays up)
        working-directory: services/midi-macro-bridge
        run: |
          ./target/release/midi-macro-bridge --no-open &
          PID=$!
          sleep 2
          if ! kill -0 $PID 2>/dev/null; then
            echo "::error::binary exited within 2 seconds"
            wait $PID
            exit 1
          fi
          kill $PID
          wait $PID 2>/dev/null || true

      - name: Package tarball
        working-directory: services/midi-macro-bridge
        run: ./scripts/package.sh --target ${{ matrix.target }} --version ${{ needs.preflight.outputs.version }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: midi-macro-bridge-${{ matrix.target }}
          path: |
            services/midi-macro-bridge/target/release-package/*.tar.gz
            services/midi-macro-bridge/target/release-package/*.sha256

  release:
    name: Publish GitHub Release
    needs: [preflight, build]
    if: needs.preflight.outputs.is_dry_run == 'false'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts/

      - name: Aggregate SHA256SUMS
        run: |
          cd artifacts
          find . -name '*.sha256' -exec cat {} \; > SHA256SUMS
          cat SHA256SUMS

      - name: Extract release notes from CHANGELOG
        id: notes
        run: |
          VERSION="${{ needs.preflight.outputs.version }}"
          # Grab everything between "## VERSION" and the next "## " heading
          awk -v v="$VERSION" '
            $0 ~ "^## " v "$" {flag=1; next}
            flag && /^## / {exit}
            flag {print}
          ' services/midi-macro-bridge/CHANGELOG.md > release-notes.md
          echo "--- release notes:"
          cat release-notes.md

      - name: Create GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="${{ needs.preflight.outputs.version }}"
          gh release create "$VERSION" \
            --title "midi-macro-bridge $VERSION" \
            --notes-file release-notes.md \
            artifacts/**/*.tar.gz artifacts/**/*.sha256 artifacts/SHA256SUMS
```

- [ ] **Step 2: Lint the workflow YAML**

```bash
# Use the GitHub Actions runner-image lint or just a YAML parser
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/midi-macro-bridge-release.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/midi-macro-bridge-release.yml
git commit -m "ci(midi-macro-bridge): add tag-driven release workflow"
git push origin feature/midi-macro-bridge-packaging
```

### Task 3.2: Workflow_dispatch dry run

- [ ] **Step 1: Trigger a dry run**

Via the GitHub web UI or:

```bash
gh workflow run midi-macro-bridge-release.yml \
    --ref feature/midi-macro-bridge-packaging \
    -f version=v0.0.1-rc1
```

(For this to work, `Cargo.toml` must say `version = "0.0.1-rc1"` — temporarily bump it on the branch for the dry run, then revert.)

- [ ] **Step 2: Watch the run**

```bash
gh run watch
```

Expected: pre-flight, both build jobs, no release-publish (dry run skips it).

- [ ] **Step 3: Download the artifacts and verify**

```bash
gh run download
ls midi-macro-bridge-*-darwin/ midi-macro-bridge-*-linux-gnu/
```

Expected: each contains a `.tar.gz` and `.sha256`.

- [ ] **Step 4: Revert the temporary Cargo.toml bump**

```bash
git restore services/midi-macro-bridge/Cargo.toml
```

- [ ] **Step 5: Commit any workflow tweaks discovered during dry run**

If the dry run revealed bugs, fix and recommit before tagging.

---

## Phase 4: Homebrew Tap

### Task 4.1: Create the tap repo

- [ ] **Step 1: Bootstrap the repo on GitHub**

```bash
gh repo create audiocontrol-org/homebrew-audiocontrol \
    --public \
    --description "Homebrew tap for audiocontrol tools" \
    --clone
```

Resulting clone: `~/homebrew-audiocontrol/` (or wherever `gh` deposits it).

- [ ] **Step 2: Bootstrap the formula directory**

```bash
cd /path/to/homebrew-audiocontrol
mkdir -p Formula
```

- [ ] **Step 3: Write the formula skeleton (placeholder URLs/SHA256s)**

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

- [ ] **Step 4: Initial README.md for the tap**

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

- [ ] **Step 5: Commit and push the tap**

```bash
cd /path/to/homebrew-audiocontrol
git add Formula/midi-macro-bridge.rb README.md
git commit -m "feat: initial midi-macro-bridge formula (placeholder SHA256s)"
git push origin main
```

### Task 4.2: SHA256 update helper

**Files:** (back in audiocontrol worktree)
- Create: `services/midi-macro-bridge/scripts/update-homebrew-formula.sh`

- [ ] **Step 1: Write the helper**

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

- [ ] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/scripts/update-homebrew-formula.sh
git commit -m "feat(midi-macro-bridge): add Homebrew formula SHA256 update helper"
```

---

## Phase 5: Documentation

### Task 5.1: README install section

**Files:**
- Modify: `services/midi-macro-bridge/README.md`

- [ ] **Step 1: Replace the existing "Build" section**

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

- [ ] **Step 2: Add a "Run" section after install**

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

- [ ] **Step 3: Commit**

```bash
git add services/midi-macro-bridge/README.md
git commit -m "docs(midi-macro-bridge): rewrite install + run sections for packaged releases"
```

### Task 5.2: Seed CHANGELOG.md

**Files:**
- Create: `services/midi-macro-bridge/CHANGELOG.md`

- [ ] **Step 1: Write the changelog**

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

- [ ] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/CHANGELOG.md
git commit -m "docs(midi-macro-bridge): seed CHANGELOG with v0.1.0 entry"
```

### Task 5.3: INSTALL.md service activation steps

**Files:**
- Create: `services/midi-macro-bridge/INSTALL.md`

- [ ] **Step 1: Write the doc**

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

- [ ] **Step 2: Commit**

```bash
git add services/midi-macro-bridge/INSTALL.md
git commit -m "docs(midi-macro-bridge): add service activation instructions"
```

---

## Phase 6: First Release (v0.1.0)

### Task 6.1: Final pre-tag verification

- [ ] **Step 1: Confirm Cargo.toml version is `0.1.0`**

```bash
grep '^version = ' services/midi-macro-bridge/Cargo.toml
```

If not, edit it.

- [ ] **Step 2: Run a workflow_dispatch dry run from main**

After the feature branch is merged to main:

```bash
gh workflow run midi-macro-bridge-release.yml --ref main -f version=v0.1.0-rc1
gh run watch
```

(Same caveat: temporarily bump Cargo.toml to `0.1.0-rc1` for the dry run if you want the version assertion to pass against the dispatch input — or skip the assertion check via a workflow flag if you add one.)

- [ ] **Step 3: Verify smoke-test step passed in both build jobs**

The smoke test asserts the binary doesn't exit within 2 seconds of launch under default config. This is the regression coverage for the `MIDI channel disconnected` bug fixed in commit `814e7d27`.

### Task 6.2: Tag and ship v0.1.0

- [ ] **Step 1: From main, tag and push**

```bash
git checkout main
git pull
git tag v0.1.0
git push origin v0.1.0
```

- [ ] **Step 2: Watch the workflow**

```bash
gh run watch
```

Expected: pre-flight passes (Cargo.toml = 0.1.0 matches v0.1.0 tag), both builds pass smoke test, release publish creates the GitHub Release with both tarballs and SHA256SUMS attached.

- [ ] **Step 3: Verify the GitHub Release**

```bash
gh release view v0.1.0
```

Expected: lists `midi-macro-bridge-v0.1.0-aarch64-apple-darwin.tar.gz`,
`...-x86_64-unknown-linux-gnu.tar.gz`, `*.sha256`, `SHA256SUMS`.

### Task 6.3: Smoke-test the macOS arm64 tarball

- [ ] **Step 1: Download and extract**

```bash
cd /tmp
gh release download v0.1.0 --repo audiocontrol-org/audiocontrol \
    --pattern '*aarch64-apple-darwin*'
shasum -a 256 -c midi-macro-bridge-v0.1.0-aarch64-apple-darwin.tar.gz.sha256
tar -xzf midi-macro-bridge-v0.1.0-aarch64-apple-darwin.tar.gz
cd midi-macro-bridge-v0.1.0-aarch64-apple-darwin
```

- [ ] **Step 2: Run install.sh + clear quarantine**

```bash
./install.sh
xattr -d com.apple.quarantine "$HOME/.local/bin/midi-macro-bridge" || true
```

- [ ] **Step 3: Run the binary**

```bash
"$HOME/.local/bin/midi-macro-bridge" --no-open &
PID=$!
sleep 2
kill $PID 2>/dev/null
```

Expected: bridge starts, logs `web server listening`, stays up. Confirms paths.rs resolution works for an installed binary launched from elsewhere.

### Task 6.4: Smoke-test the Linux x86_64 tarball

- [ ] **Step 1: On a Linux x86_64 host (e.g., a Debian VM or container)**

```bash
cd /tmp
curl -L -o midi-macro-bridge.tar.gz \
    "https://github.com/audiocontrol-org/audiocontrol/releases/download/v0.1.0/midi-macro-bridge-v0.1.0-x86_64-unknown-linux-gnu.tar.gz"
tar -xzf midi-macro-bridge.tar.gz
cd midi-macro-bridge-v0.1.0-x86_64-unknown-linux-gnu
./install.sh
~/.local/bin/midi-macro-bridge --no-open &
sleep 2
kill %1 2>/dev/null
```

Expected: similar to macOS — bridge starts, stays up.

### Task 6.5: Update Homebrew formula and ship

- [ ] **Step 1: Run the SHA256 update helper**

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh v0.1.0 \
    /path/to/homebrew-audiocontrol
```

- [ ] **Step 2: Review the diff in the tap repo**

```bash
cd /path/to/homebrew-audiocontrol
git diff Formula/midi-macro-bridge.rb
```

Expected: version bump + two real SHA256s replacing placeholders.

- [ ] **Step 3: Commit and push the tap**

```bash
git add Formula/midi-macro-bridge.rb
git commit -m "midi-macro-bridge 0.1.0"
git push origin main
```

- [ ] **Step 4: End-to-end brew install test**

On a clean macOS Apple Silicon machine (or via `brew uninstall` first):

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

- [ ] **Step 1: Update the feature README status table**

Mark phases 1–6 complete in `docs/1.0/001-IN-PROGRESS/midi-macro-bridge-packaging/README.md`.

- [ ] **Step 2: Write a DEVELOPMENT-NOTES.md entry**

In `DEVELOPMENT-NOTES.md`, add an entry following the project journal template (see `.claude/CLAUDE.md`'s Development Journal section).

- [ ] **Step 3: Run `/dw-lifecycle:complete`**

The skill will move the feature docs to `002-COMPLETE/`, update ROADMAP.md, and close the GitHub issues.

---

## Acceptance Criteria

A v0.1.0 release passes when:

1. Pushing tag `v0.1.0` on `main` (with `Cargo.toml` version `0.1.0`) creates a GitHub Release containing two tarballs + per-tarball SHA256 + aggregate SHA256SUMS, attached automatically.
2. The macOS tarball, after `xattr -d com.apple.quarantine`, runs the installed binary successfully from a directory other than the build tree (validates paths.rs resolution).
3. The Linux tarball runs the installed binary successfully on a stock Ubuntu/Debian host.
4. `brew tap audiocontrol-org/audiocontrol && brew install midi-macro-bridge` succeeds on macOS Apple Silicon, and `brew services start midi-macro-bridge` launches it.
5. The smoke test in CI does not regress: a default-config startup must not produce `MIDI channel disconnected` within 2 seconds.
