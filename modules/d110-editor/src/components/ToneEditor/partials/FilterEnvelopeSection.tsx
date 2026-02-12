/**
 * Filter Envelope Section Component
 *
 * Edits TVF envelope parameters:
 * - Depth
 * - Velocity sensitivity
 * - Depth keyfollow
 * - Time keyfollow
 * - Envelope levels and times
 *
 * Note: The TVF envelope only applies to synthesizer waveforms.
 * PCM partials bypass the filter entirely.
 */

import type { TvfEnvelope } from '@/core/midi/types';
import { ParameterSlider, D110EnvelopeEditor } from '@/components/ui';
import { isPartialPCM, STRUCTURE_NAMES } from '@/core/midi/constants';
import { cn } from '@/lib/utils';

interface FilterEnvelopeSectionProps {
  envelope: TvfEnvelope;
  onChange: (key: keyof TvfEnvelope, value: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
  /** Structure index for partials 1-2 (0-12) */
  structure12: number;
  /** Structure index for partials 3-4 (0-12) */
  structure34: number;
  /** Which partial this is (0-3) */
  partialIndex: number;
}

export function FilterEnvelopeSection({
  envelope,
  onChange,
  onCommit,
  disabled = false,
  structure12,
  structure34,
  partialIndex,
}: FilterEnvelopeSectionProps): JSX.Element {
  // Determine if this partial is PCM based on Structure
  const structureIndex = partialIndex < 2 ? structure12 : structure34;
  const isSecondInPair = partialIndex === 1 || partialIndex === 3;
  const isPcmPartial = isPartialPCM(structureIndex, isSecondInPair);

  // Get structure name for tooltip
  const structureName = STRUCTURE_NAMES[structureIndex] ?? `Structure ${structureIndex + 1}`;

  // Filter envelope is disabled for PCM partials
  const isFilterDisabled = disabled || isPcmPartial;
  const formatDepth = (value: number): string => {
    const offset = value - 50;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', isFilterDisabled && 'opacity-50 pointer-events-none')}>
      {/* PCM Warning Banner */}
      {isPcmPartial && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-md px-3 py-2 text-xs text-amber-200">
          <span className="font-medium">Filter envelope disabled:</span>{' '}
          Structure {structureIndex + 1} ({structureName}) sets Partial {partialIndex + 1} to PCM mode.
          The TVF only applies to synthesizer waveforms.
        </div>
      )}

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
          disabled={isFilterDisabled}
        />
        <ParameterSlider
          label="Velocity Sens"
          value={envelope.velocitySensitivity}
          onChange={(v) => onChange('velocitySensitivity', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={formatDepth}
          disabled={isFilterDisabled}
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
          disabled={isFilterDisabled}
        />
        <ParameterSlider
          label="Time Key Follow"
          value={envelope.timeKeyfollow}
          onChange={(v) => onChange('timeKeyfollow', v)}
          onCommit={onCommit}
          min={0}
          max={4}
          formatValue={(v) => String(v)}
          disabled={isFilterDisabled}
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
        disabled={isFilterDisabled}
      />
    </div>
  );
}
