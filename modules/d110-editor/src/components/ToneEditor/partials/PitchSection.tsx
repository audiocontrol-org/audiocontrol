/**
 * Pitch Section Component
 *
 * Edits pitch parameters for a partial:
 * - Waveform selection (Square/Sawtooth for Synth, PCM Bank A/B for PCM)
 * - PCM wave number (when PCM mode)
 * - Pitch coarse (semitones)
 * - Pitch fine (cents)
 * - Pitch keyfollow
 * - Pitch bender switch
 * - Pulse width (for square wave)
 * - Pulse width velocity
 *
 * The waveform options shown depend on the Structure parameter:
 * - Synth partials: Square and Sawtooth enabled, PCM disabled
 * - PCM partials: PCM A and PCM B enabled, Synth disabled
 */

import { useCallback, useMemo } from 'react';
import type { PartialParams } from '@/core/midi/types';
import { ParameterSlider, formatKeyfollow } from '@/components/ui';
import { getPcmWaveName, PARAM_RANGES, isPartialPCM, STRUCTURE_NAMES } from '@/core/midi/constants';
import { cn } from '@/lib/utils';

interface PitchSectionProps {
  params: PartialParams;
  onChange: (key: keyof PartialParams, value: number | boolean) => void;
  onCommit?: () => void;
  disabled?: boolean;
  /** Structure index for partials 1-2 (0-12) */
  structure12: number;
  /** Structure index for partials 3-4 (0-12) */
  structure34: number;
  /** Which partial this is (0-3) */
  partialIndex: number;
}

// Waveform parameter encoding
// For SYNTH partials: bit 0 selects Square (0) vs Sawtooth (1)
// For PCM partials: bit 1 is high bit of PCM wave number (Bank A=0, Bank B=1)
const WAVEFORM_SQUARE = 0;
const WAVEFORM_SAWTOOTH = 1;
const WAVEFORM_PCM_BANK_A = 0;
const WAVEFORM_PCM_BANK_B = 2;

export function PitchSection({
  params,
  onChange,
  onCommit,
  disabled = false,
  structure12,
  structure34,
  partialIndex,
}: PitchSectionProps): JSX.Element {
  // Determine if this partial is PCM or Synth based on Structure
  const structureIndex = partialIndex < 2 ? structure12 : structure34;
  const isSecondInPair = partialIndex === 1 || partialIndex === 3;
  const isPcmPartial = isPartialPCM(structureIndex, isSecondInPair);
  const isSynthPartial = !isPcmPartial;

  // Get structure name for tooltips
  const structureName = STRUCTURE_NAMES[structureIndex] ?? `Structure ${structureIndex + 1}`;
  const partialPairLabel = partialIndex < 2 ? '1-2' : '3-4';

  // Decode current waveform value
  // For Synth: bit 0 determines Square/Sawtooth
  // For PCM: bit 1 determines Bank A/B
  const currentWaveformBit0 = params.waveform & 0x01;
  const currentWaveformBit1 = (params.waveform & 0x02) >> 1;

  const isSquare = isSynthPartial && currentWaveformBit0 === 0;
  const isSawtooth = isSynthPartial && currentWaveformBit0 === 1;
  const isPcmBankA = isPcmPartial && currentWaveformBit1 === 0;
  const isPcmBankB = isPcmPartial && currentWaveformBit1 === 1;
  const pcmBank = currentWaveformBit1;

  // Tooltip messages
  const tooltips = useMemo(() => {
    const synthDisabledReason = isPcmPartial
      ? `Disabled: Structure ${structureIndex + 1} (${structureName}) sets Partial ${partialIndex + 1} to PCM mode. Change Structure ${partialPairLabel} to enable synth waveforms.`
      : null;

    const pcmDisabledReason = isSynthPartial
      ? `Disabled: Structure ${structureIndex + 1} (${structureName}) sets Partial ${partialIndex + 1} to Synth mode. Change Structure ${partialPairLabel} to enable PCM waveforms.`
      : null;

    return {
      square: synthDisabledReason ?? 'Square wave - A synthesized waveform with adjustable pulse width',
      sawtooth: synthDisabledReason ?? 'Sawtooth wave - A synthesized waveform rich in harmonics',
      pcmA: pcmDisabledReason ?? 'PCM Bank A - Waves 1-128, primarily attack transients and one-shot samples',
      pcmB: pcmDisabledReason ?? 'PCM Bank B - Waves 1-128, primarily looped samples',
    };
  }, [isPcmPartial, isSynthPartial, structureIndex, structureName, partialIndex, partialPairLabel]);

  const handleWaveformChange = useCallback(
    (type: 'square' | 'sawtooth' | 'pcm-a' | 'pcm-b') => {
      let value: number;
      switch (type) {
        case 'square':
          value = WAVEFORM_SQUARE;
          break;
        case 'sawtooth':
          value = WAVEFORM_SAWTOOTH;
          break;
        case 'pcm-a':
          value = WAVEFORM_PCM_BANK_A;
          break;
        case 'pcm-b':
          value = WAVEFORM_PCM_BANK_B;
          break;
      }
      onChange('waveform', value);
      onCommit?.();
    },
    [onChange, onCommit]
  );

  const formatCoarse = (value: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(value / 12);
    const note = notes[value % 12];
    return `${note}${octave}`;
  };

  const formatFine = (value: number): string => {
    const offset = value - 50;
    if (offset === 0) return '0';
    return offset > 0 ? `+${offset}` : String(offset);
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Structure Info Banner */}
      <div className="bg-d110-surface rounded-md px-3 py-2 text-xs text-d110-muted">
        <span className="font-medium">Structure {partialPairLabel}:</span>{' '}
        <span className="text-d110-text">{structureName}</span>
        {' → '}
        <span className={isPcmPartial ? 'text-amber-400' : 'text-emerald-400'}>
          Partial {partialIndex + 1} is {isPcmPartial ? 'PCM' : 'Synth'}
        </span>
      </div>

      {/* Waveform Selection */}
      <div>
        <label className="ac-label ac-label-block mb-2">Waveform</label>
        <div className="flex flex-wrap gap-2">
          {/* Synth Waveforms */}
          <button
            onClick={() => handleWaveformChange('square')}
            className={cn(
              'ac-btn text-sm',
              isSquare ? 'ac-btn-primary' : 'ac-btn-secondary',
              isPcmPartial && 'opacity-40 cursor-not-allowed'
            )}
            disabled={disabled || isPcmPartial}
            title={tooltips.square}
          >
            Square
          </button>
          <button
            onClick={() => handleWaveformChange('sawtooth')}
            className={cn(
              'ac-btn text-sm',
              isSawtooth ? 'ac-btn-primary' : 'ac-btn-secondary',
              isPcmPartial && 'opacity-40 cursor-not-allowed'
            )}
            disabled={disabled || isPcmPartial}
            title={tooltips.sawtooth}
          >
            Sawtooth
          </button>

          {/* Separator */}
          <div className="w-px bg-d110-border self-stretch mx-1" />

          {/* PCM Banks */}
          <button
            onClick={() => handleWaveformChange('pcm-a')}
            className={cn(
              'ac-btn text-sm',
              isPcmBankA ? 'ac-btn-primary' : 'ac-btn-secondary',
              isSynthPartial && 'opacity-40 cursor-not-allowed'
            )}
            disabled={disabled || isSynthPartial}
            title={tooltips.pcmA}
          >
            PCM A
          </button>
          <button
            onClick={() => handleWaveformChange('pcm-b')}
            className={cn(
              'ac-btn text-sm',
              isPcmBankB ? 'ac-btn-primary' : 'ac-btn-secondary',
              isSynthPartial && 'opacity-40 cursor-not-allowed'
            )}
            disabled={disabled || isSynthPartial}
            title={tooltips.pcmB}
          >
            PCM B
          </button>
        </div>
      </div>

      {/* PCM Wave Number (only shown for PCM partials) */}
      {isPcmPartial && (
        <div>
          <label className="ac-label ac-label-block mb-2">PCM Wave</label>
          <select
            value={params.pcmWaveNumber}
            onChange={(e) => {
              // Ensure waveform value matches the displayed bank when selecting a wave
              const expectedWaveform = pcmBank === 0 ? WAVEFORM_PCM_BANK_A : WAVEFORM_PCM_BANK_B;
              if (params.waveform !== expectedWaveform) {
                onChange('waveform', expectedWaveform);
              }
              onChange('pcmWaveNumber', parseInt(e.target.value, 10));
              onCommit?.();
            }}
            className="ac-input w-full"
            disabled={disabled}
            title="Select a PCM sample from the current bank"
          >
            {Array.from({ length: 128 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}: {getPcmWaveName(pcmBank, i)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pulse Width (only shown for Square wave on Synth partials) */}
      {isSynthPartial && isSquare && (
        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider
            label="Pulse Width"
            value={params.pulseWidth}
            onChange={(v) => onChange('pulseWidth', v)}
            onCommit={onCommit}
            min={0}
            max={100}
            formatValue={(v) => `${v}%`}
            disabled={disabled}
          />
          <ParameterSlider
            label="PW Velocity"
            value={params.pulseWidthVelocity}
            onChange={(v) => onChange('pulseWidthVelocity', v)}
            onCommit={onCommit}
            min={0}
            max={100}
            disabled={disabled}
          />
        </div>
      )}

      {/* Pitch Controls */}
      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Pitch Coarse"
          value={params.pitchCoarse}
          onChange={(v) => onChange('pitchCoarse', v)}
          onCommit={onCommit}
          min={0}
          max={PARAM_RANGES.PITCH_COARSE.max}
          formatValue={formatCoarse}
          disabled={disabled}
        />
        <ParameterSlider
          label="Pitch Fine"
          value={params.pitchFine}
          onChange={(v) => onChange('pitchFine', v)}
          onCommit={onCommit}
          min={0}
          max={100}
          formatValue={formatFine}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ParameterSlider
          label="Key Follow"
          value={params.pitchKeyfollow}
          onChange={(v) => onChange('pitchKeyfollow', v)}
          onCommit={onCommit}
          min={0}
          max={PARAM_RANGES.KEYFOLLOW.max}
          formatValue={formatKeyfollow}
          disabled={disabled}
        />
        <div className="flex flex-col justify-end">
          <label className="ac-label ac-label-block mb-2">Pitch Bender</label>
          <button
            onClick={() => {
              onChange('pitchBenderSwitch', !params.pitchBenderSwitch);
              onCommit?.();
            }}
            className={cn(
              'ac-btn w-full',
              params.pitchBenderSwitch ? 'ac-btn-primary' : 'ac-btn-secondary'
            )}
            disabled={disabled}
            title="Enable or disable pitch bend for this partial"
          >
            {params.pitchBenderSwitch ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
