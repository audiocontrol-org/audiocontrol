/**
 * Tone list component — bank-headed slot list with the v3 mockup
 * polish applied (Phase 9 Task 4 page 2).
 *
 * Functional contracts intentionally unchanged:
 *   - data-testid="tone-item-N" / data-testid="tone-name" still set
 *     on each row (legacy test/ui/tones.spec.ts depends on these).
 *   - data-capability="C-TONE-01" still set on the list root
 *     (test/ui/capabilities/tones.spec.ts depends on this).
 *   - data-testid="export-tone-button" still set on the per-row
 *     export action (legacy spec depends on this).
 *   - Each row's accessible name leads with the slot label
 *     (T11..T48) so getByRole('button', { name: /^T11/ })
 *     queries continue to resolve.
 *
 * Per-row Export <button> is nested inside an outer role="button"
 * div, not a real <button>, because <button> nested in <button> is
 * invalid HTML — same workaround documented in PatchList.tsx.
 */

import type { KeyboardEvent } from 'react';

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { isToneEmpty } from '@/lib/slot-allocation';

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
  /** Called when user clicks export on a tone */
  onExportTone?: (index: number) => void;
  /** Whether library export is available (library connected) */
  canExportToLibrary?: boolean;
}

export function ToneList({
  tones,
  selectedIndex,
  onSelect,
  loadedBanks: _loadedBanks,
  tonesPerBank,
  loadingBank,
  onLoadBank,
  onExportTone,
  canExportToLibrary = false,
}: ToneListProps) {
  const { memoryLayout } = useDeviceConfig();

  // Group rows by bank so we can emit a sticky bank header before each.
  const totalBanks = Math.ceil(tones.length / tonesPerBank);

  return (
    <aside
      className="ac-list"
      data-capability="C-TONE-01"
      aria-label="Tone list"
    >
      <div className="ac-list-scroll">
        {Array.from({ length: totalBanks }, (_, bankIndex) => {
          const bankStart = bankIndex * tonesPerBank;
          const bankEnd = Math.min(bankStart + tonesPerBank, tones.length);
          const firstSlotLabel = memoryLayout.formatToneSlot(bankStart);
          const lastSlotLabel = memoryLayout.formatToneSlot(bankEnd - 1);

          return (
            <div key={`bank-${bankIndex}`} data-bank-index={bankIndex}>
              <div className="ac-list-bank-header">
                <span>Group {bankIndex + 1}</span>
                <strong>{firstSlotLabel}–{lastSlotLabel}</strong>
              </div>

              {tones.slice(bankStart, bankEnd).map((tone, offset) => {
                const index = bankStart + offset;
                const isLoaded = tone !== undefined;
                const isEmpty = isLoaded && isToneEmpty(tone);
                const isSelected = index === selectedIndex;
                const slotBank = Math.floor(index / tonesPerBank);
                const isBankLoading = loadingBank === slotBank;

                // Has sample data: end > start. Drives the Export action's
                // visibility (we never offer Export on a wave-less tone).
                const hasSampleData = isLoaded && tone.wave.endPoint > tone.wave.startPoint;

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
                // trips React's validateDOMNesting warning. Keyboard
                // activation (Enter / Space) is wired explicitly.
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
                      ? '(unnamed)'
                      : tone.name;

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
                    className={cn('tones__list-row')}
                  >
                    <span className="ac-list-slot">
                      {memoryLayout.formatToneSlot(index)}
                    </span>
                    <span className="ac-list-info">
                      <span
                        className={nameClass}
                        data-testid="tone-name"
                      >
                        {displayName}
                      </span>
                      {!isLoaded && !isBankLoading && (
                        <span className="ac-list-eyebrow">
                          click to load bank
                        </span>
                      )}
                    </span>
                    {canExportToLibrary && isLoaded && hasSampleData && onExportTone && (
                      <button
                        type="button"
                        data-testid="export-tone-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportTone(index);
                        }}
                        className="ac-list-action"
                        title="Export tone to library"
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
