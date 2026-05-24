/**
 * tools/scope-discovery/synthesis-warnings.ts
 *
 * Pure builders for synthesizer warning strings. Lifted out of
 * synthesis-derive.ts to (a) keep that file under the 300-500 line
 * cap and (b) give the warning text a single source of truth that the
 * validator suite can import alongside the production callers (DRY).
 */

/**
 * Build the multi-line "PRD has no References/Appendix section"
 * warning. Includes a paste-ready section skeleton the operator can
 * drop into the PRD verbatim (AUDIT-20260524-12). The single returned
 * string is consumed by BOTH stderr (`synthesis: note: <w>`) and the
 * per-run synthesis-notes markdown bullet (where the renderer indents
 * continuation lines so the skeleton stays a single bullet rather
 * than fragmenting).
 */
export function buildMissingReferencesWarning(prdRelPath: string): string {
  return [
    'PRD has no References/Appendix section; reference_docs[] defaulted to PRD + LAYOUT.md.',
    `Add this section to ${prdRelPath} to produce a richer manifest on re-run:`,
    '',
    '  ## References',
    '',
    '  - **Related issues:** [#NNN](url), [#MMM](url)',
    '  - **Related ADRs:** [docs/adr/NNN.md](path)',
    '  - **External docs:** [Title](url)',
  ].join('\n');
}
