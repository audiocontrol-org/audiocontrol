/**
 * Import Library Patch Dialog — idle form body.
 *
 * Extracted sibling of {@link ImportLibraryPatchDialog} so the host
 * dialog stays under the 500-line cap. The host owns chrome
 * (SlideDrawer) + lifecycle (useExportDialogLifecycle); this file
 * owns the idle form's JSX (patch info, memory map, target slot,
 * per-tone-mapping rows).
 */

import { cn } from '@/lib/utils';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import { BestFitPicker } from '@/components/ui/BestFitPicker';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import type { FitOption, PatchFitValues } from '@/lib/best-fit';
import { isToneSlotEmpty, isPatchSlotEmpty } from '@/lib/slot-allocation';

export interface ToneImportMapping {
  /** Original slot in the library set. */
  originalSlot: number;
  /** File name in the set. */
  fileName: string;
  /** Target slot on device. */
  targetSlot: number;
  /**
   * Target wave bank.
   *
   * `number` (rather than `0 | 1 | 2 | 3`) because the bank `<option>` set is
   * layout-driven via `MemoryLayout.getWaveBanksForTone(targetSlot)` — S-330
   * yields `{0, 1}`, S-550 yields `{0, 1}` for tones 0-31 and `{2, 3}` for
   * tones 32-63. The static literal union cannot encode the per-slot
   * narrowing, and the device-client boundary already validates against
   * `DeviceConfig.maxWaveBankIndex`. Mirrors the widening on
   * `useLibraryImportDialogs.ImportPatchParams` (commit 10a21a6d / #393).
   */
  waveBank: number;
  /** Target segment start. */
  segmentTop: number;
  /** Segments needed (from original tone). */
  segmentsNeeded: number;
}

export interface PatchImportFormBodyProps {
  patch: SamplerPatch | null;
  patchFile: string;
  setName: string;
  memoryLayout: ReturnType<typeof useDeviceConfig>['memoryLayout'];
  totalPatches: number;
  totalTones: number;
  targetPatchSlot: number;
  setTargetPatchSlot: (slot: number) => void;
  willOverwritePatch: boolean;
  existingPatchName: string | undefined;
  missingToneSlots: number[];
  toneMappings: ToneImportMapping[];
  updateToneMapping: (
    index: number,
    updates: Partial<ToneImportMapping>,
  ) => void;
  toneOverwrites: Array<{
    willOverwrite: boolean;
    existingName: string | undefined;
  }>;
  devicePatches: (SamplerPatch | undefined)[];
  deviceTones: (SamplerTone | undefined)[];
  isOperating: boolean;
  proposal: AllocationProposal;
  onFindBestFit: () => void;
  showBestFits: boolean;
  setShowBestFits: (show: boolean) => void;
  fitOptions: FitOption<PatchFitValues>[];
  selectedFitIndex: number | null;
  onSelectFit: (index: number) => void;
  error: string | null;
}

export function PatchImportFormBody({
  patch,
  patchFile,
  setName,
  memoryLayout,
  totalPatches,
  totalTones,
  targetPatchSlot,
  setTargetPatchSlot,
  willOverwritePatch,
  existingPatchName,
  missingToneSlots,
  toneMappings,
  updateToneMapping,
  toneOverwrites,
  devicePatches,
  deviceTones,
  isOperating,
  proposal,
  onFindBestFit,
  showBestFits,
  setShowBestFits,
  fitOptions,
  selectedFitIndex,
  onSelectFit,
  error,
}: PatchImportFormBodyProps): JSX.Element {
  return (
    <div className="ac-export-form flex flex-col min-h-0">
      <p className="text-sm text-s330-muted">
        Import "{patchFile}"{' '}
        {setName === '__individual__' ? 'from library' : `from ${setName}`}{' '}
        with its required tones.
      </p>

      {patch && (
        <div className="bg-s330-bg rounded p-3 text-sm">
          <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">
            Patch Info
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-s330-muted">Name:</span>
              <span className="ml-2 text-s330-text">{patch.common.name}</span>
            </div>
            <div>
              <span className="text-s330-muted">Key Mode:</span>
              <span className="ml-2 text-s330-text capitalize">
                {patch.common.keyMode}
              </span>
            </div>
            <div>
              <span className="text-s330-muted">Level:</span>
              <span className="ml-2 text-s330-text">{patch.common.level}</span>
            </div>
          </div>
        </div>
      )}

      <MemoryMapPanel
        deviceTones={deviceTones}
        toneGroups={memoryLayout.toneGroups}
        formatToneSlot={memoryLayout.formatToneSlot}
        proposal={proposal}
        onFindBestFit={toneMappings.length > 0 ? onFindBestFit : undefined}
        findBestFitDisabled={isOperating}
      />

      {showBestFits && fitOptions.length > 0 && (
        <BestFitPicker
          options={fitOptions}
          selectedIndex={selectedFitIndex}
          onSelect={onSelectFit}
          onClose={() => setShowBestFits(false)}
          disabled={isOperating}
        />
      )}

      <div>
        <label htmlFor="targetPatchSlot" className="ac-field-label mb-1">
          Target Patch Slot
        </label>
        <select
          id="targetPatchSlot"
          value={targetPatchSlot}
          onChange={(e) => setTargetPatchSlot(Number(e.target.value))}
          disabled={isOperating}
          data-testid="target-slot-select"
          className={cn(
            'ac-select',
            willOverwritePatch && 'ac-input--warning',
          )}
        >
          {Array.from({ length: totalPatches }, (_, i) => {
            const existingPatch = devicePatches[i];
            const slotLabel = memoryLayout.formatPatchSlot(i);
            const isEmpty = isPatchSlotEmpty(devicePatches, i);
            const occupancy = isEmpty
              ? ' - (empty)'
              : ` - ${existingPatch?.common.name || ''}`;
            return (
              <option
                key={i}
                value={i}
                data-occupied={!isEmpty || undefined}
              >
                {slotLabel}
                {occupancy}
              </option>
            );
          })}
        </select>
        {willOverwritePatch && (
          <p
            className="text-xs text-yellow-400 mt-1"
            data-testid="slot-occupied-warning"
          >
            Will overwrite "{existingPatchName}"
          </p>
        )}
      </div>

      {missingToneSlots.length > 0 && (
        <div
          data-testid="missing-tone-warning"
          className="text-yellow-400 text-sm p-2 bg-yellow-900/20 rounded"
        >
          Some referenced tones could not be found:{' '}
          {missingToneSlots
            .map((s) => memoryLayout.formatToneSlot(s))
            .join(', ')}
        </div>
      )}

      {toneMappings.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="text-sm text-s330-muted mb-2">
            Required Tones ({toneMappings.length})
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {toneMappings.map((mapping, index) => (
              <ToneMappingRow
                key={mapping.originalSlot}
                mapping={mapping}
                index={index}
                memoryLayout={memoryLayout}
                totalTones={totalTones}
                deviceTones={deviceTones}
                willOverwrite={!!toneOverwrites[index]?.willOverwrite}
                existingName={toneOverwrites[index]?.existingName}
                isOperating={isOperating}
                onUpdate={updateToneMapping}
              />
            ))}
          </div>
        </div>
      )}

      {toneMappings.length === 0 && patch && (
        <div className="bg-s330-bg rounded p-3 text-sm text-s330-muted">
          This patch has no tone assignments.
        </div>
      )}

      {error && (
        <p className="ac-export-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-tone-mapping row. Extracted because the row owns the bank-clamp
// logic on slot-change (S-550 wave-bank validity changes across the
// 32-tone block boundary).
// ---------------------------------------------------------------------------

interface ToneMappingRowProps {
  mapping: ToneImportMapping;
  index: number;
  memoryLayout: ReturnType<typeof useDeviceConfig>['memoryLayout'];
  totalTones: number;
  deviceTones: (SamplerTone | undefined)[];
  willOverwrite: boolean;
  existingName: string | undefined;
  isOperating: boolean;
  onUpdate: (index: number, updates: Partial<ToneImportMapping>) => void;
}

function ToneMappingRow({
  mapping,
  index,
  memoryLayout,
  totalTones,
  deviceTones,
  willOverwrite,
  existingName,
  isOperating,
  onUpdate,
}: ToneMappingRowProps): JSX.Element {
  // Bank options are layout-driven per the mapping's target slot.
  // S-330 always returns A/B; S-550 returns A/B for tones 0-31 and
  // C/D for tones 32-63 — no device conditionals here.
  const { labels: bankLabels, indices: bankIndices } =
    memoryLayout.getWaveBanksForTone(mapping.targetSlot);

  return (
    <div className="bg-s330-bg rounded p-3 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-s330-text font-medium">{mapping.fileName}</span>
        <span className="text-xs text-s330-muted">
          Original: {memoryLayout.formatToneSlot(mapping.originalSlot)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="ac-field-label mb-1">
            Target Slot
            {willOverwrite && (
              <span
                className="ml-1 text-yellow-400"
                title={`Will overwrite ${existingName}`}
              >
                ⚠
              </span>
            )}
          </label>
          <select
            value={mapping.targetSlot}
            onChange={(e) => {
              const newTargetSlot = Number(e.target.value);
              // Clamp wave bank to a valid one for the new target
              // slot — on S-550, moving across the 32-tone block
              // boundary changes the valid bank set ({0,1} ↔ {2,3}).
              // If the current bank is still valid, keep it;
              // otherwise pick the first valid bank for the new slot.
              const validBanks =
                memoryLayout.getWaveBanksForTone(newTargetSlot).indices;
              const newWaveBank = validBanks.includes(mapping.waveBank)
                ? mapping.waveBank
                : (validBanks[0] ?? mapping.waveBank);
              onUpdate(index, {
                targetSlot: newTargetSlot,
                waveBank: newWaveBank,
              });
            }}
            disabled={isOperating}
            className={cn(
              'ac-select ac-select--compact',
              willOverwrite && 'ac-input--warning',
            )}
          >
            {Array.from({ length: totalTones }, (_, i) => {
              const existingTone = deviceTones[i];
              const slotLabel = memoryLayout.formatToneSlot(i);
              const isEmpty = isToneSlotEmpty(deviceTones, i);
              const occupancy = isEmpty
                ? ' - (empty)'
                : ` - ${existingTone?.name || ''}`;
              return (
                <option key={i} value={i}>
                  {slotLabel}
                  {occupancy}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="ac-field-label mb-1">Wave Bank</label>
          <select
            value={mapping.waveBank}
            onChange={(e) =>
              onUpdate(index, { waveBank: Number(e.target.value) })
            }
            disabled={isOperating}
            className="ac-select ac-select--compact"
          >
            {bankIndices.map((bankIndex, i) => (
              <option key={bankIndex} value={bankIndex}>
                Bank {bankLabels[i]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ac-field-label mb-1">
            Segment ({mapping.segmentsNeeded} needed)
          </label>
          <select
            value={mapping.segmentTop}
            onChange={(e) =>
              onUpdate(index, { segmentTop: Number(e.target.value) })
            }
            disabled={isOperating}
            className="ac-select ac-select--compact"
          >
            {Array.from(
              { length: Math.max(1, 18 - mapping.segmentsNeeded + 1) },
              (_, i) => (
                <option key={i} value={i}>
                  {i} - {i + mapping.segmentsNeeded - 1}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
