/**
 * Pitch Envelope Section Component
 *
 * Edits pitch envelope parameters:
 * - Depth
 * - Velocity sensitivity
 * - Time keyfollow
 * - Envelope levels and times
 */

import type { PitchEnvelope } from '@/core/midi/types';
import { ParameterSlider, D110EnvelopeEditor } from '@/components/ui';
import { cn } from '@/lib/utils';

interface PitchEnvelopeSectionProps {
  envelope: PitchEnvelope;
  onChange: (key: keyof PitchEnvelope, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

export function PitchEnvelopeSection({
  envelope,
  onChange,
  onCommit,
  disabled = false,
}: PitchEnvelopeSectionProps): JSX.Element {
  const formatDepth = (value: number): string => {
    const offset = value - 50;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Envelope modulation parameters */}
      <div className="grid grid-cols-3 gap-4">
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
        type="pitch"
        data={{
          level0: envelope.level0,
          level1: envelope.level1,
          level2: envelope.level2,
          sustainLevel: envelope.sustainLevel,
          endLevel: envelope.endLevel,
          time1: envelope.time1,
          time2: envelope.time2,
          time3: envelope.time3,
          time4: envelope.time4,
        }}
        onChange={(key, value) => onChange(key as keyof PitchEnvelope, value)}
        onCommit={onCommit}
        label="Pitch Envelope"
        disabled={disabled}
      />
    </div>
  );
}
