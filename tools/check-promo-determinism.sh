#!/usr/bin/env bash
#
# check-promo-determinism.sh
#
# Determinism check for the promo capture engine (editor-ux-refinement P2.3).
# Runs `make promo-shots` twice and asserts every produced PNG is
# byte-identical across the two runs.
#
# Captures are deterministic by construction: pinned per-scene viewport +
# deviceScaleFactor, real-device-captured fixtures, `document.fonts.ready`,
# and CSS animations/transitions frozen via Playwright's
# `animations: 'disabled'` (without which the rec-LED glow / VFD pulse / live
# chrome capture mid-frame and diverge run-to-run). This guards against
# regressions in that guarantee.
#
# Heavy (two full browser-capture runs); operator/CI-invoked, NOT a
# pre-commit gate. Exits non-zero on any divergence.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WORK="$(mktemp -d -t promo-determinism.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

echo "[promo-determinism] run 1..."
make promo-shots >/dev/null 2>&1 || { echo "[promo-determinism] run 1 failed" >&2; exit 1; }
shasum -a 256 out/promo/*.png | awk '{print $1"  "$2}' | sort -k2 > "$WORK/r1.txt"

echo "[promo-determinism] run 2..."
make promo-shots >/dev/null 2>&1 || { echo "[promo-determinism] run 2 failed" >&2; exit 1; }
shasum -a 256 out/promo/*.png | awk '{print $1"  "$2}' | sort -k2 > "$WORK/r2.txt"

if diff "$WORK/r1.txt" "$WORK/r2.txt" >/dev/null; then
  echo "[promo-determinism] OK -- all PNGs byte-identical across two runs"
  cat "$WORK/r2.txt"
  exit 0
fi

echo "[promo-determinism] FAIL -- captures diverged across runs:" >&2
diff "$WORK/r1.txt" "$WORK/r2.txt" >&2
exit 1
