/**
 * tools/scope-discovery/dispatch-wrapper.ts
 *
 * Sub-agent dispatch wrapper for the scope-discovery protocol (T2.4).
 * Implements PRD Resolved Question 5 + agent-discipline.md: passive
 * directives ("write a Searched/Included/Excluded block in your return")
 * get systematically ignored, so the wrapper replaces the directive with
 * code. The sub-agent's response is parsed for the required grammar and
 * structurally rejected when the audit was skipped or the exclusion
 * reasons contain a deferral phrase from
 * `.claude/rules/agent-discipline.md`.
 *
 * Required return grammar (verbatim from prd.md §"Resolved Question 5"):
 *
 *     Searched: <pattern> — <N matches>
 *     Included: <file:line>, <file:line>, ...
 *     Excluded: <file:line> — <one-line reason that is not a deferral>
 *                [, <file:line> — <reason>, ...]
 *
 * Architecture: Claude Code's Agent tool is a runtime primitive only the
 * orchestrating Claude session can invoke. Callers pass a `dispatchFn`
 * callback — the orchestrator supplies a real dispatcher; T2.6's
 * adversarial harness passes synthetic responses.
 *
 * Parser + validator + forbidden-phrase list live in
 * `dispatch-grammar.ts` so this file stays under the 300-line cap.
 *
 * Library + CLI: importable as a library; runnable as
 *   `tsx tools/scope-discovery/dispatch-wrapper.ts --self-test`
 * for smoke-test fixtures (T2.6 adds adversarial coverage).
 */

import { fileURLToPath } from 'node:url';
import {
  DispatchRejected,
  FORBIDDEN_DEFERRAL_PHRASES,
  FORBIDDEN_DEFERRAL_REGEXES,
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

/** Render a regex source as a human-readable shape for the prompt. */
function regexToPromptShape(re: RegExp): string {
  return re.source.replace(/\\b/g, '').replace(/\\s\+/g, ' ')
    .replace(/\\s/g, ' ').replace(/\\d/g, '<digit>').replace(/\\w/g, '<word>');
}

const FORBIDDEN_PHRASES_FOR_PROMPT = FORBIDDEN_DEFERRAL_PHRASES
  .map((p) => `"${p}"`).join(', ');
const FORBIDDEN_REGEXES_FOR_PROMPT = FORBIDDEN_DEFERRAL_REGEXES
  .map((re) => `/${regexToPromptShape(re)}/`).join(', ');

/**
 * Text appended to every dispatched prompt. Phrase + regex lists are
 * interpolated from FORBIDDEN_DEFERRAL_PHRASES + _REGEXES at module load
 * so editing those arrays automatically updates what the sub-agent sees.
 */
export const GRAMMAR_INSTRUCTION = `

---

## REQUIRED RETURN GRAMMAR — your response is structurally rejected if absent

Conclude your response with a block in this exact shape:

    Searched: <pattern> — <N matches>
    Included: <file:line>, <file:line>, ...
    Excluded: <file:line> — <one-line reason that is not a deferral>
              [, <file:line> — <reason>, ...]

  - **Searched:** the grep/search pattern that enumerates every instance
    of the class of thing you're fixing + total match count.
    Example: \`Searched: ac-list-bank-chevron — 7 matches\`
  - **Included:** file:line pairs your fix covers (comma-separated).
    Example: \`Included: src/foo.tsx:42, src/bar.tsx:117\`
  - **Excluded:** file:line pairs you intentionally did NOT cover, each
    with a one-line non-deferral reason.
    Example: \`Excluded: src/legacy.tsx:88 — different primitive (CodeMirror)\`

The wrapper rejects your return if:
  1. Any block is missing.
  2. Searched count > 1, Included covers exactly 1 match, Excluded empty
     (skipped same-class audit).
  3. Any Excluded reason contains a deferral phrase.

**FORBIDDEN deferral substrings in Excluded reasons** (case-insensitive):
${FORBIDDEN_PHRASES_FOR_PROMPT}.

**FORBIDDEN deferral regex shapes** (case-insensitive):
${FORBIDDEN_REGEXES_FOR_PROMPT}.

"later" / "follow up" / "follow-up" as a deferral noun ("fix later",
"as a follow-up") are rejected; descriptive use ("later v2 of the API",
"a later-revision header") passes.

If you want to write "for now" or "TODO": STOP. Either include the
file:line in your fix, or write a permanent-exclusion reason (different
primitive, deprecated path being deleted, scoped differently, etc.).
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
  {
    name: 'multi-line Included block parses across continuation lines',
    expect: 'pass',
    response: [
      'Fixed three files; one excluded.',
      '',
      'Searched: ac-list-bank-chevron — 4 matches',
      'Included: src/a.tsx:1,',
      '          src/b.tsx:2,',
      '          src/c.tsx:3',
      'Excluded: src/legacy/d.tsx:4 — different primitive (CodeMirror editor, not a standard input)',
      '',
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
