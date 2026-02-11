/**
 * Filter Envelope Section Component
 *
 * Edits TVF envelope parameters:
 * - Depth
 * - Velocity sensitivity
 * - Depth keyfollow
 * - Time keyfollow
 * - Envelope levels and times
 */

import type { TvfEnvelope } from '@/core/midi/types';
import { ParameterSlider, D110EnvelopeEditor } from '@/components/ui';
import { cn } from '@/lib/utils';

interface FilterEnvelopeSectionProps {
  envelope: TvfEnvelope;
  onChange: (key: keyof TvfEnvelope, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

export function FilterEnvelopeSection({
  envelope,
  onChange,
  onCommit,
  disabled = false,
}: FilterEnvelopeSectionProps): JSX.Element {
  const formatDepth = (value: number): string => {
    const offset = value - 50;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Envelope modulation parameters */}
      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Depth"
          value={envelope.depth}
          onChange={(v) => onChange('depth', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={formatDepth}
          disabled={disabled}
        />
        <ParameterSlider
          label="Velocity Sens"
          value={envelope.velocitySensitivity}
          onChange={(v) => onChange('velocitySensitivity', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={formatDepth}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Depth Key Follow"
          value={envelope.depthKeyfollow}
          onChange={(v) => onChange('depthKeyfollow', v)}
          onCommit={onCommit}
          min={0}
          max={4}
          formatValue={(v) => String(v)}
          disabled={disabled}
        />
        <ParameterSlider
          label="Time Key Follow"
          value={envelope.timeKeyfollow}
          onChange={(v) => onChange('timeKeyfollow', v)}
          onCommit={onCommit}
          min={0}
          max={4}
          formatValue={(v) => String(v)}
          disabled={disabled}
        />
      </div>

      {/* Envelope editor */}
      <D110EnvelopeEditor
        type="tvf"
        data={{
          level1: envelope.level1,
          level2: envelope.level2,
          level3: envelope.level3,
          sustainLevel: envelope.sustainLevel,
          time1: envelope.time1,
          time2: envelope.time2,
          time3: envelope.time3,
          time4: envelope.time4,
          time5: envelope.time5,
        }}
        onChange={(key, value) => onChange(key as keyof TvfEnvelope, value)}
        onCommit={onCommit}
        label="Filter Envelope"
        disabled={disabled}
      />
    </div>
  );
}
