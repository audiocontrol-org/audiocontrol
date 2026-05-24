/**
 * Import Library Tone Dialog — idle form body.
 *
 * Extracted sibling of {@link ImportLibraryToneDialog} so the host
 * dialog stays under the 500-line cap. The host owns chrome
 * (SlideDrawer) + lifecycle (useExportDialogLifecycle); this file
 * owns the idle form's JSX + control rendering.
 *
 * Why a sibling file rather than inline closures: the form has 12+
 * inputs and pulls in MemoryMapPanel + BestFitPicker. Keeping it
 * inline pushed the host file past the 500-LOC ceiling that
 * `.claude/CLAUDE.md` enforces.
 */

import { cn } from '@/lib/utils';
import type { SamplerTone } from '@/core/midi/SamplerClient';
import { isToneSlotEmpty } from '@/lib/slot-allocation';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import { BestFitPicker } from '@/components/ui/BestFitPicker';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import type { FitOption, ToneFitValues } from '@/lib/best-fit';
import { useDeviceConfig } from '@/context/DeviceConfigContext';

export interface ToneImportFormBodyProps {
  tone: SamplerTone | null;
  toneFile: string;
  setName: string;
  segmentsNeeded: number;
  targetSlot: number;
  setTargetSlot: (slot: number) => void;
  waveBank: number;
  setWaveBank: (bank: number) => void;
  segmentTop: number;
  setSegmentTop: (seg: number) => void;
  selectedTargetIndex: number;
  setSelectedTargetIndex: (idx: number) => void;
  targetGroup: ReturnType<
    typeof useDeviceConfig
  >['memoryLayout']['toneGroups'][number];
  memoryLayout: ReturnType<typeof useDeviceConfig>['memoryLayout'];
  deviceTones: (SamplerTone | undefined)[];
  willOverwriteTone: boolean;
  existingToneName: string | undefined;
  isOperating: boolean;
  proposal: AllocationProposal;
  onFindBestFit: () => void;
  showBestFits: boolean;
  setShowBestFits: (show: boolean) => void;
  fitOptions: FitOption<ToneFitValues>[];
  selectedFitIndex: number | null;
  onSelectFit: (index: number) => void;
  error: string | null;
}

export function ToneImportFormBody({
  tone,
  toneFile,
  setName,
  segmentsNeeded,
  targetSlot,
  setTargetSlot,
  waveBank,
  setWaveBank,
  segmentTop,
  setSegmentTop,
  selectedTargetIndex,
  setSelectedTargetIndex,
  targetGroup,
  memoryLayout,
  deviceTones,
  willOverwriteTone,
  existingToneName,
  isOperating,
  proposal,
  onFindBestFit,
  showBestFits,
  setShowBestFits,
  fitOptions,
  selectedFitIndex,
  onSelectFit,
  error,
}: ToneImportFormBodyProps): JSX.Element {
  const { importTargets } = memoryLayout;
  return (
    <div className="ac-export-form">
      <p className="text-sm text-s330-muted">
        Import "{toneFile}"{' '}
        {setName === '__individual__' ? 'from library' : `from ${setName}`} to
        device.
      </p>

      {tone && (
        <div className="bg-s330-bg rounded p-3 text-sm">
          <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">
            Tone Info
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-s330-muted">Name:</span>
              <span className="ml-2 text-s330-text">{tone.name}</span>
            </div>
            <div>
              <span className="text-s330-muted">Sample Rate:</span>
              <span className="ml-2 text-s330-text">{tone.sampleRate}</span>
            </div>
            <div>
              <span className="text-s330-muted">Loop Mode:</span>
              <span className="ml-2 text-s330-text capitalize">
                {tone.loopMode}
              </span>
            </div>
            <div>
              <span className="text-s330-muted">Segments:</span>
              <span className="ml-2 text-s330-text">{segmentsNeeded}</span>
            </div>
          </div>
        </div>
      )}

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
          onChange={(e) => {
            const idx = Number(e.target.value);
            setSelectedTargetIndex(idx);
            const newGroup =
              memoryLayout.toneGroups.find(
                (g) => g.firstIndex === importTargets[idx].toneIndexOffset,
              ) ?? memoryLayout.toneGroups[0];
            setTargetSlot(newGroup.firstIndex);
            setWaveBank(newGroup.waveBankIndices[0]);
          }}
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
        <label htmlFor="targetSlot" className="ac-field-label mb-1">
          Target Tone Slot
        </label>
        <select
          id="targetSlot"
          value={targetSlot}
          onChange={(e) => setTargetSlot(Number(e.target.value))}
          disabled={isOperating}
          data-testid="target-slot-select"
          className={cn(
            'ac-select',
            willOverwriteTone && 'ac-input--warning',
          )}
        >
          {Array.from({ length: targetGroup.count }, (_, i) => {
            const absIndex = targetGroup.firstIndex + i;
            const existingTone = deviceTones[absIndex];
            const slotLabel = memoryLayout.formatToneSlot(absIndex);
            const isEmpty = isToneSlotEmpty(deviceTones, absIndex);
            const occupancy = isEmpty
              ? ' - (empty)'
              : ` - ${existingTone?.name || ''}`;
            return (
              <option
                key={absIndex}
                value={absIndex}
                data-occupied={!isEmpty || undefined}
              >
                {slotLabel}
                {occupancy}
              </option>
            );
          })}
        </select>
        {willOverwriteTone && (
          <p
            className="text-xs text-yellow-400 mt-1"
            data-testid="slot-occupied-warning"
          >
            Will overwrite "{existingToneName}"
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
            {targetGroup.waveBankIndices.map((idx, i) => (
              <option key={idx} value={idx}>
                Bank {targetGroup.waveBankLabels[i]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="segmentTop" className="ac-field-label mb-1">
            Segment (needs {segmentsNeeded})
          </label>
          <select
            id="segmentTop"
            value={segmentTop}
            onChange={(e) => setSegmentTop(Number(e.target.value))}
            disabled={isOperating}
            className="ac-select"
          >
            {Array.from(
              { length: Math.max(1, 18 - segmentsNeeded + 1) },
              (_, i) => (
                <option key={i} value={i}>
                  {i} - {i + segmentsNeeded - 1}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      <p className="text-xs text-s330-muted -mt-2">
        Warning: This will overwrite existing wave data in the target
        segment(s).
      </p>

      {error && (
        <p className="ac-export-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
