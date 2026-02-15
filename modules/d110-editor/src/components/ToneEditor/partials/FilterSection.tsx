/**
 * Filter Section Component
 *
 * Edits TVF (Time Variant Filter) parameters:
 * - Cutoff frequency
 * - Resonance
 * - Key follow
 * - Bias point and level
 *
 * Note: The TVF only applies to synthesizer waveforms (Square/Sawtooth).
 * PCM partials bypass the filter entirely.
 */

import type { PartialParams } from '@/core/midi/types';
import { ParameterSlider, formatKeyfollow, formatPitch } from '@/components/ui';
import { PARAM_RANGES, isPartialPCM, STRUCTURE_NAMES } from '@/core/midi/constants';
import { cn } from '@/lib/utils';

interface FilterSectionProps {
  params: PartialParams;
  onChange: (key: keyof PartialParams, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
  /** Structure index for partials 1-2 (0-12) */
  structure12: number;
  /** Structure index for partials 3-4 (0-12) */
  structure34: number;
  /** Which partial this is (0-3) */
  partialIndex: number;
}

export function FilterSection({
  params,
  onChange,
  onCommit,
  disabled = false,
  structure12,
  structure34,
  partialIndex,
}: FilterSectionProps): JSX.Element {
  // Determine if this partial is PCM based on Structure
  const structureIndex = partialIndex < 2 ? structure12 : structure34;
  const isSecondInPair = partialIndex === 1 || partialIndex === 3;
  const isPcmPartial = isPartialPCM(structureIndex, isSecondInPair);

  // Get structure name for tooltip
  const structureName = STRUCTURE_NAMES[structureIndex] ?? `Structure ${structureIndex + 1}`;

  // Filter is disabled for PCM partials
  const isFilterDisabled = disabled || isPcmPartial;
  const formatBiasLevel = (value: number): string => {
    const offset = value - 7;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', isFilterDisabled && 'opacity-50 pointer-events-none')}>
      {/* PCM Warning Banner */}
      {isPcmPartial && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-md px-3 py-2 text-xs text-amber-200">
          <span className="font-medium">Filter disabled:</span>{' '}
          Structure {structureIndex + 1} ({structureName}) sets Partial {partialIndex + 1} to PCM mode.
          The TVF only applies to synthesizer waveforms.
        </div>
      )}

      {/* Main filter controls */}
      <div className="grid grid-cols-3 gap-4">
        <ParameterSlider
          label="Cutoff"
          value={params.tvfCutoff}
          onChange={(v) => onChange('tvfCutoff', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={(v) => `${v}`}
          disabled={isFilterDisabled}
        />
        <ParameterSlider
          label="Resonance"
          value={params.tvfResonance}
          onChange={(v) => onChange('tvfResonance', v)}
          onCommit={onCommit}
          min={0}
          max={PARAM_RANGES.RESONANCE.max}
          formatValue={(v) => `${v}`}
          disabled={isFilterDisabled}
        />
        <ParameterSlider
          label="Key Follow"
          value={params.tvfKeyfollow}
          onChange={(v) => onChange('tvfKeyfollow', v)}
          onCommit={onCommit}
          min={0}
          max={PARAM_RANGES.KEYFOLLOW.max}
          formatValue={formatKeyfollow}
          disabled={isFilterDisabled}
        />
      </div>

      {/* Bias controls */}
      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Bias Point"
          value={params.tvfBiasPoint}
          onChange={(v) => onChange('tvfBiasPoint', v)}
          onCommit={onCommit}
          min={0}
          max={127}
          formatValue={formatPitch}
          disabled={isFilterDisabled}
        />
        <ParameterSlider
          label="Bias Level"
          value={params.tvfBiasLevel}
          onChange={(v) => onChange('tvfBiasLevel', v)}
          onCommit={onCommit}
          min={0}
          max={14}
          formatValue={formatBiasLevel}
          disabled={isFilterDisabled}
        />
      </div>
    </div>
  );
}
