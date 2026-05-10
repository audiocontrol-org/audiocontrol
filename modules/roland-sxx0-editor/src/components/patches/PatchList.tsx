/**
 * Patch list component - displays patches with loading states
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

export function PatchList({ patches, selectedIndex, onSelect, loadedBanks: _loadedBanks, patchesPerBank, loadingBank, onLoadBank, onExportPatch }: PatchListProps) {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  return (
    <div className="card p-2" data-capability="C-PATCH-01">
      <div className="px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">Patches</span>
      </div>
      <div className="ac-scroll-list space-y-1">
        {patches.map((patch, index) => {
          const isLoaded = patch !== undefined;
          const isEmpty = isLoaded && isPatchEmpty(patch);
          const isSelected = index === selectedIndex;
          const bankIndex = Math.floor(index / patchesPerBank);

          const isBankLoading = loadingBank === bankIndex;

          const handleClick = () => {
            if (isLoaded) {
              onSelect(isSelected ? null : index);
            } else if (!isBankLoading && onLoadBank) {
              onLoadBank(bankIndex);
            }
          };

          // Outer element is a div with role="button" rather than a real
          // <button>, because we need to nest the per-row Export <button>
          // inside it. <button> inside <button> trips React's
          // validateDOMNesting warning (and is invalid HTML — browsers will
          // hoist the inner button out unpredictably). Keyboard activation
          // (Enter / Space) is wired explicitly to match native semantics.
          const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
            if (isBankLoading) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          };
          return (
            <div
              key={index}
              data-testid={`patch-item-${index}`}
              role="button"
              tabIndex={isBankLoading ? -1 : 0}
              aria-disabled={isBankLoading}
              onClick={isBankLoading ? undefined : handleClick}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full px-3 py-2 rounded text-left text-sm transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                isLoaded ? 'hover:bg-s330-accent/50' : 'hover:bg-s330-accent/20 cursor-pointer',
                isBankLoading && 'cursor-wait',
                isSelected
                  ? 'bg-s330-highlight text-white'
                  : !isLoaded
                    ? 'text-s330-muted/30 bg-s330-panel/50'
                    : isEmpty
                      ? 'text-s330-muted/50'
                      : 'text-s330-text'
              )}
            >
              <div className="flex items-center justify-between">
                <PatchLabel index={index} memoryLayout={memoryLayout} />
                <span
                  className={cn(
                    'flex-1 mx-3 truncate',
                    (!isLoaded || isEmpty) && 'italic'
                  )}
                  data-testid="patch-name"
                >
                  {isBankLoading
                    ? '(loading...)'
                    : !isLoaded
                      ? '(not loaded)'
                      : isEmpty
                        ? '(empty)'
                        : patch.common.name}
                </span>
                {!isLoaded && !isBankLoading && (
                  <span className="text-xs text-s330-muted/50">click to load</span>
                )}
                {isLoaded && !isEmpty && onExportPatch && (
                  <button
                    type="button"
                    data-testid="export-patch-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportPatch(index);
                    }}
                    className={cn(
                      'ml-2 px-2 py-0.5 text-xs rounded transition-colors',
                      isSelected
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : 'bg-s330-accent/50 hover:bg-s330-accent text-s330-text'
                    )}
                    title="Export patch to library"
                  >
                    Export
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
