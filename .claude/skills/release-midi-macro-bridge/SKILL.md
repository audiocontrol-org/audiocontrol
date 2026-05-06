---
name: release-midi-macro-bridge
description: "Use when shipping a new midi-macro-bridge version — bumping Cargo.toml, cutting a v-tag, publishing a GitHub Release, or updating the Homebrew tap."
user_invocable: true
---

# Release midi-macro-bridge

End-to-end runbook for cutting a new `vX.Y.Z` release. The build + tag + GitHub-Release pipeline is local (no CI). Distribution is `.dmg` + macOS arm64 tarball + Linux x86_64 tarball + Homebrew tap update.

> **Per project memory**: never push to `main` via `--force`, never close issues autonomously, no Co-Authored-By trailers in commit messages.

---

## 1. Prerequisites (verify once per machine)

| Item | Check | If missing |
|---|---|---|
| Apple Developer ID Application cert in keychain | `security find-identity -v -p codesigning \| grep "Developer ID Application"` should show `Orion Letizi (ES3R29MZ5A)` | Re-issue at developer.apple.com → Certificates → "+" |
| `notarytool` keychain profile `midi-macro-bridge` | `xcrun notarytool history --keychain-profile midi-macro-bridge \| head` should not error | `xcrun notarytool store-credentials midi-macro-bridge --apple-id ... --team-id ES3R29MZ5A --password ...` (see [`MACOS-SIGNING.md`](../../../services/midi-macro-bridge/MACOS-SIGNING.md)) |
| Docker Desktop running (Linux build) | `docker ps` exits 0 | Open Docker Desktop |
| `gh` authed to `audiocontrol-org` | `gh auth status` | `gh auth login` |
| Homebrew tap cloned at `~/work/audiocontrol-work/homebrew-audiocontrol` | `ls ~/work/audiocontrol-work/homebrew-audiocontrol/Formula/midi-macro-bridge.rb` | `git clone git@github.com:audiocontrol-org/homebrew-audiocontrol ~/work/audiocontrol-work/homebrew-audiocontrol` |

---

## 2. Pre-release sanity (read-only)

From the worktree root:

```bash
# All four should be true:
grep '^version = ' services/midi-macro-bridge/Cargo.toml             # current X.Y.Z
git status --short                                                    # empty (clean tree)
git rev-parse --abbrev-ref HEAD                                       # branch name
git tag --list 'vNEXT' | grep -q . && echo "tag exists, BLOCK" || echo "ok"
```

Decide `vNEXT`. Conventions:

- **Patch** (`vX.Y.Z+1`) — bug-fix-only. CHANGELOG entry should reference the issue numbers fixed and (if any) call out which prior release shipped a defect.
- **Minor** (`vX.Y+1.0`) — new user-visible features (Phase 8 for v0.3.0, Phase 7 for v0.2.0).
- **Major** (`vX+1.0.0`) — breaking changes. Not yet used; would be a deliberate decision.

---

## 3. Bump the version

Edit two files:

**`services/midi-macro-bridge/Cargo.toml`**:
```toml
name = "midi-macro-bridge"
version = "X.Y.Z"   # ← new version, no leading 'v'
```

**`services/midi-macro-bridge/CHANGELOG.md`** — add a new section ABOVE the previous entry:

```markdown
## vX.Y.Z

### Highlights
- ...

### Notes
- ...
```

`release.sh` extracts everything between `## vX.Y.Z` and the next `## ` heading as the GitHub Release body. Missing entry → falls back to a generic title.

Refresh `Cargo.lock` (must be in the same commit; otherwise `make release` will see a dirty tree):

```bash
cargo build --release --target aarch64-apple-darwin --manifest-path services/midi-macro-bridge/Cargo.toml
```

Commit:

```bash
git add services/midi-macro-bridge/Cargo.toml services/midi-macro-bridge/Cargo.lock services/midi-macro-bridge/CHANGELOG.md
git commit -m "chore(midi-macro-bridge): bump to vX.Y.Z + changelog"
```

---

## 4. Cut the release

```bash
make -C services/midi-macro-bridge release VERSION=vX.Y.Z
```

What this does (via `scripts/release.sh`):

1. Preflight: Cargo.toml version match, working tree clean, tag doesn't yet exist locally. Off-main is a warning, not a block.
2. `make package-all` → tarballs + `.dmg`. Linux x86_64 builds inside Docker (`rust:1.91-slim-bookworm`); takes ~1-2 min after image is cached. macOS arm64 builds natively. **`.dmg` notarization round-trip takes 2-5 min**; the script blocks on `xcrun notarytool submit --wait`.
3. macOS smoke test: bridge binary stays up 2.5s without `MIDI channel disconnected`. `.app` codesign verify.
4. `git tag -a vX.Y.Z -m "midi-macro-bridge vX.Y.Z"` + `git push origin vX.Y.Z`.
5. `gh release create` with all 7 artifacts (2 tarballs + 2 tarball SHAs + .dmg + .dmg.sha + SHA256SUMS) and CHANGELOG-extracted release notes.

If any step fails, the tag was probably created but maybe not pushed — see §7 recovery.

---

## 5. Update the Homebrew tap

```bash
./services/midi-macro-bridge/scripts/update-homebrew-formula.sh vX.Y.Z \
    ~/work/audiocontrol-work/homebrew-audiocontrol
```

The script reports `1 match(es)` for both platforms when the substitution succeeds. If it reports `0 match(es)`, **it exits non-zero with a clear error** (per #379) — investigate the formula's structure before retrying.

```bash
cd ~/work/audiocontrol-work/homebrew-audiocontrol
git diff Formula/midi-macro-bridge.rb   # version + 2 sha256 lines should change
git add Formula/midi-macro-bridge.rb
git commit -m "midi-macro-bridge X.Y.Z"
git push origin main
```

After this lands, `brew upgrade midi-macro-bridge` (for tapped users) delivers the new version.

---

## 6. Push feature branch / sync `main`

If you're on a feature branch (working in a worktree where you can't `checkout main`), fast-forward push:

```bash
cd /Users/orion/work/audiocontrol-work/audiocontrol-midi-macro-bridge-packaging
git merge-base --is-ancestor origin/main HEAD && echo "FF: yes" || echo "FF: no — manual merge needed"
git push origin HEAD:main
```

The new tag points at a commit that's now on `main`. The GitHub UI's "this commit doesn't belong to a branch" warning goes away.

---

## 7. Comment on phase / parent issues

For each child issue resolved by this release, comment with the release URL. Don't autonomously close — leave for user acceptance per project memory rule.

```bash
for issue in <list>; do
    gh issue comment $issue --repo audiocontrol-org/audiocontrol \
        --body "Fixed in vX.Y.Z: https://github.com/audiocontrol-org/audiocontrol/releases/tag/vX.Y.Z"
done
```

For phase-parent issues (the umbrella issues), include a short summary of what landed.

---

## 8. Post-release smoke (download path)

The release built locally was already smoke-tested. This step confirms the **uploaded artifact** works end-to-end — catches signing / notarization / asset-completeness issues that wouldn't surface locally.

```bash
mkdir -p /tmp/release-test && cd /tmp/release-test
gh release download vX.Y.Z --repo audiocontrol-org/audiocontrol --pattern '*.dmg'
shasum -a 256 -c MidiMacroBridge-vX.Y.Z.dmg.sha256

# Mount, drag .app to Applications, double-click. .app should:
# - Have the branded "M" icon (NOT the GenericApplicationIcon — see #382)
# - Open a 900x700 window in <2s
# - Show v X.Y.Z in the web UI header (NOT v1.0 — see #378)
# - Have a status bar icon in the macOS menubar
# - Quit cleanly via Cmd-Q or the status bar's "Quit" menu
open MidiMacroBridge-vX.Y.Z.dmg
```

If `brew upgrade midi-macro-bridge` is in scope:

```bash
brew update && brew upgrade midi-macro-bridge && midi-macro-bridge --list-ports
brew test midi-macro-bridge   # the formula's `system bin/"midi-macro-bridge", "--list-ports"` test
```

---

## 9. Failure modes + recovery

| Symptom | Cause | Fix |
|---|---|---|
| `make release` aborts with `Cargo.toml version (X.Y.Z) does not match VERSION` | Forgot the bump | Edit Cargo.toml + Cargo.lock, re-commit, retry |
| `make release` aborts with `working tree has uncommitted changes` | Cargo.lock not staged | `git add services/midi-macro-bridge/Cargo.lock`, re-commit |
| `make release` aborts with `tag vX.Y.Z already exists locally` | Prior failed release left the tag | `git tag -d vX.Y.Z` (local-only delete is safe), retry |
| `notarytool` says `Invalid Credentials` or stalls | Keychain profile expired or app-specific password revoked | Re-run `xcrun notarytool store-credentials midi-macro-bridge ...` (see [`MACOS-SIGNING.md`](../../../services/midi-macro-bridge/MACOS-SIGNING.md)) |
| `notarytool submit --wait` exits non-zero with a submission ID | Apple rejected (rare); use the ID to fetch the log | `xcrun notarytool log <id> --keychain-profile midi-macro-bridge` |
| `.dmg` ships with the wrong icon / Info.plist / entitlements | `package-dmg.sh` reused a stale staged `.app` (pre-v0.3.1 bug, [#382](https://github.com/audiocontrol-org/audiocontrol/issues/382) — fixed since) | If you're seeing this on v0.3.1 or later, re-confirm the fix is in: `grep -q "rebuilding MidiMacroBridge.app" services/midi-macro-bridge/scripts/package-dmg.sh`. Otherwise: `rm -rf services/midi-macro-bridge/target/release-package/MidiMacroBridge.app` and retry |
| Homebrew formula updates `version` but not `sha256` | Pre-#379 regex bug; should be impossible since v0.3.0 | Verify: `grep -q "replace_sha_for_platform" services/midi-macro-bridge/scripts/update-homebrew-formula.sh`. If the script lacks the multi-line regex helper, the fix isn't in — the script fails loud now, but very old checkouts may need manual SHA editing |
| Port 8765 in use during `release.sh` smoke step | Stray prior bridge instance | `pkill -f midi-macro-bridge`, retry. Smoke test will fall back to OS-assigned port if 8765 is taken — that's not a failure, just a log line |
| Tag pushed but `gh release create` failed | Network / auth glitch mid-pipeline | The tag is on origin; the release object is missing. Re-run: `gh release create vX.Y.Z --notes-file ... <artifacts>`. Don't re-run `make release` — preflight will reject the existing tag |
| `--force` push tag rewriting | Don't | Cut a new patch instead. Tags are append-only signals |

---

## 10. Edge cases worth knowing

- **macOS Launch Services caches icons.** If you upgrade an installed `.app` and Finder shows the old icon, `killall Finder` or empty the icon cache (`sudo find /private/var/folders/ -name com.apple.iconservices -exec rm -rf {} + 2>/dev/null; sudo killall Dock`).
- **Linux smoke is NOT verified by `make release`.** The Docker builder produces an x86_64 ELF but doesn't run it (no ALSA in unprivileged container). To smoke-test Linux: real Linux host or privileged Docker with `--device /dev/snd`.
- **`brew install` doesn't ship the `.app`.** The Homebrew formula installs only the binary. Users who want the `.app` UX download the `.dmg` directly. (Bottling the `.app` for brew is tracked at #375 if it ever becomes scoped.)
- **The release pipeline is local — there is no CI.** Anyone with the keychain profile + Developer ID cert + push access can cut a release. The notary creds are scoped to one Apple ID.

---

## Checklist (copy into your terminal as you go)

```
[ ] §1 Prereqs: cert in keychain + notarytool profile + Docker + gh + tap clone
[ ] §2 Pre-release sanity: Cargo.toml version, clean tree, branch, tag not present
[ ] §3 Bump Cargo.toml + Cargo.lock + add CHANGELOG ## vX.Y.Z; commit
[ ] §4 make release VERSION=vX.Y.Z (~5-10 min including notarization)
[ ] §5 update-homebrew-formula.sh + commit + push tap
[ ] §6 git push origin HEAD:main (fast-forward)
[ ] §7 gh issue comment on resolved issues + phase parent(s)
[ ] §8 Post-release smoke: download .dmg, install, verify icon + version + status bar
```

---

## Linked

- Credential setup: [`services/midi-macro-bridge/MACOS-SIGNING.md`](../../../services/midi-macro-bridge/MACOS-SIGNING.md)
- Pipeline source: [`services/midi-macro-bridge/scripts/release.sh`](../../../services/midi-macro-bridge/scripts/release.sh)
- Lessons that reshaped the runbook: [#379](https://github.com/audiocontrol-org/audiocontrol/issues/379) (formula regex), [#382](https://github.com/audiocontrol-org/audiocontrol/issues/382) (stale .app)
