#!/usr/bin/env tsx
/**
 * tools/check-visual-verify.ts
 *
 * commit-msg gate that enforces the `Visual-verify:` marker on commits
 * touching UI source. See VISUAL-VERIFICATION.md (top-level) for the
 * full protocol; this script is the mechanical enforcement.
 *
 * The rule (in plain English):
 *
 *   Any commit whose staged file set includes one or more files matching
 *     modules/<editor>/src/**\/*.{tsx,jsx,css,scss}
 *   MUST carry one of these markers in its commit message:
 *
 *     Visual-verify: <comma-separated-routes>
 *     Visual-verify: skipped-<substantive-reason>
 *
 *   The marker line is a `^[ \t]*Visual-verify:` prefix anywhere in the
 *   message body (not necessarily the first line — fits next to existing
 *   `Closes …`, `Co-Authored-By: …` markers).
 *
 * Marker forms:
 *
 *   Visual-verify: <routes>
 *     - Comma-separated list of route slugs (e.g., "programs-desktop,
 *       keygroups-shell-mobile"). Non-empty.
 *     - The slugs are free-form (commit author picks a stable shorthand
 *       per route — this gate does NOT verify the captured PNG exists,
 *       since not every CI environment can run the dev server + capture
 *       script. The honor-system + operator visual review is the
 *       behavioral check; this gate is the LIST-OF-PAGES claim.)
 *
 *   Visual-verify: skipped-<reason>
 *     - Reason must be substantive: >= 40 chars after trim, NOT a
 *       placeholder phrase (TBD / TODO / deferred / later / etc.).
 *     - Validator mirrors tools/scope-discovery/util/substantive-reason.ts
 *       with minChars=40 (the registry uses 80; commit messages are
 *       shorter context so the threshold is lower).
 *
 * Exit codes:
 *   0 — gate passes (no UI files staged, OR marker present + valid)
 *   1 — gate fails (UI files staged AND marker missing OR invalid)
 *
 * CLI:
 *   tsx tools/check-visual-verify.ts <commit-msg-file>
 *
 * Invoked from .githooks/commit-msg when any UI source is staged.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { checkSubstantiveReason } from './scope-discovery/util/substantive-reason.js';

/**
 * Minimum character count for a `Visual-verify: skipped-<reason>` reason.
 * Lower than the scope-discovery registry's 80 — commit-message context
 * is intrinsically shorter than the long-lived YAML registry entries
 * the registry validator protects.
 */
const VISUAL_VERIFY_MIN_REASON_CHARS = 40;

/** Regex matching the marker line. Anchored to start-of-line (multiline). */
const MARKER_LINE_REGEX = /^[ \t]*Visual-verify:[ \t]*(.+?)[ \t]*$/m;

/**
 * Regex matching UI-source file paths. Fires the gate when any staged
 * file matches; stays narrow (per-editor src trees only) so backend /
 * tooling / test-only commits aren't forced to declare a marker.
 */
const UI_SOURCE_REGEX = /^modules\/[^/]+-editor\/src\/.*\.(tsx|jsx|css|scss)$/;

/** Return the list of staged UI source files, or [] if none. */
function getStagedUiFiles(): string[] {
  const output = execSync(
    'git diff --cached --name-only --diff-filter=ACM',
    { encoding: 'utf8' },
  );
  return output
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && UI_SOURCE_REGEX.test(s));
}

/**
 * Validate the marker's value (the text after `Visual-verify:`).
 * Returns null if valid; otherwise a diagnostic string.
 */
export function validateMarkerValue(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Visual-verify marker present but empty — name routes or use "skipped-<reason>"';
  }
  if (trimmed.startsWith('skipped-')) {
    const reason = trimmed.slice('skipped-'.length);
    if (reason.trim().length === 0) {
      return 'Visual-verify: skipped-<reason> requires a reason after "skipped-"';
    }
    const reasonError = checkSubstantiveReason(reason, {
      minChars: VISUAL_VERIFY_MIN_REASON_CHARS,
    });
    if (reasonError !== null) {
      return `Visual-verify: skipped reason rejected — ${reasonError}`;
    }
    return null;
  }
  // Routes form: comma-separated list. Each route is a non-empty slug.
  const routes = trimmed
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (routes.length === 0) {
    return 'Visual-verify: route list is empty after splitting on commas';
  }
  return null;
}

/**
 * Run the gate. Returns null on success; otherwise a multi-line error
 * message ready to print + exit-1. Exported for unit-testing without
 * the script's process-exit side effects.
 */
export function checkVisualVerify(
  commitMsg: string,
  stagedUiFiles: string[],
): string | null {
  if (stagedUiFiles.length === 0) {
    // No UI files staged — gate doesn't fire.
    return null;
  }
  const match = MARKER_LINE_REGEX.exec(commitMsg);
  if (match === null) {
    return [
      'commit-msg: Visual-verify marker missing.',
      '',
      `  This commit stages ${stagedUiFiles.length} UI source file(s):`,
      ...stagedUiFiles.slice(0, 5).map((f) => `    - ${f}`),
      stagedUiFiles.length > 5
        ? `    ...and ${stagedUiFiles.length - 5} more`
        : '',
      '',
      '  Per VISUAL-VERIFICATION.md, every commit that touches UI source',
      '  must declare which routes were visually verified (or why',
      '  verification was skipped):',
      '',
      '      Visual-verify: <comma-separated-routes>',
      '      Visual-verify: skipped-<substantive-reason>',
      '',
      '  Examples:',
      '      Visual-verify: programs-desktop, programs-mobile',
      '      Visual-verify: keygroups-shell-desktop',
      `      Visual-verify: skipped-<at-least-${VISUAL_VERIFY_MIN_REASON_CHARS}-char-substantive-reason>`,
      '',
      '  Add a marker line to the commit message and re-commit.',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }
  const value = match[1] ?? '';
  const valueError = validateMarkerValue(value);
  if (valueError !== null) {
    return [
      'commit-msg: Visual-verify marker present but invalid.',
      '',
      `  Marker line: Visual-verify: ${value}`,
      `  Reason:      ${valueError}`,
      '',
      '  Per VISUAL-VERIFICATION.md, valid marker forms are:',
      '      Visual-verify: <comma-separated-routes>',
      '      Visual-verify: skipped-<substantive-reason>',
    ].join('\n');
  }
  return null;
}

// --- CLI entry point ---------------------------------------------------

function main(): void {
  const commitMsgFile = process.argv[2];
  if (commitMsgFile === undefined) {
    console.error('Usage: tsx tools/check-visual-verify.ts <commit-msg-file>');
    process.exit(2);
  }
  const commitMsg = readFileSync(commitMsgFile, 'utf8');
  const stagedUiFiles = getStagedUiFiles();
  const error = checkVisualVerify(commitMsg, stagedUiFiles);
  if (error !== null) {
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
}

// Only run main when invoked as a script — not when imported by tests.
const isMain = process.argv[1] !== undefined
  && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
