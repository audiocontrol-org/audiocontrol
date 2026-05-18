/**
 * Patch list component — bank-headed slot list with hover-revealed
 * Export action and per-row load state.
 *
 * Visual treatment is the operator-approved v3 mockup direction
 * (Phase 9 Task 4). Functional contracts intentionally unchanged:
 *   - data-testid="patch-item-N" / data-testid="patch-name" still set
 *     on each row (legacy test/ui/patches.spec.ts depends on these).
 *   - data-capability="C-PATCH-01" still set on the list root
 *     (test/wiring/patches.spec.ts depends on this).
 *   - Each row's accessible name still leads with the slot label
 *     (P11..P28 / II11..II48) so getByRole('button', { name: /^P11/ })
 *     queries continue to resolve.
 *
 * Per-row Export <button> is nested inside an outer role="button" div,
 * not a real <button>, because <button> nested in <button> is invalid
 * HTML — see comment further down for keyboard wiring.
 */

import { useState, type KeyboardEvent } from 'react';

import type { SamplerPatch } from '@/core/midi/SamplerClient';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { PatchLabel } from '@/components/common/PatchLabel';
import { isPatchEmpty } from '@/lib/slot-allocation';

interface PatchListProps {
  /** Sparse array of patches - undefined = not loaded */
  patches: (SamplerPatch | undefined)[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Which banks have been loaded */
  loadedBanks: number[];
  /** Number of patches per bank */
  patchesPerBank: number;
  /** Bank index currently being loaded (null if none) */
  loadingBank?: number | null;
  /** Called when user clicks an unloaded patch to load its bank */
  onLoadBank?: (bankIndex: number) => void;
  /** Called when user clicks the per-bank reload button. Re-fetches
   *  the bank from the device, invalidating the cache. */
  onReloadBank?: (bankIndex: number) => void;
  /** Called when user clicks the export button on a patch */
  onExportPatch?: (index: number) => void;
}

/**
 * Render the slot at `index` with bank headers inserted before each
 * bank boundary. The slot identity comes from the device config's
 * MemoryLayout, so S-330 (P11..P28) and S-550 (II11..II48 / I11..I28)
 * route through the same component without device conditionals.
 */
export function PatchList({
  patches,
  selectedIndex,
  onSelect,
  loadedBanks: _loadedBanks,
  patchesPerBank,
  loadingBank,
  onLoadBank,
  onReloadBank,
  onExportPatch,
}: PatchListProps) {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  // Group rows by bank so we can emit a sticky bank header before each.
  // Each bank-N section is a sequence: [header, ...rows-in-bank].
  const totalBanks = Math.ceil(patches.length / patchesPerBank);

  // Per-bank collapse state — see ToneList for the same pattern.
  const [collapsedBanks, setCollapsedBanks] = useState<Set<number>>(() => new Set());
  const toggleBank = (i: number): void => {
    setCollapsedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <aside
      className="ac-list"
      data-capability="C-PATCH-01"
      aria-label="Patch list"
    >
      <div className="ac-list-scroll">
        {Array.from({ length: totalBanks }, (_, bankIndex) => {
          const bankStart = bankIndex * patchesPerBank;
          const bankEnd = Math.min(bankStart + patchesPerBank, patches.length);
          const firstSlotLabel = memoryLayout.formatPatchSlot(bankStart);
          const lastSlotLabel = memoryLayout.formatPatchSlot(bankEnd - 1);
          const isCollapsed = collapsedBanks.has(bankIndex);
          const isBankLoaded = patches
            .slice(bankStart, bankEnd)
            .some((p) => p !== undefined);
          const isThisBankLoading = loadingBank === bankIndex;

          return (
            <div
              key={`bank-${bankIndex}`}
              data-bank-index={bankIndex}
            >
              <div className="ac-list-bank-header">
                <button
                  type="button"
                  className="ac-list-bank-toggle"
                  onClick={() => toggleBank(bankIndex)}
                  aria-expanded={!isCollapsed}
                  aria-label={`Toggle bank ${bankIndex + 1}`}
                  data-testid={`patch-bank-toggle-${bankIndex}`}
                >
                  <span className="ac-list-bank-chevron" aria-hidden="true">
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                  <span>Bank {bankIndex + 1}</span>
                </button>
                <span className="ac-list-bank-meta">
                  <strong>
                    {firstSlotLabel}–{lastSlotLabel}
                  </strong>
                  {onReloadBank && (
                    <button
                      type="button"
                      className={cn(
                        'ac-list-bank-reload',
                        isThisBankLoading && 'ac-list-bank-reload--spinning',
                      )}
                      onClick={() => onReloadBank(bankIndex)}
                      disabled={isThisBankLoading}
                      aria-label={
                        isBankLoaded
                          ? `Reload bank ${bankIndex + 1}`
                          : `Load bank ${bankIndex + 1}`
                      }
                      title={
                        isBankLoaded
                          ? `Reload bank ${bankIndex + 1}`
                          : `Load bank ${bankIndex + 1}`
                      }
                      data-testid={`patch-bank-reload-${bankIndex}`}
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

              <div className="ac-collapse" data-expanded={!isCollapsed}>
                <div>
              {patches.slice(bankStart, bankEnd).map((patch, offset) => {
                const index = bankStart + offset;
                const isLoaded = patch !== undefined;
                const isEmpty = isLoaded && isPatchEmpty(patch);
                const isSelected = index === selectedIndex;
                const slotBank = Math.floor(index / patchesPerBank);
                const isBankLoading = loadingBank === slotBank;

                const handleClick = () => {
                  if (isLoaded) {
                    // Select-only: see ToneList for rationale.
                    onSelect(index);
                  } else if (!isBankLoading && onLoadBank) {
                    onLoadBank(slotBank);
                  }
                };

                // Outer element is a div with role="button" rather than a
                // real <button>, because we need to nest the per-row
                // Export <button> inside it. <button> inside <button>
                // trips React's validateDOMNesting warning (and is
                // invalid HTML — browsers will hoist the inner button
                // out unpredictably). Keyboard activation (Enter / Space)
                // is wired explicitly to match native semantics.
                const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                  if (isBankLoading) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                  }
                };

                // Display rules:
                //   - bank loading:  '(loading...)'
                //   - not loaded:    '' (eyebrow below renders the
                //                       "click to load bank" hint, so
                //                       no duplicate placeholder)
                //   - loaded named:  patch.common.name
                //   - loaded empty:  '' (silence reads as empty;
                //                       --empty styling still conveys
                //                       the empty-slot state visually).
                const displayName = isBankLoading
                  ? '(loading...)'
                  : isLoaded && !isEmpty
                    ? patch.common.name
                    : '';

                const nameClass = !isLoaded
                  ? 'ac-list-name ac-list-name--placeholder'
                  : isEmpty
                    ? 'ac-list-name ac-list-name--empty'
                    : 'ac-list-name';

                return (
                  <div
                    key={index}
                    data-testid={`patch-item-${index}`}
                    role="button"
                    tabIndex={isBankLoading ? -1 : 0}
                    aria-disabled={isBankLoading}
                    aria-selected={isSelected}
                    onClick={isBankLoading ? undefined : handleClick}
                    onKeyDown={handleKeyDown}
                    className={cn('patches__list-row')}
                  >
                    <span className="ac-list-slot">
                      <PatchLabel index={index} memoryLayout={memoryLayout} />
                    </span>
                    <span className="ac-list-info">
                      <span
                        className={nameClass}
                        data-testid="patch-name"
                      >
                        {displayName}
                      </span>
                      {!isLoaded && !isBankLoading && (
                        <span className="ac-list-eyebrow">
                          click to load
                        </span>
                      )}
                    </span>
                    {isLoaded && !isEmpty && onExportPatch && (
                      <button
                        type="button"
                        data-testid="export-patch-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportPatch(index);
                        }}
                        className="ac-list-action"
                        title="Export patch to library"
                      >
                        Export
                      </button>
                    )}
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
