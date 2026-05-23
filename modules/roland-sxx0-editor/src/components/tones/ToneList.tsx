/**
 * Tone list component — bank-headed slot list with the v3 mockup
 * polish applied (Phase 9 Task 4 page 2).
 *
 * Functional contracts intentionally unchanged:
 *   - data-testid="tone-item-N" / data-testid="tone-name" still set
 *     on each row (legacy test/ui/tones.spec.ts depends on these).
 *   - data-capability="C-TONE-01" still set on the list root
 *     (test/wiring/tones.spec.ts depends on this).
 *   - Each row's accessible name leads with the slot label
 *     (T11..T48) so getByRole('button', { name: /^T11/ })
 *     queries continue to resolve.
 *
 * The per-row Export affordance was removed 2026-05-19 — it was a
 * vestige from before the library page existed. Export still lives
 * on the tone editor's title row (ToneEditorHead).
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { isToneEmpty } from '@/lib/slot-allocation';
import { SlotInfo } from '@/components/common/SlotInfo';
import { BankHeader } from '@/components/common/BankHeader';
import {
  useCollapsedBanks,
  computeBankInfo,
  createRowKeyDownHandler,
} from '@/components/common/bank-list-helpers';

interface ToneListProps {
  /** Sparse array of tones - undefined = not loaded */
  tones: (SamplerTone | undefined)[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Which banks have been loaded */
  loadedBanks: number[];
  /** Number of tones per bank */
  tonesPerBank: number;
  /** Bank index currently being loaded (null if none) */
  loadingBank?: number | null;
  /** Called when user clicks an unloaded tone to load its bank */
  onLoadBank?: (bankIndex: number) => void;
  /** Called when user clicks the per-bank reload button. Re-fetches
   *  the entire bank from the device, invalidating the cache. */
  onReloadBank?: (bankIndex: number) => void;
}

export function ToneList({
  tones,
  selectedIndex,
  onSelect,
  loadedBanks: _loadedBanks,
  tonesPerBank,
  loadingBank,
  onLoadBank,
  onReloadBank,
}: ToneListProps) {
  const { memoryLayout } = useDeviceConfig();

  // Group rows by bank so we can emit a sticky bank header before each.
  const totalBanks = Math.ceil(tones.length / tonesPerBank);

  const { collapsedBanks, toggleBank } = useCollapsedBanks();

  return (
    <aside
      className="ac-list"
      data-capability="C-TONE-01"
      aria-label="Tone list"
    >
      <div className="ac-list-scroll">
        {Array.from({ length: totalBanks }, (_, bankIndex) => {
          // A bank counts as "loaded" if at least one slot in its range
          // has data. The reload-icon affordance renders for every
          // bank regardless of state — for unloaded banks it acts as
          // "load this bank", for loaded banks it re-fetches.
          // forceReload=true in the handler works in both cases.
          const {
            bankStart,
            bankEnd,
            firstSlotLabel,
            lastSlotLabel,
            isCollapsed,
            isBankLoaded,
            isThisBankLoading,
          } = computeBankInfo({
            items: tones,
            bankIndex,
            perBank: tonesPerBank,
            formatSlot: memoryLayout.formatToneSlot,
            collapsedBanks,
            loadingBank,
          });

          return (
            <div key={`bank-${bankIndex}`} data-bank-index={bankIndex}>
              <BankHeader
                bankIndex={bankIndex}
                firstSlotLabel={firstSlotLabel}
                lastSlotLabel={lastSlotLabel}
                isCollapsed={isCollapsed}
                onToggle={() => toggleBank(bankIndex)}
                isBankLoaded={isBankLoaded}
                isThisBankLoading={isThisBankLoading}
                onReload={onReloadBank}
                testIdPrefix="tone-bank"
              />

              <div className="ac-collapse" data-expanded={!isCollapsed}>
                <div>
              {tones.slice(bankStart, bankEnd).map((tone, offset) => {
                const index = bankStart + offset;
                const isLoaded = tone !== undefined;
                const isEmpty = isLoaded && isToneEmpty(tone);
                const isSelected = index === selectedIndex;
                const slotBank = Math.floor(index / tonesPerBank);
                const isBankLoading = loadingBank === slotBank;

                const handleClick = () => {
                  if (isLoaded) {
                    // Select-only: clicking an already-selected row is a
                    // no-op (no toggle-to-deselect). The operator should
                    // always have a tone selected so the editor stays
                    // mounted; null selection happens only when the page
                    // first mounts before any data is loaded.
                    onSelect(index);
                  } else if (!isBankLoading && onLoadBank) {
                    onLoadBank(slotBank);
                  }
                };

                // Outer element is a div with role="button" rather than a
                // real <button> because the row historically nested an
                // inline action button (Export). That button has been
                // removed but the role="button" structure is retained
                // since it doesn't hurt — switching to a real <button>
                // is a separate cleanup.
                const handleKeyDown = createRowKeyDownHandler({
                  isBankLoading,
                  onActivate: handleClick,
                });

                // Display rules:
                //   - bank loading:  '(loading...)'
                //   - not loaded:    '' (the eyebrow below renders
                //                       "click to load bank" — the
                //                       row already communicates the
                //                       state without a duplicate
                //                       placeholder string)
                //   - loaded named:  the actual name
                //   - loaded blank:  '' (no parenthesized placeholder;
                //                       the silence reads as "no
                //                       content here", and the
                //                       `--empty` styling on the row
                //                       still conveys the "no wave"
                //                       state visually).
                // Name and wave-data state are independent — a slot
                // can hold a name with no wave (operator typed a name
                // before importing a sample) or vice versa.
                const displayName = isBankLoading
                  ? '(loading...)'
                  : isLoaded
                    ? tone.name
                    : '';

                const nameClass = !isLoaded
                  ? 'ac-list-name ac-list-name--placeholder'
                  : isEmpty
                    ? 'ac-list-name ac-list-name--empty'
                    : 'ac-list-name';

                return (
                  <div
                    key={index}
                    data-testid={`tone-item-${index}`}
                    role="button"
                    tabIndex={isBankLoading ? -1 : 0}
                    aria-disabled={isBankLoading}
                    aria-selected={isSelected}
                    onClick={isBankLoading ? undefined : handleClick}
                    onKeyDown={handleKeyDown}
                    className="ac-list-row"
                  >
                    <span className="ac-list-slot">
                      {memoryLayout.formatToneSlot(index)}
                    </span>
                    <SlotInfo
                      nameClass={nameClass}
                      displayName={displayName}
                      isLoaded={isLoaded}
                      isBankLoading={isBankLoading}
                      testId="tone-name"
                    />
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
