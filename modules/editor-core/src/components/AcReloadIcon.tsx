/**
 * AcReloadIcon
 *
 * 16x16 reload-arrows SVG glyph. The same four-path shape historically
 * lived inline in three roland-sxx0-editor call sites:
 *   - BankHeader (per-bank reload button)
 *   - PatchesPage / TonesPage / PlayPage (title-row refresh-all button)
 *   - DeviceMemoryPanel (per-bank reload — now consumed via BankHeader)
 *
 * Originally extracted 2026-05-22 as part of the PageTitleRow refactor
 * walk (clones.yaml c53786bfb969 + c3ee44db4131 + 8ab1699757ff).
 * Promoted to editor-core 2026-05-24 alongside PageTitleRow per
 * akai-harmonization Phase 2 task 2.2 so future editor dialects can
 * consume the same canonical refresh glyph.
 *
 * No props by design — the glyph is a fixed visual primitive. The
 * surrounding `<button>` carries all variable affordance state
 * (aria-label, disabled, spinning class).
 */

export function AcReloadIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8a5 5 0 0 1 9-3" />
      <polyline points="12 2 12 5 9 5" />
      <path d="M13 8a5 5 0 0 1-9 3" />
      <polyline points="4 14 4 11 7 11" />
    </svg>
  );
}
