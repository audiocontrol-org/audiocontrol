/**
 * Amp Envelope Section Component
 *
 * Edits TVA envelope parameters:
 * - Time keyfollow
 * - T1 velocity sensitivity
 * - Envelope levels and times
 */

import type { TvaEnvelope } from '@/core/midi/types';
import { ParameterSlider, D110EnvelopeEditor } from '@/components/ui';
import { cn } from '@/lib/utils';

interface AmpEnvelopeSectionProps {
  envelope: TvaEnvelope;
  onChange: (key: keyof TvaEnvelope, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

export function AmpEnvelopeSection({
  envelope,
  onChange,
  onCommit,
  disabled = false,
}: AmpEnvelopeSectionProps): JSX.Element {
  const formatVelocity = (value: number): string => {
    const offset = value - 50;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Envelope modulation parameters */}
      <div className="grid grid-cols-2 gap-4">
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
        <ParameterSlider
          label="T1 Velocity"
          value={envelope.time1Velocity}
          onChange={(v) => onChange('time1Velocity', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={formatVelocity}
          disabled={disabled}
        />
      </div>

      {/* Envelope editor */}
      <D110EnvelopeEditor
        type="tva"
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
        onChange={(key, value) => onChange(key as keyof TvaEnvelope, value)}
        onCommit={onCommit}
        label="Amp Envelope"
        disabled={disabled}
      />
    </div>
  );
}
