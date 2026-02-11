/**
 * Filter Section Component
 *
 * Edits TVF (Time Variant Filter) parameters:
 * - Cutoff frequency
 * - Resonance
 * - Key follow
 * - Bias point and level
 */

import type { PartialParams } from '@/core/midi/types';
import { ParameterSlider, formatKeyfollow, formatPitch } from '@/components/ui';
import { PARAM_RANGES } from '@/core/midi/constants';
import { cn } from '@/lib/utils';

interface FilterSectionProps {
  params: PartialParams;
  onChange: (key: keyof PartialParams, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

export function FilterSection({
  params,
  onChange,
  onCommit,
  disabled = false,
}: FilterSectionProps): JSX.Element {
  const formatBiasLevel = (value: number): string => {
    const offset = value - 7;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
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
          disabled={disabled}
        />
        <ParameterSlider
          label="Resonance"
          value={params.tvfResonance}
          onChange={(v) => onChange('tvfResonance', v)}
          onCommit={onCommit}
          min={0}
          max={PARAM_RANGES.RESONANCE.max}
          formatValue={(v) => `${v}`}
          disabled={disabled}
        />
        <ParameterSlider
          label="Key Follow"
          value={params.tvfKeyfollow}
          onChange={(v) => onChange('tvfKeyfollow', v)}
          onCommit={onCommit}
          min={0}
          max={PARAM_RANGES.KEYFOLLOW.max}
          formatValue={formatKeyfollow}
          disabled={disabled}
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
          disabled={disabled}
        />
        <ParameterSlider
          label="Bias Level"
          value={params.tvfBiasLevel}
          onChange={(v) => onChange('tvfBiasLevel', v)}
          onCommit={onCommit}
          min={0}
          max={14}
          formatValue={formatBiasLevel}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
