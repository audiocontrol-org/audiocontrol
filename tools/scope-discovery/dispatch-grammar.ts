/**
 * tools/scope-discovery/dispatch-grammar.ts
 *
 * Parser + validator + forbidden-phrase list for the sub-agent
 * dispatch grammar defined in PRD Resolved Question 5. Extracted from
 * dispatch-wrapper.ts so the wrapper module stays under the 300-line
 * cap mandated by `~/work/CLAUDE.md`.
 *
 * Required return grammar (verbatim from prd.md §"Resolved Question 5"):
 *
 *     Searched: <pattern> — <N matches>
 *     Included: <file:line>, <file:line>, ...
 *     Excluded: <file:line> — <one-line reason that is not a deferral>
 *                [, <file:line> — <reason>, ...]
 *
 * The DispatchRejected error type, the public parser entry point
 * (parseReturn), and the validator (validateParsed) all live here. The
 * wrapper module composes them.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SearchedBlock {
  readonly pattern: string;
  readonly count: number;
}

export interface FileLine {
  readonly file: string;
  readonly line: number;
}

export interface ExcludedEntry extends FileLine {
  readonly reason: string;
}

export interface ParsedDispatchReturn {
  readonly searched: SearchedBlock;
  readonly included: ReadonlyArray<FileLine>;
  readonly excluded: ReadonlyArray<ExcludedEntry>;
  readonly rawText: string;
}

export type MissingBlock = 'Searched' | 'Included' | 'Excluded';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown when the sub-agent's return does not satisfy the grammar +
 * validation rules. Inheriting from `Error` is the standard Node error
 * pattern — this is the documented exception to the project's
 * "composition over inheritance" rule (see CLAUDE.md §TypeScript).
 */
export class DispatchRejected extends Error {
  public readonly missingBlocks: ReadonlyArray<MissingBlock>;
  public readonly rawText: string;

  constructor(
    reason: string,
    missingBlocks: ReadonlyArray<MissingBlock>,
    rawText: string,
  ) {
    super(reason);
    this.name = 'DispatchRejected';
    this.missingBlocks = missingBlocks;
    this.rawText = rawText;
  }
}

// ---------------------------------------------------------------------------
// Forbidden deferral-phrase list
// ---------------------------------------------------------------------------

/**
 * Source: `.claude/rules/agent-discipline.md` §"Just for now is bullshit".
 * Substring match is case-insensitive.
 *
 * Entries that include a placeholder like `<n>` are expressed as regex
 * patterns below (FORBIDDEN_DEFERRAL_REGEXES). Plain substrings are
 * matched verbatim against the lowercased reason.
 */
export const FORBIDDEN_DEFERRAL_PHRASES: ReadonlyArray<string> = [
  'for now',
  'just for now',
  "we'll fix",
  "we'll get",
  "we'll come back",
  'will fix',
  'will address',
  'address in',
  'later',
  'eventually',
  'todo',
  'fixme',
  'hack',
  'xxx',
  'temporary',
  'stub',
  'placeholder',
  'pending',
  'defer',
  'deferred',
  'next pass',
  'follow-up',
  'follow up',
  'next time',
];

/**
 * Patterns that need a real regex (not a substring) — case-insensitive.
 * "until F" / "until v" must require an identifier-tail so "until Friday"
 * is rejected but "until file end" isn't a false positive. We use
 * `\buntil F[A-Z0-9_]` / `\buntil v\d` so they only fire on the
 * version/phase shape `until F5`, `until v0.2`, etc.
 */
export const FORBIDDEN_DEFERRAL_REGEXES: ReadonlyArray<RegExp> = [
  /\buntil\s+F[A-Za-z0-9_]/i,
  /\buntil\s+v\d/i,
  /\buntil\s+phase\s+\w/i,
];

interface ForbiddenMatch {
  readonly phrase: string;
}

function findForbiddenPhrase(reason: string): ForbiddenMatch | null {
  const lower = reason.toLowerCase();
  for (const phrase of FORBIDDEN_DEFERRAL_PHRASES) {
    if (lower.includes(phrase)) return { phrase };
  }
  for (const re of FORBIDDEN_DEFERRAL_REGEXES) {
    const m = re.exec(reason);
    if (m !== null) return { phrase: m[0] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parser internals
// ---------------------------------------------------------------------------

// Separators accepted between the pattern and the count in `Searched:`,
// and between `file:line` and the reason in `Excluded:`. The PRD uses an
// em-dash; agents may emit `--` or ` - ` in practice — accept all three.
const SEPARATOR_REGEX = /\s+(?:—|--|-)\s+/;

function findLastBlockStart(text: string, label: string): number {
  // Find the last line that starts with `<label>:` (after optional
  // leading whitespace). Use a per-line scan so we robustly skip the
  // agent quoting the grammar prelude back at the top of its response.
  const lines = text.split(/\r?\n/);
  const offsets: number[] = [];
  let charOffset = 0;
  for (const line of lines) {
    offsets.push(charOffset);
    charOffset += line.length + 1; // +1 for the newline we split on
  }
  const labelRegex = new RegExp(`^\\s*${label}:`);
  let lastIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (labelRegex.test(lines[i])) lastIdx = i;
  }
  return lastIdx === -1 ? -1 : offsets[lastIdx];
}

function parseSearchedLine(line: string, rawText: string): SearchedBlock {
  const body = line.replace(/^\s*Searched:\s*/, '');
  const parts = body.split(SEPARATOR_REGEX);
  if (parts.length < 2) {
    throw new DispatchRejected(
      `Malformed Searched: line — expected "<pattern> — <N matches>" but got: ${line.trim()}`,
      [],
      rawText,
    );
  }
  const pattern = parts[0].trim();
  const countPart = parts.slice(1).join(' - ').trim();
  const countMatch = /^(\d+)\s+match(?:es)?\b/i.exec(countPart);
  if (countMatch === null) {
    throw new DispatchRejected(
      `Malformed Searched: count — expected "<N> matches" but got: ${countPart}`,
      [],
      rawText,
    );
  }
  if (pattern.length === 0) {
    throw new DispatchRejected(
      `Malformed Searched: pattern is empty in: ${line.trim()}`,
      [],
      rawText,
    );
  }
  return { pattern, count: Number.parseInt(countMatch[1], 10) };
}

function parseFileLine(token: string, rawText: string): FileLine {
  const trimmed = token.trim();
  const m = /^(.+):(\d+)$/.exec(trimmed);
  if (m === null) {
    throw new DispatchRejected(
      `Malformed file:line entry — expected "path/to/file.ts:LINE" but got: ${trimmed}`,
      [],
      rawText,
    );
  }
  const file = m[1].trim();
  const line = Number.parseInt(m[2], 10);
  if (file.length === 0 || line <= 0) {
    throw new DispatchRejected(
      `Malformed file:line entry — empty path or non-positive line in: ${trimmed}`,
      [],
      rawText,
    );
  }
  return { file, line };
}

function parseIncludedLine(line: string, rawText: string): ReadonlyArray<FileLine> {
  const body = line.replace(/^\s*Included:\s*/, '').trim();
  if (body.length === 0) {
    throw new DispatchRejected('Included: block is empty', [], rawText);
  }
  return body.split(',').map((tok) => parseFileLine(tok, rawText));
}

function collectExcludedBody(text: string, startOffset: number): string {
  // Excluded may span multiple lines. Take from the Excluded line
  // forward; stop at a blank line, end of text, or a fresh top-level
  // label (e.g. `Notes:`) at column 0.
  const tail = text.slice(startOffset);
  const lines = tail.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (i === 0) {
      out.push(line);
      continue;
    }
    if (line.trim().length === 0) break;
    if (/^[A-Za-z][A-Za-z0-9_-]*:\s/.test(line)) break;
    out.push(line);
  }
  return out.join(' ');
}

function parseExcludedBlock(
  text: string,
  startOffset: number,
  rawText: string,
): ReadonlyArray<ExcludedEntry> {
  const joined = collectExcludedBody(text, startOffset);
  const body = joined.replace(/^\s*Excluded:\s*/, '').trim();
  if (body.length === 0) return [];
  // Entries are separated by commas that are NOT inside a reason. A
  // comma followed by something that looks like another file:line (path
  // ending `:digits` followed by a separator) starts a new entry.
  const splitter = /,\s*(?=[^,\s][^,]*:\d+\s+(?:—|--|-)\s+)/;
  const tokens = body.split(splitter);
  const entries: ExcludedEntry[] = [];
  for (const tok of tokens) {
    const parts = tok.split(SEPARATOR_REGEX);
    if (parts.length < 2) {
      throw new DispatchRejected(
        `Malformed Excluded: entry — expected "<file:line> — <reason>" but got: ${tok.trim()}`,
        [],
        rawText,
      );
    }
    const fileLine = parseFileLine(parts[0], rawText);
    const reason = parts.slice(1).join(' - ').trim();
    if (reason.length === 0) {
      throw new DispatchRejected(
        `Malformed Excluded: entry — empty reason for ${parts[0].trim()}`,
        [],
        rawText,
      );
    }
    entries.push({ ...fileLine, reason });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Public parser + validator
// ---------------------------------------------------------------------------

export function parseReturn(text: string): ParsedDispatchReturn {
  const searchedStart = findLastBlockStart(text, 'Searched');
  const includedStart = findLastBlockStart(text, 'Included');
  const excludedStart = findLastBlockStart(text, 'Excluded');

  const missing: MissingBlock[] = [];
  if (searchedStart === -1) missing.push('Searched');
  if (includedStart === -1) missing.push('Included');
  if (excludedStart === -1) missing.push('Excluded');
  if (missing.length > 0) {
    throw new DispatchRejected(
      `Sub-agent return is missing required block(s): ${missing.join(', ')}`,
      missing,
      text,
    );
  }

  const searchedLineEnd = text.indexOf('\n', searchedStart);
  const searchedLine = text.slice(
    searchedStart,
    searchedLineEnd === -1 ? text.length : searchedLineEnd,
  );
  const includedLineEnd = text.indexOf('\n', includedStart);
  const includedLine = text.slice(
    includedStart,
    includedLineEnd === -1 ? text.length : includedLineEnd,
  );

  const searched = parseSearchedLine(searchedLine, text);
  const included = parseIncludedLine(includedLine, text);
  const excluded = parseExcludedBlock(text, excludedStart, text);

  return { searched, included, excluded, rawText: text };
}

export function validateParsed(parsed: ParsedDispatchReturn): void {
  const { searched, included, excluded, rawText } = parsed;

  // Rule 1: Skipped-the-audit detector. Multi-match search but only
  // one inclusion and no exclusions = the sub-agent didn't audit
  // siblings.
  if (searched.count > 1 && included.length === 1 && excluded.length === 0) {
    throw new DispatchRejected(
      `Sub-agent skipped the same-class audit: Searched reported ${searched.count} matches ` +
        `for "${searched.pattern}" but Included covers only 1 file:line and Excluded is empty. ` +
        `Either include the other ${searched.count - 1} matches in the fix, or list them in ` +
        `Excluded with a one-line non-deferral reason.`,
      [],
      rawText,
    );
  }

  // Rule 2: forbidden deferral phrases in exclusion reasons.
  for (const entry of excluded) {
    const hit = findForbiddenPhrase(entry.reason);
    if (hit !== null) {
      throw new DispatchRejected(
        `Excluded reason for ${entry.file}:${entry.line} contains forbidden deferral phrase ` +
          `"${hit.phrase}" — rewrite the reason to explain why the exclusion is permanent, ` +
          `or move the file:line into Included and fix it. ` +
          `(Source: .claude/rules/agent-discipline.md §"Just for now is bullshit")`,
        [],
        rawText,
      );
    }
  }
}
