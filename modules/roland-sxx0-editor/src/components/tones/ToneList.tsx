/**
 * Tone list component — bank-headed slot list with the v3 mockup
 * polish applied (Phase 9 Task 4 page 2).
 *
 * Functional contracts intentionally unchanged:
 *   - data-testid="tone-item-N" / data-testid="tone-name" still set
 *     on each row (legacy test/ui/tones.spec.ts depends on these).
 *   - data-capability="C-TONE-01" still set on the list root
 *     (test/wiring/tones.spec.ts depends on this).
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

import { useState, type KeyboardEvent } from 'react';

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
  /** Called when user clicks the per-bank reload button. Re-fetches
   *  the entire bank from the device, invalidating the cache. */
  onReloadBank?: (bankIndex: number) => void;
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
  onReloadBank,
  onExportTone,
  canExportToLibrary = false,
}: ToneListProps) {
  const { memoryLayout } = useDeviceConfig();

  // Group rows by bank so we can emit a sticky bank header before each.
  const totalBanks = Math.ceil(tones.length / tonesPerBank);

  // Per-bank collapse state. Default: every bank expanded. Operator
  // clicks the bank header chevron-button to toggle. State is
  // component-local (not persisted across navigations) — kept simple
  // until we hear the operator wants persistence.
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
      data-capability="C-TONE-01"
      aria-label="Tone list"
    >
      <div className="ac-list-scroll">
        {Array.from({ length: totalBanks }, (_, bankIndex) => {
          const bankStart = bankIndex * tonesPerBank;
          const bankEnd = Math.min(bankStart + tonesPerBank, tones.length);
          const firstSlotLabel = memoryLayout.formatToneSlot(bankStart);
          const lastSlotLabel = memoryLayout.formatToneSlot(bankEnd - 1);
          const isCollapsed = collapsedBanks.has(bankIndex);
          // A bank counts as "loaded" if at least one slot in its range
          // has data. The reload-icon affordance renders for every
          // bank regardless of state — for unloaded banks it acts as
          // "load this bank", for loaded banks it re-fetches.
          // forceReload=true in the handler works in both cases.
          const isBankLoaded = tones
            .slice(bankStart, bankEnd)
            .some((t) => t !== undefined);
          const isThisBankLoading = loadingBank === bankIndex;

          return (
            <div key={`bank-${bankIndex}`} data-bank-index={bankIndex}>
              <div className="ac-list-bank-header">
                <button
                  type="button"
                  className="ac-list-bank-toggle"
                  onClick={() => toggleBank(bankIndex)}
                  aria-expanded={!isCollapsed}
                  aria-label={`Toggle bank ${bankIndex + 1}`}
                  data-testid={`tone-bank-toggle-${bankIndex}`}
                >
                  <span className="ac-list-bank-chevron" aria-hidden="true">
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                  <span>Bank {bankIndex + 1}</span>
                </button>
                <span className="ac-list-bank-meta">
                  <strong>{firstSlotLabel}–{lastSlotLabel}</strong>
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
                      data-testid={`tone-bank-reload-${bankIndex}`}
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
                          click to load
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
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
