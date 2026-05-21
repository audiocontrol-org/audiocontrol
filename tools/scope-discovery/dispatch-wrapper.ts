/**
 * tools/scope-discovery/dispatch-wrapper.ts
 *
 * Sub-agent dispatch wrapper for the scope-discovery protocol (T2.4).
 *
 * Why this exists — PRD Resolved Question 5 + agent-discipline.md:
 *   Passive directives ("write a Searched/Included/Excluded block in
 *   your return") get systematically ignored in this repo for the
 *   persistent pathologies (deferral language, single-instance fixes
 *   that skip the same-class audit). The dispatch wrapper replaces the
 *   directive with code: the sub-agent's response is parsed for the
 *   required grammar and structurally rejected when the audit was
 *   skipped or the exclusion reasons contain a deferral phrase from
 *   `.claude/rules/agent-discipline.md`.
 *
 *   Required return grammar (verbatim from prd.md §"Resolved Question 5"):
 *
 *     Searched: <pattern> — <N matches>
 *     Included: <file:line>, <file:line>, ...
 *     Excluded: <file:line> — <one-line reason that is not a deferral>
 *                [, <file:line> — <reason>, ...]
 *
 * Architecture: Claude Code's Agent tool is a runtime primitive only
 * the orchestrating Claude session can invoke. This module cannot
 * directly call the Agent tool from tsx. Callers pass a `dispatchFn`
 * callback — the orchestrator supplies a real dispatcher; the T2.6
 * adversarial validator passes a synthetic dispatcher returning canned
 * responses.
 *
 * The parser + validator + forbidden-phrase list live in the sibling
 * `dispatch-grammar.ts` module so this file stays under the 300-line
 * cap mandated by `~/work/CLAUDE.md`.
 *
 * Library + CLI: importable as a library; also runnable as
 *   `tsx tools/scope-discovery/dispatch-wrapper.ts --self-test`
 * to exercise four fixture cases (one happy path + three failure paths)
 * as a smoke test. Comprehensive adversarial coverage lands in T2.6.
 */

import { fileURLToPath } from 'node:url';
import {
  DispatchRejected,
  parseReturn,
  validateParsed,
  type ParsedDispatchReturn,
} from './dispatch-grammar.js';
import { errorMessage } from './util/typeguards.js';

// Re-export the grammar types so callers import a single module.
export {
  DispatchRejected,
  parseReturn,
  validateParsed,
  FORBIDDEN_DEFERRAL_PHRASES,
  FORBIDDEN_DEFERRAL_REGEXES,
} from './dispatch-grammar.js';
export type {
  ExcludedEntry,
  FileLine,
  MissingBlock,
  ParsedDispatchReturn,
  SearchedBlock,
} from './dispatch-grammar.js';

// ---------------------------------------------------------------------------
// Public dispatch types
// ---------------------------------------------------------------------------

export type DispatchFn = (params: {
  agentType: string;
  prompt: string;
}) => Promise<string>;

export interface WrapOptions {
  readonly dispatchFn: DispatchFn;
}

// ---------------------------------------------------------------------------
// Grammar instruction appended to every dispatched prompt
// ---------------------------------------------------------------------------

/**
 * The text appended to every dispatched prompt. Names the required
 * grammar verbatim and lists the forbidden deferral phrases so the
 * sub-agent has the same list the wrapper uses. Phrases here MUST stay
 * in sync with FORBIDDEN_DEFERRAL_PHRASES in dispatch-grammar.ts.
 */
export const GRAMMAR_INSTRUCTION = `

---

## REQUIRED RETURN GRAMMAR — your response is structurally rejected if absent

Conclude your response with a block in this exact shape:

    Searched: <pattern> — <N matches>
    Included: <file:line>, <file:line>, ...
    Excluded: <file:line> — <one-line reason that is not a deferral>
              [, <file:line> — <reason>, ...]

Field meanings:

  - **Searched:** the grep / search pattern you ran to enumerate every
    instance of the class of thing you're fixing, followed by the total
    match count. Example:
        Searched: ac-list-bank-chevron — 7 matches
  - **Included:** the file:line pairs your proposed fix actually covers.
    Comma-separated. Example:
        Included: src/foo.tsx:42, src/bar.tsx:117, src/baz.tsx:9
  - **Excluded:** the file:line pairs you intentionally did NOT cover,
    each with a one-line reason explaining why (not a deferral — see
    below). Example:
        Excluded: src/legacy.tsx:88 — different primitive (CodeMirror
        editor, not a standard input)

The wrapper rejects your return if:
  1. Any of the three blocks is missing.
  2. Searched reports count > 1, Included covers exactly 1 match, and
     Excluded is empty. (You skipped the same-class audit.)
  3. Any Excluded reason contains a deferral phrase.

**FORBIDDEN deferral phrases in Excluded reasons** (case-insensitive):
"for now", "just for now", "we'll fix", "we'll get", "we'll come back",
"will fix", "will address", "address in", "later", "eventually", "TODO",
"FIXME", "HACK", "XXX", "temporary", "stub", "placeholder", "pending",
"until F<n>", "until v<n>", "until phase <n>", "defer", "deferred",
"next pass", "follow-up", "follow up", "next time".

If you find yourself wanting to write "for now" or "TODO" as an
Excluded reason: STOP. Either include the file:line in your fix, or
write a real reason explaining why the exclusion is permanent (the
match is a different primitive, the match is intentionally scoped
differently, the match is in a deprecated path being deleted, etc.).
`;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function wrap(
  agentType: string,
  taskPrompt: string,
  options: WrapOptions,
): Promise<ParsedDispatchReturn> {
  const augmentedPrompt = taskPrompt + GRAMMAR_INSTRUCTION;
  const responseText = await options.dispatchFn({
    agentType,
    prompt: augmentedPrompt,
  });
  const parsed = parseReturn(responseText);
  validateParsed(parsed);
  return parsed;
}

// ---------------------------------------------------------------------------
// CLI self-test
// ---------------------------------------------------------------------------

interface SelfTestFixture {
  readonly name: string;
  readonly response: string;
  readonly expect: 'pass' | 'reject';
  readonly expectMessageSubstring?: string;
}

const SELF_TEST_FIXTURES: ReadonlyArray<SelfTestFixture> = [
  {
    name: 'happy path: 3 matches, 2 included, 1 excluded with valid reason',
    expect: 'pass',
    response: [
      'Implemented the fix across the two pages that share the primitive.',
      '',
      'Searched: ac-list-bank-chevron — 3 matches',
      'Included: src/pages/Patches.tsx:42, src/pages/Tones.tsx:117',
      'Excluded: src/legacy/OldEditor.tsx:9 — different primitive (CodeMirror editor, not a standard input)',
      '',
    ].join('\n'),
  },
  {
    name: 'missing Searched: block',
    expect: 'reject',
    expectMessageSubstring: 'missing required block(s): Searched',
    response: [
      'Fixed two files.',
      '',
      'Included: src/a.tsx:1, src/b.tsx:2',
      'Excluded: src/c.tsx:3 — different primitive',
    ].join('\n'),
  },
  {
    name: 'multi-match with single Included and empty Excluded (skipped audit)',
    expect: 'reject',
    expectMessageSubstring: 'skipped the same-class audit',
    response: [
      'Fixed the file the operator pointed at.',
      '',
      'Searched: ac-rec-led — 5 matches',
      'Included: src/pages/Connect.tsx:201',
      'Excluded:',
    ].join('\n'),
  },
  {
    name: 'forbidden deferral phrase in Excluded reason',
    expect: 'reject',
    expectMessageSubstring: 'forbidden deferral phrase',
    response: [
      'Implemented the fix on the main page.',
      '',
      'Searched: ac-detail-head — 2 matches',
      'Included: src/pages/Patches.tsx:42',
      'Excluded: src/pages/Tones.tsx:88 — TODO: address in a later pass',
    ].join('\n'),
  },
];

function runOneFixture(fx: SelfTestFixture): boolean {
  try {
    const parsed = parseReturn(fx.response);
    validateParsed(parsed);
    if (fx.expect === 'pass') {
      process.stdout.write(`PASS  ${fx.name}\n`);
      return true;
    }
    process.stdout.write(
      `FAIL  ${fx.name} — expected rejection, got successful parse\n`,
    );
    return false;
  } catch (err) {
    if (!(err instanceof DispatchRejected)) {
      process.stdout.write(
        `FAIL  ${fx.name} — unexpected error type: ${errorMessage(err)}\n`,
      );
      return false;
    }
    if (fx.expect !== 'reject') {
      process.stdout.write(`FAIL  ${fx.name} — expected pass, got: ${err.message}\n`);
      return false;
    }
    const sub = fx.expectMessageSubstring;
    if (sub !== undefined && !err.message.includes(sub)) {
      process.stdout.write(
        `FAIL  ${fx.name} — rejected but message lacks "${sub}". Got: ${err.message}\n`,
      );
      return false;
    }
    process.stdout.write(`PASS  ${fx.name} (rejected: ${err.message.slice(0, 80)}...)\n`);
    return true;
  }
}

function runSelfTest(): number {
  let passes = 0;
  for (const fx of SELF_TEST_FIXTURES) {
    if (runOneFixture(fx)) passes += 1;
  }
  process.stdout.write(
    `\n${passes}/${SELF_TEST_FIXTURES.length} fixtures behaved as expected.\n`,
  );
  return passes === SELF_TEST_FIXTURES.length ? 0 : 1;
}

function isCliEntryPoint(): boolean {
  if (typeof process === 'undefined' || process.argv.length < 2) return false;
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  return invoked === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    try {
      process.exit(runSelfTest());
    } catch (err) {
      process.stderr.write(`self-test crashed: ${errorMessage(err)}\n`);
      process.exit(2);
    }
  } else {
    process.stderr.write(
      'tools/scope-discovery/dispatch-wrapper.ts is a library; run with --self-test for the smoke test.\n',
    );
    process.exit(2);
  }
}
