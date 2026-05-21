#!/usr/bin/env bash
#
# check-chevron-sizing.sh
#
# Fails the build if any CSS file contains a class name with the
# substring "chevron" outside the single canonical primitive file
# (`modules/editor-core/src/design/chevron-primitives.css`).
#
# Background — why this gate is shaped this way:
#
# The project has a hard accessibility rule that every disclosure
# chevron must be 1.1rem square in the accent color. The prior
# architecture had four hand-coded chevron CSS classes
# (`.ac-list-bank-chevron`, `.ac-tree-chevron`, `.ac-tree-chevron-btn`,
# `.ac-device-memory-section-eyebrow-chevron`) that "agreed by
# convention." One drifted to 1rem in May 2026 without anyone
# noticing.
#
# A prior version of this gate allow-listed those four classes by
# name and only failed when a NEW chevron class showed up. That was
# the wrong shape: an allow-listed class can drift on a later edit
# (e.g., `.ac-device-memory-section-eyebrow-chevron` going from
# 1.1rem to 1rem) without tripping the gate, because the gate
# never checked the values inside an allow-listed class.
#
# The corrected shape is: there is ONE chevron — the AcChevron
# React component, backed by ONE CSS class (`.ac-chevron`) declared
# in ONE file (chevron-primitives.css). Every disclosure surface
# renders <AcChevron expanded={...} />. The gate enforces this
# structurally by forbidding the substring "chevron" inside any CSS
# class definition outside the canonical file — agents physically
# cannot author a divergent chevron class without removing this gate
# or editing the canonical file.
#
# What this gate does NOT check:
# - Plain English comments mentioning "chevron" in any file are fine.
# - JSX/TSX is unconstrained; chevron-related component code is
#   expected to live in editor-core/src/components/AcChevron.tsx.
# - Rust, Go, Python, Markdown, etc. are not scanned.

set -uo pipefail

# The single canonical chevron CSS file. Nothing else may declare a
# chevron-named class. Treat any change to this list as a design-
# system change that needs explicit operator approval.
CANONICAL_CHEVRON_CSS="modules/editor-core/src/design/chevron-primitives.css"

# Walk every CSS file under modules/. For each file other than the
# canonical one, scan for selectors that contain a class name with
# the substring "chevron". Selector recognition: a `.` followed by
# class-name chars containing "chevron", followed eventually by `{`
# or `,` (selector terminators). This catches both `.foo-chevron {`
# and `.foo-chevron, .bar { ... }` shapes.
violations=()

while IFS= read -r file; do
  # Skip the canonical file — it is the one and only place a chevron
  # class declaration is allowed.
  if [[ "$file" == "$CANONICAL_CHEVRON_CSS" ]]; then
    continue
  fi
  # grep for selector-shaped chevron lines. The pattern matches a
  # dot-prefixed identifier containing "chevron" followed by `{` or
  # `,`, which covers both single-selector and grouped-selector
  # declarations. Skip @-rule and comment lines.
  while IFS= read -r line; do
    line_no="${line%%:*}"
    line_text="${line#*:}"
    # Skip comment-only lines (start with `*` after indent, or `/*`,
    # or `//`). The selector recognizer would otherwise misread
    # `* .ac-foo-chevron is …` as a declaration.
    case "${line_text##[[:space:]]}" in
      \**|/\**|//*) continue ;;
    esac
    violations+=("$file:$line_no  $line_text")
  done < <(grep -nE '\.[A-Za-z0-9_-]*chevron[A-Za-z0-9_-]*[[:space:]]*[,{]' "$file" 2>/dev/null || true)
done < <(
  find modules \
    \( -path '*/dist/*' -o -path '*/node_modules/*' -o -path '*/.tmp/*' -o -path '*/test-results/*' \) -prune \
    -o -name '*.css' -type f -print 2>/dev/null | sort
)

if [[ ${#violations[@]} -eq 0 ]]; then
  echo "[chevron-check] OK — only the canonical chevron declaration exists"
  exit 0
fi

cat <<EOF >&2

[chevron-check] FAIL — chevron-named CSS class declared outside the
canonical primitive file.

There is exactly one chevron allowed in the design system:
  CSS:       $CANONICAL_CHEVRON_CSS
  Component: modules/editor-core/src/components/AcChevron.tsx
  Render:    <AcChevron expanded={isExpanded} />

Do NOT author a new chevron-named CSS class. Wrap your disclosure
toggle around the AcChevron component instead. If the wrapping
button needs a class (e.g., to add cursor / padding / hit-area
chrome), name it after its role — disclosure-toggle, list-bank-
toggle, section-eyebrow — never after its child glyph.

See .claude/rules/chevron-sizing.md for the full rule + the incident
that forced the rule into a structural gate.

Offending declarations:

EOF
for v in "${violations[@]}"; do
  echo "  $v" >&2
done
echo >&2
exit 1
