/**
 * Patch list component - displays patches with loading states
 */

import type { SamplerPatch } from '@/core/midi/SamplerClient';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { PatchLabel } from '@/components/common/PatchLabel';

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
}

/**
 * Check if a patch name indicates it's empty/unused
 */
function isPatchEmpty(patch: SamplerPatch): boolean {
  const name = patch.common.name;
  return name === '' || name === '            ' || name.trim() === '';
}

export function PatchList({ patches, selectedIndex, onSelect, loadedBanks: _loadedBanks, patchesPerBank, loadingBank, onLoadBank }: PatchListProps) {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  return (
    <div className="card p-2">
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

          return (
            <button
              key={index}
              data-testid={`patch-item-${index}`}
              onClick={handleClick}
              disabled={isBankLoading}
              className={cn(
                'w-full px-3 py-2 rounded text-left text-sm transition-colors',
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
                <span className={cn(
                  'flex-1 mx-3 truncate',
                  (!isLoaded || isEmpty) && 'italic'
                )}>
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
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
