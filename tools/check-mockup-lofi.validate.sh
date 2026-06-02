#!/usr/bin/env bash
#
# check-mockup-lofi.validate.sh
#
# Adversarial self-check for check-mockup-lofi.sh (validator-paired per
# .claude/rules/agent-discipline.md). Builds temp fixtures and asserts the
# gate PASSES a clean wireframe and REJECTS one that links design-system
# CSS, @imports CSS, or links a remote resource. Exits non-zero on any
# failed assertion.
#
# Teeth: if the gate were gutted to always exit 0, assertions 2-4 would
# fail -- they prove the import-ban actually rejects an impersonator, not
# just that the happy path passes.

set -uo pipefail

GATE="./tools/check-mockup-lofi.sh"
TMP="$(mktemp -d -t mockup-lofi-validate.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }

mk_root() {
  local root="$1"
  mkdir -p "$root/feature/explorations"
}

# 1) A clean wireframe (links only sketch-kit.css) must PASS.
mk_root "$TMP/clean"
cat > "$TMP/clean/feature/explorations/mockup.html" <<'HTML'
<!doctype html>
<html><head>
  <link rel="stylesheet" href="../../../../wireframe-kit/sketch-kit.css" />
</head><body class="sk-page"><div class="sk-box">a sketch</div></body></html>
HTML

# 2) A wireframe linking a design-system stylesheet must FAIL.
mk_root "$TMP/dirty-link"
cat > "$TMP/dirty-link/feature/explorations/mockup.html" <<'HTML'
<!doctype html>
<html><head>
  <link rel="stylesheet" href="../../../../wireframe-kit/sketch-kit.css" />
  <link rel="stylesheet" href="/modules/editor-core/src/design/tokens.css" />
</head><body>impersonator</body></html>
HTML

# 3) A wireframe using @import must FAIL.
mk_root "$TMP/dirty-import"
cat > "$TMP/dirty-import/feature/explorations/mockup.html" <<'HTML'
<!doctype html>
<html><head><style>@import url('/design-system.css');</style></head>
<body>impersonator</body></html>
HTML

# 4) A wireframe linking a remote CDN resource must FAIL.
mk_root "$TMP/dirty-remote"
cat > "$TMP/dirty-remote/feature/explorations/mockup.html" <<'HTML'
<!doctype html>
<html><head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
</head><body>impersonator</body></html>
HTML

if ! "$GATE" "$TMP/clean" >/dev/null 2>&1; then
  fail "clean wireframe (sketch-kit.css only) should PASS the gate"
fi
echo "OK: clean wireframe passes"

if "$GATE" "$TMP/dirty-link" >/dev/null 2>&1; then
  fail "wireframe linking design-system CSS must be REJECTED"
fi
echo "OK: design-system-link wireframe rejected"

if "$GATE" "$TMP/dirty-import" >/dev/null 2>&1; then
  fail "wireframe using @import must be REJECTED"
fi
echo "OK: @import wireframe rejected"

if "$GATE" "$TMP/dirty-remote" >/dev/null 2>&1; then
  fail "wireframe linking a remote CDN resource must be REJECTED"
fi
echo "OK: remote-resource wireframe rejected"

echo "mockup-lofi gate self-check passed"
