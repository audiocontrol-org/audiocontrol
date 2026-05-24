/**
 * Import Samples Dialog — idle form body.
 *
 * Extracted sibling of {@link ImportSamplesDialog} so the host
 * dialog stays under the 500-line cap. The host owns chrome
 * (SlideDrawer) + lifecycle (useExportDialogLifecycle); this file
 * owns the idle form's JSX (bundle summary, memory map, target,
 * starting slot, wave bank, segment, patch toggle, monolithic mode,
 * allocation preview).
 */

import { cn } from '@/lib/utils';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { SampleImportBundle } from '@/hooks/useImportSamples';
import { midiNoteToName } from '@audiocontrol/sampler-library/browser';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import { BestFitPicker } from '@/components/ui/BestFitPicker';
import { AcCheckbox } from '@audiocontrol/editor-core';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import type { FitOption, ContiguousFitValues } from '@/lib/best-fit';
import {
  isPatchSlotEmpty,
  hasOccupiedToneRange,
  hasOccupiedPatchRange,
} from '@/lib/slot-allocation';

export interface SamplesImportFormBodyProps {
  bundle: SampleImportBundle;
  deviceTones: (SamplerTone | undefined)[];
  devicePatches: (SamplerPatch | undefined)[];
  memoryLayout: ReturnType<typeof useDeviceConfig>['memoryLayout'];
  totalSamples: number;
  totalPatches: number;
  importTargets: ReturnType<
    typeof useDeviceConfig
  >['memoryLayout']['importTargets'];
  selectedTargetIndex: number;
  onTargetChange: (idx: number) => void;
  targetGroup: ReturnType<
    typeof useDeviceConfig
  >['memoryLayout']['toneGroups'][number];
  startingToneSlot: number;
  setStartingToneSlot: (slot: number) => void;
  absoluteToneSlot: number;
  toneSlotsNeeded: number;
  hasEnoughToneSlots: boolean;
  waveBank: number;
  setWaveBank: (bank: number) => void;
  startingSegment: number;
  setStartingSegment: (seg: number) => void;
  estimatedSegments: number;
  targetPatchSlot: number;
  setTargetPatchSlot: (slot: number) => void;
  hasEnoughPatchSlots: boolean;
  singlePatch: boolean;
  setSinglePatch: (s: boolean) => void;
  useMonolithicMode: boolean;
  setUseMonolithicMode: (b: boolean) => void;
  hasSource: boolean;
  isOperating: boolean;
  proposal: AllocationProposal;
  onFindBestFit: () => void;
  showBestFits: boolean;
  setShowBestFits: (show: boolean) => void;
  fitOptions: FitOption<ContiguousFitValues>[];
  selectedFitIndex: number | null;
  onSelectFit: (index: number) => void;
  error: string | null;
}

export function SamplesImportFormBody({
  bundle,
  deviceTones,
  devicePatches,
  memoryLayout,
  totalSamples,
  totalPatches,
  importTargets,
  selectedTargetIndex,
  onTargetChange,
  targetGroup,
  startingToneSlot,
  setStartingToneSlot,
  absoluteToneSlot,
  toneSlotsNeeded,
  hasEnoughToneSlots,
  waveBank,
  setWaveBank,
  startingSegment,
  setStartingSegment,
  estimatedSegments,
  targetPatchSlot,
  setTargetPatchSlot,
  hasEnoughPatchSlots,
  singlePatch,
  setSinglePatch,
  useMonolithicMode,
  setUseMonolithicMode,
  hasSource,
  isOperating,
  proposal,
  onFindBestFit,
  showBestFits,
  setShowBestFits,
  fitOptions,
  selectedFitIndex,
  onSelectFit,
  error,
}: SamplesImportFormBodyProps): JSX.Element {
  const groupToneCount = targetGroup.count;
  const maxStartingTone = Math.max(0, groupToneCount - toneSlotsNeeded);
  const maxStartingPatch = Math.max(
    0,
    totalPatches - (singlePatch ? 1 : totalSamples),
  );

  const availableBanks = {
    labels: targetGroup.waveBankLabels,
    indices: targetGroup.waveBankIndices,
  };
  const selectedBankLabel = (() => {
    const labelIdx = availableBanks.indices.indexOf(waveBank);
    return labelIdx >= 0 ? availableBanks.labels[labelIdx] : String(waveBank);
  })();

  const firstNote = bundle.slices[0]?.midiNote;
  const lastNote = bundle.slices[bundle.slices.length - 1]?.midiNote;

  const summaryDescription = bundle.kitCount
    ? `"${bundle.name}" (${bundle.kitCount} kit${bundle.kitCount !== 1 ? 's' : ''}, ${totalSamples} samples)`
    : `"${bundle.name}" (${totalSamples} slice${totalSamples !== 1 ? 's' : ''})`;

  return (
    <div className="ac-export-form">
      <p className="text-sm text-s330-muted">Import {summaryDescription}</p>

      <div className="bg-s330-bg rounded p-3 text-sm">
        <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">
          Summary
        </div>
        <div className="grid grid-cols-2 gap-2">
          {bundle.kitCount !== undefined && (
            <div>
              <span className="text-s330-muted">Kits:</span>
              <span className="ml-2 text-s330-text">{bundle.kitCount}</span>
            </div>
          )}
          <div>
            <span className="text-s330-muted">
              {bundle.kitCount ? 'Samples' : 'Slices'}:
            </span>
            <span className="ml-2 text-s330-text">{totalSamples}</span>
          </div>
          <div>
            <span className="text-s330-muted">Sample Rate:</span>
            <span className="ml-2 text-s330-text">
              {bundle.sampleRate / 1000}kHz
            </span>
          </div>
          {firstNote !== undefined && lastNote !== undefined && (
            <div>
              <span className="text-s330-muted">MIDI Range:</span>
              <span className="ml-2 text-s330-text">
                {midiNoteToName(firstNote)} - {midiNoteToName(lastNote)}
              </span>
            </div>
          )}
        </div>
      </div>

      <MemoryMapPanel
        deviceTones={deviceTones}
        toneGroups={memoryLayout.toneGroups}
        formatToneSlot={memoryLayout.formatToneSlot}
        proposal={proposal}
        onFindBestFit={onFindBestFit}
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
        <label htmlFor="importTarget" className="ac-field-label mb-1">
          Target
        </label>
        <select
          id="importTarget"
          value={selectedTargetIndex}
          onChange={(e) => onTargetChange(Number(e.target.value))}
          disabled={isOperating}
          className="ac-select"
        >
          {importTargets.map((target, i) => (
            <option key={i} value={i}>
              {target.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="startingToneSlot" className="ac-field-label mb-1">
          Starting Tone Slot (needs {toneSlotsNeeded} consecutive slot
          {toneSlotsNeeded !== 1 ? 's' : ''})
          {useMonolithicMode && (
            <span className="text-yellow-500 ml-1">(+1 for wave holder)</span>
          )}
        </label>
        <select
          id="startingToneSlot"
          value={startingToneSlot}
          onChange={(e) => setStartingToneSlot(Number(e.target.value))}
          disabled={isOperating}
          className="ac-select"
        >
          {Array.from({ length: maxStartingTone + 1 }, (_, i) => {
            const absStart = i + importTargets[selectedTargetIndex].toneIndexOffset;
            const absEnd = absStart + toneSlotsNeeded - 1;
            const hasOccupied = hasOccupiedToneRange(
              deviceTones,
              absStart,
              toneSlotsNeeded,
            );
            return (
              <option key={i} value={i}>
                {memoryLayout.formatToneSlot(absStart)} -{' '}
                {memoryLayout.formatToneSlot(absEnd)}
                {hasOccupied ? ' (will overwrite)' : ' (empty)'}
              </option>
            );
          })}
        </select>
        {!hasEnoughToneSlots && (
          <p className="text-xs text-red-400 mt-1">
            Not enough consecutive tone slots available
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="waveBank" className="ac-field-label mb-1">
            Wave Bank
          </label>
          <select
            id="waveBank"
            value={waveBank}
            onChange={(e) => setWaveBank(Number(e.target.value))}
            disabled={isOperating}
            className="ac-select"
          >
            {availableBanks.indices.map((idx, i) => (
              <option key={idx} value={idx}>
                Bank {availableBanks.labels[i]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="startingSegment" className="ac-field-label mb-1">
            Starting Segment
          </label>
          <select
            id="startingSegment"
            value={startingSegment}
            onChange={(e) => setStartingSegment(Number(e.target.value))}
            disabled={isOperating}
            className="ac-select"
          >
            {Array.from({ length: 18 }, (_, i) => (
              <option key={i} value={i}>
                Segment {i}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-s330-muted -mt-2">
        Each sample uses 1+ segments based on length. Total segments: ~
        {estimatedSegments}
      </p>
      {startingSegment + estimatedSegments > 18 && (
        <p className="text-xs text-yellow-500">
          Warning: May not have enough segments. Actual usage depends on
          sample lengths.
        </p>
      )}

      <AcCheckbox
        checked={singlePatch}
        onChange={setSinglePatch}
        disabled={isOperating}
        id="singlePatch"
      >
        Create single patch with all samples mapped
      </AcCheckbox>

      {hasSource && (
        <div className="border border-s330-accent/30 rounded p-3 bg-s330-bg/50">
          <AcCheckbox
            checked={useMonolithicMode}
            onChange={setUseMonolithicMode}
            disabled={isOperating}
            id="monolithicMode"
          >
            Use monolithic mode with sub-tones
            <span className="ml-2 text-xs text-s330-muted">(recommended)</span>
          </AcCheckbox>
          {useMonolithicMode && (
            <p className="text-xs text-s330-muted mt-2">
              Uploads all slices as one contiguous wave segment. Creates a
              "holder" primary tone that owns the wave data (not mapped to any
              MIDI note), then all {totalSamples} slices become sub-tones with
              their own start/end points. Uses {toneSlotsNeeded} tone slots
              total.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="targetPatchSlot" className="ac-field-label mb-1">
          {singlePatch
            ? 'Patch Slot'
            : `Starting Patch Slot (needs ${totalSamples} consecutive slots)`}
        </label>
        <select
          id="targetPatchSlot"
          value={targetPatchSlot}
          onChange={(e) => setTargetPatchSlot(Number(e.target.value))}
          disabled={isOperating}
          className="ac-select"
        >
          {singlePatch
            ? Array.from({ length: totalPatches }, (_, i) => {
                const hasOccupied = !isPatchSlotEmpty(devicePatches, i);
                return (
                  <option key={i} value={i}>
                    {memoryLayout.formatPatchSlot(i)}
                    {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                  </option>
                );
              })
            : Array.from({ length: maxStartingPatch + 1 }, (_, i) => {
                const endSlot = i + totalSamples - 1;
                const hasOccupied = hasOccupiedPatchRange(
                  devicePatches,
                  i,
                  totalSamples,
                );
                return (
                  <option key={i} value={i}>
                    {memoryLayout.formatPatchSlot(i)} -{' '}
                    {memoryLayout.formatPatchSlot(endSlot)}
                    {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                  </option>
                );
              })}
        </select>
        {!hasEnoughPatchSlots && (
          <p className="text-xs text-red-400 mt-1">
            Not enough consecutive patch slots available
          </p>
        )}
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm">
        <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">
          Allocation Preview
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-s330-muted">Tones:</span>
            <span className="text-s330-text">
              {memoryLayout.formatToneSlot(absoluteToneSlot)} -{' '}
              {memoryLayout.formatToneSlot(absoluteToneSlot + toneSlotsNeeded - 1)}
              {useMonolithicMode && (
                <span className="text-yellow-500 ml-1">(+1 holder)</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-s330-muted">Wave Memory:</span>
            <span className="text-s330-text">
              Bank {selectedBankLabel}, Segment {startingSegment}+
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-s330-muted">
              Patch{singlePatch ? '' : 'es'}:
            </span>
            <span className="text-s330-text">
              {singlePatch
                ? memoryLayout.formatPatchSlot(targetPatchSlot)
                : `${memoryLayout.formatPatchSlot(targetPatchSlot)} - ${memoryLayout.formatPatchSlot(targetPatchSlot + totalSamples - 1)}`}
            </span>
          </div>
        </div>
        <div className="text-xs text-s330-muted mt-2">
          {singlePatch
            ? `Single patch with all ${totalSamples} samples mapped to MIDI notes.`
            : 'One patch per sample, each mapping one MIDI note to one tone.'}
        </div>
      </div>

      {error && (
        <p
          className={cn('ac-export-form-error')}
          role="alert"
          data-testid="import-samples-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
