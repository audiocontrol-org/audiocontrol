/**
 * BankHeader
 *
 * Shared per-bank header rendered by PatchList and ToneList. Contains
 * the bank-toggle button (chevron + "Bank N" label), the slot-range
 * readout, and the optional reload icon button.
 *
 * Extracted 2026-05-22 from PatchList.tsx (lines 110-156) and
 * ToneList.tsx (lines 100-144) per clones.yaml group fc08c274d295
 * disposition (the largest of 5 sibling clones across the bank-render
 * loop). Pre-extraction the two files held byte-identical JSX
 * differing only in the testid prefix (`patch-bank-*` vs
 * `tone-bank-*`). Wrapper classes (`.ac-list-bank-header`,
 * `.ac-list-bank-toggle`, `.ac-list-bank-meta`, `.ac-list-bank-reload`,
 * `.ac-list-bank-reload--spinning`) and the reload SVG path are
 * preserved verbatim. Contract pinned by D-PATCH-LIST-10 +
 * D-TONE-LIST-09 wiring assertions added before this extraction.
 *
 * The reload SVG glyph is duplicated with DeviceMemoryPanel's
 * `ReloadIcon` helper. A future extraction can promote that into a
 * shared `<ReloadIcon />` component if a third call site emerges —
 * for now the literal SVG stays inline here so the BankHeader extract
 * doesn't snowball into a chained refactor.
 */

import { AcChevron } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';

export interface BankHeaderProps {
  bankIndex: number;
  firstSlotLabel: string;
  lastSlotLabel: string;
  isCollapsed: boolean;
  onToggle: () => void;
  /** Whether the bank has at least one loaded slot. Drives the
   *  reload button's a11y label ("Reload bank N" vs "Load bank N"). */
  isBankLoaded: boolean;
  /** Whether this specific bank is mid-load. Disables the reload
   *  button + applies the spinning modifier class. */
  isThisBankLoading: boolean;
  /** When provided, renders the bank-reload icon button. Single-button
   *  contract: the same button covers both "load" and "reload"
   *  semantics, with the a11y label varying per `isBankLoaded`. */
  onReload?: (bankIndex: number) => void;
  /** Prefix for the two rendered data-testid attributes:
   *  `<prefix>-toggle-<bankIndex>` on the toggle button,
   *  `<prefix>-reload-<bankIndex>` on the reload button. Existing call
   *  sites use `patch-bank` (PatchList) and `tone-bank` (ToneList). */
  testIdPrefix: string;
}

export function BankHeader({
  bankIndex,
  firstSlotLabel,
  lastSlotLabel,
  isCollapsed,
  onToggle,
  isBankLoaded,
  isThisBankLoading,
  onReload,
  testIdPrefix,
}: BankHeaderProps): JSX.Element {
  const reloadLabel = isBankLoaded
    ? `Reload bank ${bankIndex + 1}`
    : `Load bank ${bankIndex + 1}`;
  return (
    <div className="ac-list-bank-header">
      <button
        type="button"
        className="ac-list-bank-toggle"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-label={`Toggle bank ${bankIndex + 1}`}
        data-testid={`${testIdPrefix}-toggle-${bankIndex}`}
      >
        <AcChevron expanded={!isCollapsed} />
        <span>Bank {bankIndex + 1}</span>
      </button>
      <span className="ac-list-bank-meta">
        <strong>{firstSlotLabel}–{lastSlotLabel}</strong>
        {onReload && (
          <button
            type="button"
            className={cn(
              'ac-list-bank-reload',
              isThisBankLoading && 'ac-list-bank-reload--spinning',
            )}
            onClick={() => onReload(bankIndex)}
            disabled={isThisBankLoading}
            aria-label={reloadLabel}
            title={reloadLabel}
            data-testid={`${testIdPrefix}-reload-${bankIndex}`}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8a5 5 0 0 1 9-3" />
              <polyline points="12 2 12 5 9 5" />
              <path d="M13 8a5 5 0 0 1-9 3" />
              <polyline points="4 14 4 11 7 11" />
            </svg>
          </button>
        )}
      </span>
    </div>
  );
}
