/**
 * LFO Section Component
 *
 * Edits LFO parameters for a partial:
 * - Rate
 * - Depth
 * - Modulation sensitivity
 */

import type { LfoParams } from '@/core/midi/types';
import { ParameterSlider } from '@/components/ui';
import { cn } from '@/lib/utils';

interface LfoSectionProps {
  params: LfoParams;
  onChange: (key: keyof LfoParams, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

export function LfoSection({
  params,
  onChange,
  onCommit,
  disabled = false,
}: LfoSectionProps): JSX.Element {
  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      <div className="grid grid-cols-3 gap-4">
        <ParameterSlider
          label="Rate"
          value={params.rate}
          onChange={(v) => onChange('rate', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={(v) => `${v}`}
          disabled={disabled}
        />
        <ParameterSlider
          label="Depth"
          value={params.depth}
          onChange={(v) => onChange('depth', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={(v) => `${v}`}
          disabled={disabled}
        />
        <ParameterSlider
          label="Mod Sensitivity"
          value={params.modulationSensitivity}
          onChange={(v) => onChange('modulationSensitivity', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={(v) => `${v}`}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
