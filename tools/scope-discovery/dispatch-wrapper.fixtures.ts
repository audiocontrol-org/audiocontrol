/**
 * tools/scope-discovery/dispatch-wrapper.fixtures.ts
 *
 * Canned sub-agent response fixtures + scenario tables for the
 * dispatch-wrapper adversarial harness (T2.6). Extracted from
 * dispatch-wrapper.validate.ts so the harness file stays under the
 * 300-500 line cap mandated by `~/work/CLAUDE.md`.
 *
 * Two scenario arrays are exported:
 *   - ACCEPTANCE_SCENARIOS — wrap() must return a ParsedDispatchReturn
 *   - REJECTION_SCENARIOS  — wrap() must throw DispatchRejected
 *
 * The harness composes them and runs the gutted-self-check against
 * REJECTION_SCENARIOS specifically.
 */

import {
  FORBIDDEN_DEFERRAL_PHRASES,
  FORBIDDEN_DEFERRAL_REGEXES,
  type MissingBlock,
  type ParsedDispatchReturn,
} from './dispatch-grammar.js';

// ---------------------------------------------------------------------------
// Public scenario shape (consumed by dispatch-wrapper.validate.ts)
// ---------------------------------------------------------------------------

export interface AcceptExpectation {
  readonly kind: 'accept';
  /** Optional asserts against the parsed return. */
  readonly check?: (parsed: ParsedDispatchReturn) => string | null;
}

export interface RejectExpectation {
  readonly kind: 'reject';
  /** Substring expected in DispatchRejected.message. */
  readonly messageSubstring?: string;
  /** Expected missingBlocks set; checked as a set equality. */
  readonly missingBlocks?: ReadonlyArray<MissingBlock>;
}

export type Expectation = AcceptExpectation | RejectExpectation;

export interface Scenario {
  readonly name: string;
  readonly response: string;
  readonly expect: Expectation;
}

// ---------------------------------------------------------------------------
// Canned response builders — keep grammar shapes DRY across scenarios.
// ---------------------------------------------------------------------------

function lines(...rows: ReadonlyArray<string>): string {
  return rows.join('\n');
}

const HAPPY_PRELUDE = 'Implemented the fix across the affected files.';

interface ResponseParts {
  readonly prelude?: string;
  readonly searched: string;
  readonly included: ReadonlyArray<string>;
  readonly excluded: ReadonlyArray<string>;
}

function buildResponse(parts: ResponseParts): string {
  const body: string[] = [];
  if (parts.prelude !== undefined) {
    body.push(parts.prelude, '');
  }
  body.push(`Searched: ${parts.searched}`);
  body.push(`Included: ${parts.included.join(', ')}`);
  body.push(`Excluded: ${parts.excluded.join(', ')}`);
  return lines(...body, '');
}

// ---------------------------------------------------------------------------
// Acceptance scenarios — wrap() must return a ParsedDispatchReturn.
// ---------------------------------------------------------------------------

export const ACCEPTANCE_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: 'accept: happy path (3 matches, 2 included, 1 excluded with valid reason)',
    response: buildResponse({
      prelude: HAPPY_PRELUDE,
      searched: 'ac-list-bank-chevron — 3 matches',
      included: ['src/pages/Patches.tsx:42', 'src/pages/Tones.tsx:117'],
      excluded: ['src/legacy/Old.tsx:9 — different primitive (CodeMirror editor)'],
    }),
    expect: { kind: 'accept' },
  },
  {
    name: 'accept: multi-line Included block (T2.4 Fix 3)',
    response: lines(
      'Fixed three files; one excluded.',
      '',
      'Searched: ac-list-bank-chevron — 4 matches',
      'Included: src/a.tsx:1,',
      '          src/b.tsx:2,',
      '          src/c.tsx:3',
      'Excluded: src/legacy/d.tsx:4 — different primitive (CodeMirror editor, not a standard input)',
      '',
    ),
    expect: {
      kind: 'accept',
      check: (parsed) => (parsed.included.length === 3
        ? null
        : `expected 3 Included entries, got ${parsed.included.length}`),
    },
  },
  {
    name: 'accept: prelude-quoted grammar then real block (last-occurrence parser)',
    response: lines(
      'The wrapper asks for this grammar:',
      '',
      '    Searched: <pattern> — <N matches>',
      '    Included: <file:line>, <file:line>, ...',
      '    Excluded: <file:line> — <reason>',
      '',
      'Here is the real block:',
      '',
      'Searched: ac-rec-led — 2 matches',
      'Included: src/pages/Connect.tsx:201, src/pages/Play.tsx:88',
      'Excluded: src/legacy/Old.tsx:42 — different primitive (raw SVG, no .ac-rec-led class)',
      '',
    ),
    expect: {
      kind: 'accept',
      check: (parsed) => {
        if (parsed.searched.pattern !== 'ac-rec-led') {
          return `expected pattern "ac-rec-led", got "${parsed.searched.pattern}" (parser picked prelude not real block)`;
        }
        if (parsed.searched.count !== 2) {
          return `expected count 2, got ${parsed.searched.count}`;
        }
        return null;
      },
    },
  },
  {
    name: 'accept: legitimate "later" usage in Excluded reason (T2.4 Fix 4)',
    response: buildResponse({
      searched: 'header-rule — 3 matches',
      included: ['src/pages/A.tsx:10', 'src/pages/B.tsx:20'],
      excluded: ['src/pages/Legacy.tsx:30 — uses a later-revision protocol header'],
    }),
    expect: { kind: 'accept' },
  },
  {
    name: 'accept: legitimate "follow up" usage in Excluded reason',
    response: buildResponse({
      searched: 'notify-user — 2 matches',
      included: ['src/pages/A.tsx:10'],
      excluded: ['src/pages/B.tsx:20 — we follow up with the user via email, not in the UI'],
    }),
    expect: { kind: 'accept' },
  },
  {
    name: 'accept: "until file end" passes (T2.4 Fix 1 narrowed regex)',
    response: buildResponse({
      searched: 'data-reader — 2 matches',
      included: ['src/parser/A.ts:10'],
      excluded: ['src/parser/B.ts:20 — reads data until file end as a side effect'],
    }),
    expect: { kind: 'accept' },
  },
  {
    name: 'accept: no-clone-grouping case (single match, no Excluded body)',
    response: lines(
      'Single match found, fixed in place.',
      '',
      'Searched: ac-rare-class — 1 matches',
      'Included: src/pages/Only.tsx:5',
      'Excluded:',
      '',
    ),
    expect: { kind: 'accept' },
  },
];

// ---------------------------------------------------------------------------
// Rejection scenarios — wrap() must throw DispatchRejected.
//
// Hand-rolled grammar-failure / audit-skip scenarios are listed first; the
// forbidden-phrase + forbidden-regex scenarios are generated from the
// FORBIDDEN_DEFERRAL_PHRASES + FORBIDDEN_DEFERRAL_REGEXES arrays in
// dispatch-grammar.ts so every entry in the source-of-truth list has a
// rejection-asserting fixture. Removing a phrase from the array
// automatically removes its fixture from the harness — the count drift
// surfaces in CI as a missing scenario.
// ---------------------------------------------------------------------------

const HAND_ROLLED_REJECTION_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: 'reject: missing Searched: block',
    response: lines(
      'Fixed two files.',
      '',
      'Included: src/a.tsx:1, src/b.tsx:2',
      'Excluded: src/c.tsx:3 — different primitive',
    ),
    expect: {
      kind: 'reject',
      messageSubstring: 'missing required block(s): Searched',
      missingBlocks: ['Searched'],
    },
  },
  {
    name: 'reject: missing Included: block',
    response: lines(
      'Fixed two files.',
      '',
      'Searched: ac-foo — 2 matches',
      'Excluded: src/c.tsx:3 — different primitive',
    ),
    expect: {
      kind: 'reject',
      messageSubstring: 'missing required block(s): Included',
      missingBlocks: ['Included'],
    },
  },
  {
    name: 'reject: missing Excluded: block entirely',
    response: lines(
      'Fixed everything.',
      '',
      'Searched: ac-foo — 1 matches',
      'Included: src/a.tsx:1',
    ),
    expect: {
      kind: 'reject',
      messageSubstring: 'missing required block(s): Excluded',
      missingBlocks: ['Excluded'],
    },
  },
  {
    name: 'reject: skipped-audit (Searched count > 1, Included = 1, Excluded empty)',
    response: lines(
      'Fixed the file the operator pointed at.',
      '',
      'Searched: ac-rec-led — 5 matches',
      'Included: src/pages/Connect.tsx:201',
      'Excluded:',
    ),
    expect: {
      kind: 'reject',
      messageSubstring: 'skipped the same-class audit',
    },
  },
  {
    name: 'reject: malformed file:line in Included (non-numeric line)',
    response: buildResponse({
      searched: 'ac-detail-head — 2 matches',
      included: ['src/foo.tsx:abc', 'src/bar.tsx:117'],
      excluded: ['src/legacy.tsx:9 — different primitive'],
    }),
    expect: {
      kind: 'reject',
      messageSubstring: 'Malformed file:line',
    },
  },
  {
    name: 'reject: malformed file:line in Included (missing line)',
    response: buildResponse({
      searched: 'ac-detail-head — 2 matches',
      included: ['src/foo.tsx', 'src/bar.tsx:117'],
      excluded: ['src/legacy.tsx:9 — different primitive'],
    }),
    expect: {
      kind: 'reject',
      messageSubstring: 'Malformed file:line',
    },
  },
  {
    name: 'reject: empty Included: block (label present but no entries)',
    response: lines(
      'Nothing to include, somehow.',
      '',
      'Searched: ac-detail-head — 2 matches',
      'Included:',
      'Excluded: src/foo.tsx:1 — different primitive',
    ),
    expect: {
      kind: 'reject',
      messageSubstring: 'Included: block is empty',
    },
  },
];

/**
 * Build a rejection scenario for an Excluded reason that should trip the
 * forbidden-deferral check. Two Included entries + one Excluded entry
 * sidesteps the skipped-audit rule (which requires `included.length === 1`
 * AND `excluded.length === 0`), so the rejection is unambiguously
 * attributable to the planted phrase or regex match.
 */
function forbiddenPhraseRejectionScenario(
  scenarioName: string,
  reason: string,
): Scenario {
  return {
    name: scenarioName,
    response: buildResponse({
      searched: 'ac-foo — 3 matches',
      included: ['src/a.tsx:1', 'src/b.tsx:2'],
      excluded: [`src/legacy.tsx:99 — different primitive (${reason})`],
    }),
    expect: { kind: 'reject', messageSubstring: 'forbidden deferral phrase' },
  };
}

const PHRASE_REJECTION_FIXTURES: ReadonlyArray<Scenario> =
  FORBIDDEN_DEFERRAL_PHRASES.map((phrase): Scenario =>
    forbiddenPhraseRejectionScenario(
      `reject: forbidden phrase "${phrase}" in Excluded reason`,
      `${phrase} as a marker`,
    ),
  );

/**
 * Sample reasons crafted so each one is matched ONLY by its intended
 * FORBIDDEN_DEFERRAL_REGEXES entry — proven by inspecting every other
 * regex + every plain phrase against the sample. Adding or reordering
 * regexes requires updating this table; the assertion at module load
 * below catches that drift.
 *
 * Source: `dispatch-grammar.ts` — keep indices aligned with that array.
 */
const REGEX_SAMPLE_REASONS: ReadonlyArray<string> = [
  'valid until F1',        // /\buntil\s+F\d/i
  'used until v0.4',       // /\buntil\s+v\d/i
  'until phase 3',         // /\buntil\s+phase\s+\d/i
  'fix it later',          // /\b(fix|address|...)\s+(it\s+)?later\b/i
  'in a later pass',       // /\blater\s+(pass|version|...)\b/i
  'filed as a follow-up',  // /\b(as|in)\s+(a\s+)?follow[-\s]up\b/i
  'follow-up issue',       // /\bfollow[-\s]up\s+(issue|...)\b/i
];

if (REGEX_SAMPLE_REASONS.length !== FORBIDDEN_DEFERRAL_REGEXES.length) {
  // Module-load assertion: every regex in the source-of-truth array MUST
  // have a sample reason. A drift here surfaces immediately on `tsx`
  // import rather than as a silent missing fixture.
  throw new Error(
    `REGEX_SAMPLE_REASONS length (${REGEX_SAMPLE_REASONS.length}) does not match ` +
      `FORBIDDEN_DEFERRAL_REGEXES length (${FORBIDDEN_DEFERRAL_REGEXES.length}). ` +
      `Update dispatch-wrapper.fixtures.ts when adding/removing regexes in dispatch-grammar.ts.`,
  );
}

const REGEX_REJECTION_FIXTURES: ReadonlyArray<Scenario> =
  FORBIDDEN_DEFERRAL_REGEXES.map((re, idx): Scenario => {
    const reason = REGEX_SAMPLE_REASONS[idx];
    return forbiddenPhraseRejectionScenario(
      `reject: forbidden regex /${re.source}/${re.flags} — sample "${reason}"`,
      reason,
    );
  });

export const REJECTION_SCENARIOS: ReadonlyArray<Scenario> = [
  ...HAND_ROLLED_REJECTION_SCENARIOS,
  ...PHRASE_REJECTION_FIXTURES,
  ...REGEX_REJECTION_FIXTURES,
];
