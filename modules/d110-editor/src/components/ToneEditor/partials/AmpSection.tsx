/**
 * Amp Section Component
 *
 * Edits TVA (Time Variant Amplifier) parameters:
 * - Level
 * - Velocity sensitivity
 * - Bias point 1 and level
 * - Bias point 2 and level
 */

import type { PartialParams } from '@/core/midi/types';
import { ParameterSlider, formatPitch } from '@/components/ui';
import { cn } from '@/lib/utils';

interface AmpSectionProps {
  params: PartialParams;
  onChange: (key: keyof PartialParams, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

export function AmpSection({
  params,
  onChange,
  onCommit,
  disabled = false,
}: AmpSectionProps): JSX.Element {
  const formatBiasLevel = (value: number): string => {
    const offset = value - 12;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  const formatVelocity = (value: number): string => {
    const offset = value - 50;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Main amp controls */}
      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Level"
          value={params.tvaLevel}
          onChange={(v) => onChange('tvaLevel', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={(v) => `${v}`}
          disabled={disabled}
        />
        <ParameterSlider
          label="Velocity Sens"
          value={params.tvaVelocitySensitivity}
          onChange={(v) => onChange('tvaVelocitySensitivity', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={formatVelocity}
          disabled={disabled}
        />
      </div>

      {/* Bias 1 controls */}
      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Bias Point 1"
          value={params.tvaBiasPoint1}
          onChange={(v) => onChange('tvaBiasPoint1', v)}
          onCommit={onCommit}
          min={0}
          max={127}
          formatValue={formatPitch}
          disabled={disabled}
        />
        <ParameterSlider
          label="Bias Level 1"
          value={params.tvaBiasLevel1}
          onChange={(v) => onChange('tvaBiasLevel1', v)}
          onCommit={onCommit}
          min={0}
          max={24}
          formatValue={formatBiasLevel}
          disabled={disabled}
        />
      </div>

      {/* Bias 2 controls */}
      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Bias Point 2"
          value={params.tvaBiasPoint2}
          onChange={(v) => onChange('tvaBiasPoint2', v)}
          onCommit={onCommit}
          min={0}
          max={127}
          formatValue={formatPitch}
          disabled={disabled}
        />
        <ParameterSlider
          label="Bias Level 2"
          value={params.tvaBiasLevel2}
          onChange={(v) => onChange('tvaBiasLevel2', v)}
          onCommit={onCommit}
          min={0}
          max={24}
          formatValue={formatBiasLevel}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
