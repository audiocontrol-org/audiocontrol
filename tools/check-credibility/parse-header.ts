/**
 * tools/check-credibility/parse-header.ts
 *
 * Parser for the `@credibleAgainst` JSDoc declarations consumed by
 * `tools/check-credibility.ts`. Extracted from the main driver so each
 * file stays within the project's 500-line cap; see Workplan §9R-A.1 T6
 * (GH #392).
 */

export interface CredibilityEntry {
  slot: string;
  variants: ReadonlyArray<string>;
}

export interface ParsedCredibilityHeader {
  entries: ReadonlyArray<CredibilityEntry>;
  // Diagnostic strings for `@credibleAgainst` lines that appeared in the
  // source but were malformed (e.g. slot present, variant list empty). The
  // caller appends these into the manifest's `errors[]` so the silent-drop
  // failure mode surfaces in the manifest rather than vanishing.
  warnings: ReadonlyArray<string>;
}

/**
 * Parse one or more `@credibleAgainst <slot> <variant> [<variant> ...]`
 * lines from a spec's leading JSDoc block. Returns an empty array when no
 * declaration is present — the caller treats that as a hard failure.
 *
 * Slot tokens are restricted to identifier-shape to avoid runaway matches
 * on multi-line JSDoc bodies; variant tokens are whitespace-separated up to
 * the line end (the regex stops at `\n` and `*`).
 *
 * Also surfaces a `warnings[]` list naming any `@credibleAgainst` lines
 * that appear in the source but parse to no variants. Previously these
 * lines were silently dropped, which hid spec-author typos from the
 * manifest. The detector below scans every textual occurrence of the
 * tag — including the malformed shapes the strict regex above rejects.
 */
export function parseCredibilityHeader(source: string): ParsedCredibilityHeader {
  const entries: CredibilityEntry[] = [];
  const re = /@credibleAgainst\s+([A-Za-z][A-Za-z0-9_-]*)\s+([^\n*]+)/g;
  let match: RegExpExecArray | null;
  // Track which source offsets the strict regex accepted; the second pass
  // then complains about every `@credibleAgainst` occurrence whose line did
  // NOT round-trip into an entry.
  const acceptedLineStarts = new Set<number>();
  while ((match = re.exec(source)) !== null) {
    // Two capture groups are present whenever the regex matches; the
    // explicit narrowing guards against an empty alternation slipping in
    // when this regex is extended later. The runtime check fails loudly
    // rather than silently producing an empty slot/variant pair.
    const slot = match[1];
    const tail = match[2];
    if (slot === undefined || tail === undefined) {
      throw new Error(
        `@credibleAgainst regex captured a match with no groups; raw match: ${match[0]}`,
      );
    }
    const variants = tail.trim().split(/\s+/).filter((v) => v !== '');
    if (variants.length === 0) continue;
    acceptedLineStarts.add(source.lastIndexOf('\n', match.index) + 1);
    entries.push({ slot, variants });
  }

  // Second pass: locate every `@credibleAgainst` token in the source and
  // report the ones whose enclosing line was not accepted above. A line is
  // accepted when its start offset appears in `acceptedLineStarts`.
  const warnings: string[] = [];
  const tagRe = /@credibleAgainst/g;
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', tag.index) + 1;
    if (acceptedLineStarts.has(lineStart)) continue;
    const lineEnd = source.indexOf('\n', tag.index);
    const rawLine = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim();
    // Compute 1-based line number for the warning so a spec author can jump
    // directly to the offending location without grepping.
    const lineNumber = source.slice(0, lineStart).split('\n').length;
    warnings.push(
      `malformed @credibleAgainst at line ${String(lineNumber)}: ${rawLine || '(empty)'} — expected "@credibleAgainst <slot> <variant> [<variant> ...]"`,
    );
  }
  return { entries, warnings };
}
