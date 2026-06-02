#!/usr/bin/env bash
#
# check-mockup-lofi.sh
#
# Enforces the "inverted teeth" of the lo-fi sketch mockup convention
# (editor-ux-refinement Phase 4): an exploration mockup must be a
# deliberately hand-drawn wireframe that CANNOT impersonate the product.
#
# Structural rule: every HTML file under <root>/**/explorations/**/*.html
# (except the dated grandfather allowlist of pre-convention hi-fi mockups)
# may link EXACTLY ONE stylesheet -- the sketch kit, basename
# `sketch-kit.css` -- and may NOT @import any CSS or link any remote
# resource. A wireframe that cannot import the design system's CSS cannot
# meaningfully use its --ac-* tokens or .ac-* classes, so it stays
# structurally lo-fi.
#
# Why structural, not substring: an earlier idea was to grep for `--ac-` /
# `.ac-` substrings, but those appear in explanatory comments ("no .ac-*
# classes allowed") and would false-positive. Banning the IMPORT PATHS --
# the only way design-system CSS actually reaches the page -- is both
# low-false-positive and the real invariant.
#
# Usage:
#   ./tools/check-mockup-lofi.sh [scan-root]   # default scan-root: docs
#
# See docs/wireframe-kit/README.md for the convention.

set -uo pipefail

SCAN_ROOT="${1:-docs}"
SKETCH_KIT_BASENAME="sketch-kit.css"
GRANDFATHER_LIST="tools/mockup-lofi-grandfather.txt"

# Load the grandfather allowlist (pre-convention hi-fi mockups that predate
# the gate; converting them is pure cost). Paths are repo-root-relative,
# one per line; blank lines and `#` comments are ignored.
declare -a GRANDFATHER=()
if [[ -f "$GRANDFATHER_LIST" ]]; then
  while IFS= read -r gline; do
    case "${gline##[[:space:]]}" in
      ''|\#*) continue ;;
    esac
    GRANDFATHER+=("$gline")
  done < "$GRANDFATHER_LIST"
fi

is_grandfathered() {
  local f="$1"
  local g
  for g in ${GRANDFATHER[@]+"${GRANDFATHER[@]}"}; do
    [[ "$f" == "$g" ]] && return 0
  done
  return 1
}

violations=()

while IFS= read -r file; do
  if is_grandfathered "$file"; then
    continue
  fi

  # Rule A: every stylesheet <link> must point at sketch-kit.css (basename).
  while IFS= read -r line; do
    line_no="${line%%:*}"
    line_text="${line#*:}"
    raw="$(grep -oE 'href="[^"]*"' <<< "$line_text" | head -1)"
    href="${raw#href=\"}"
    href="${href%\"}"
    base="${href##*/}"
    if [[ "$base" != "$SKETCH_KIT_BASENAME" ]]; then
      violations+=("$file:$line_no  stylesheet link is not $SKETCH_KIT_BASENAME -> $line_text")
    fi
  done < <(grep -nE '<link[^>]*rel="stylesheet' "$file" 2>/dev/null || true)

  # Rule B: no @import (the other CSS-pull mechanism).
  while IFS= read -r line; do
    line_no="${line%%:*}"
    line_text="${line#*:}"
    violations+=("$file:$line_no  @import is forbidden in a wireframe -> $line_text")
  done < <(grep -nE '@import[[:space:](]' "$file" 2>/dev/null || true)

  # Rule C: no remote resources in <link> tags (CDN fonts / stylesheets).
  while IFS= read -r line; do
    line_no="${line%%:*}"
    line_text="${line#*:}"
    violations+=("$file:$line_no  remote resource in <link> is forbidden -> $line_text")
  done < <(grep -nE '<link[^>]*https?://' "$file" 2>/dev/null || true)
done < <(
  find "$SCAN_ROOT" \
    \( -path '*/node_modules/*' -o -path '*/dist/*' -o -path '*/.tmp/*' \) -prune \
    -o -path '*/explorations/*' -name '*.html' -type f -print 2>/dev/null | sort
)

if [[ ${#violations[@]} -eq 0 ]]; then
  echo "[mockup-lofi] OK -- exploration mockups import only $SKETCH_KIT_BASENAME"
  exit 0
fi

cat >&2 <<EOF

[mockup-lofi] FAIL -- an exploration mockup pulls in CSS other than the
sketch kit.

Exploration mockups must be deliberately hand-drawn wireframes. They may
link ONLY docs/wireframe-kit/sketch-kit.css and must not @import CSS or
link any remote resource -- this keeps a wireframe structurally incapable
of impersonating the real product.

If you need to show real visual fidelity, that belongs in real components
reviewed via the device-free screenshot engine, NOT in a mockup. See
docs/wireframe-kit/README.md.

If this file is a pre-convention hi-fi mockup that should be grandfathered,
add its path to $GRANDFATHER_LIST.

Offending references:

EOF
for v in "${violations[@]}"; do
  echo "  $v" >&2
done
echo >&2
exit 1
