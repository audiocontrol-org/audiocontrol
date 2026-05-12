/**
 * Patch list component — bank-headed slot list with hover-revealed
 * Export action and per-row load state.
 *
 * Visual treatment is the operator-approved v3 mockup direction
 * (Phase 9 Task 4). Functional contracts intentionally unchanged:
 *   - data-testid="patch-item-N" / data-testid="patch-name" still set
 *     on each row (legacy test/ui/patches.spec.ts depends on these).
 *   - data-capability="C-PATCH-01" still set on the list root
 *     (test/ui/capabilities/patches.spec.ts depends on this).
 *   - Each row's accessible name still leads with the slot label
 *     (P11..P28 / II11..II48) so getByRole('button', { name: /^P11/ })
 *     queries continue to resolve.
 *
 * Per-row Export <button> is nested inside an outer role="button" div,
 * not a real <button>, because <button> nested in <button> is invalid
 * HTML — see comment further down for keyboard wiring.
 */

import type { KeyboardEvent } from 'react';

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
  onExportPatch,
}: PatchListProps) {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  // Group rows by bank so we can emit a sticky bank header before each.
  // Each bank-N section is a sequence: [header, ...rows-in-bank].
  const totalBanks = Math.ceil(patches.length / patchesPerBank);

  return (
    <aside
      className="ac-list"
      data-capability="C-PATCH-01"
      aria-label="Patch list"
    >
      <div className="ac-list-scroll ac-scroll-list">
        {Array.from({ length: totalBanks }, (_, bankIndex) => {
          const bankStart = bankIndex * patchesPerBank;
          const bankEnd = Math.min(bankStart + patchesPerBank, patches.length);
          const firstSlotLabel = memoryLayout.formatPatchSlot(bankStart);
          const lastSlotLabel = memoryLayout.formatPatchSlot(bankEnd - 1);

          return (
            <div
              key={`bank-${bankIndex}`}
              data-bank-index={bankIndex}
            >
              <div className="ac-list-bank-header">
                <span>Bank {bankIndex + 1}</span>
                <strong>
                  {firstSlotLabel}–{lastSlotLabel}
                </strong>
              </div>

              {patches.slice(bankStart, bankEnd).map((patch, offset) => {
                const index = bankStart + offset;
                const isLoaded = patch !== undefined;
                const isEmpty = isLoaded && isPatchEmpty(patch);
                const isSelected = index === selectedIndex;
                const slotBank = Math.floor(index / patchesPerBank);
                const isBankLoading = loadingBank === slotBank;

                const handleClick = () => {
                  if (isLoaded) {
                    onSelect(isSelected ? null : index);
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

                const displayName = isBankLoading
                  ? '(loading...)'
                  : !isLoaded
                    ? '(not loaded)'
                    : isEmpty
                      ? '(empty)'
                      : patch.common.name;

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
                          click to load bank
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
          );
        })}
      </div>
    </aside>
  );
}
