/**
 * Pitch Section Component
 *
 * Edits pitch parameters for a partial:
 * - Waveform selection (Square/Sawtooth/PCM)
 * - PCM wave number
 * - Pitch coarse (semitones)
 * - Pitch fine (cents)
 * - Pitch keyfollow
 * - Pitch bender switch
 * - Pulse width (for square wave)
 * - Pulse width velocity
 */

import { useCallback } from 'react';
import type { PartialParams } from '@/core/midi/types';
import { ParameterSlider, formatKeyfollow } from '@/components/ui';
import { getPcmWaveName, PARAM_RANGES } from '@/core/midi/constants';
import { cn } from '@/lib/utils';

interface PitchSectionProps {
  params: PartialParams;
  onChange: (key: keyof PartialParams, value: number | boolean) => void;
  onCommit?: () => void;
  disabled?: boolean;
}

// Waveform parameter encoding (per D-110 MIDI Implementation, offset 00 04):
// WG WAVEFORM/PCM BANK: 0-3
//   0 = Square
//   1 = Sawtooth
//   2 = PCM Bank A (Bank 1)
//   3 = PCM Bank B (Bank 2)
const WAVEFORM_SQUARE = 0;
const WAVEFORM_SAWTOOTH = 1;
const WAVEFORM_PCM_BANK_A = 2;
const WAVEFORM_PCM_BANK_B = 3;

export function PitchSection({
  params,
  onChange,
  onCommit,
  disabled = false,
}: PitchSectionProps): JSX.Element {
  // Decode waveform value (0-3)
  const isSquare = params.waveform === WAVEFORM_SQUARE;
  const isSawtooth = params.waveform === WAVEFORM_SAWTOOTH;
  const isPcm = params.waveform === WAVEFORM_PCM_BANK_A || params.waveform === WAVEFORM_PCM_BANK_B;
  const pcmBank = params.waveform === WAVEFORM_PCM_BANK_B ? 1 : 0;

  // DEBUG: Log waveform value to help diagnose bank selection issues
  console.log('[PitchSection] waveform:', params.waveform, 'isPcm:', isPcm, 'pcmBank:', pcmBank, 'pcmWaveNumber:', params.pcmWaveNumber);

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
      console.log('[PitchSection] Setting waveform to:', value, 'for type:', type);
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
      {/* Waveform Selection */}
      <div>
        <label className="label mb-2">Waveform</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleWaveformChange('square')}
            className={cn(
              'btn text-sm',
              isSquare ? 'btn-primary' : 'btn-secondary'
            )}
            disabled={disabled}
          >
            Square
          </button>
          <button
            onClick={() => handleWaveformChange('sawtooth')}
            className={cn(
              'btn text-sm',
              isSawtooth ? 'btn-primary' : 'btn-secondary'
            )}
            disabled={disabled}
          >
            Sawtooth
          </button>
          <button
            onClick={() => handleWaveformChange('pcm-a')}
            className={cn(
              'btn text-sm',
              isPcm && pcmBank === 0 ? 'btn-primary' : 'btn-secondary'
            )}
            disabled={disabled}
          >
            PCM A
          </button>
          <button
            onClick={() => handleWaveformChange('pcm-b')}
            className={cn(
              'btn text-sm',
              isPcm && pcmBank === 1 ? 'btn-primary' : 'btn-secondary'
            )}
            disabled={disabled}
          >
            PCM B
          </button>
        </div>
      </div>

      {/* PCM Wave Number (only shown for PCM) */}
      {isPcm && (
        <div>
          <label className="label mb-2">PCM Wave</label>
          <select
            value={params.pcmWaveNumber}
            onChange={(e) => {
              // Ensure waveform value matches the displayed bank when selecting a wave
              // pcmBank is derived from current waveform display (0=Bank A, 1=Bank B)
              const expectedWaveform = pcmBank === 0 ? WAVEFORM_PCM_BANK_A : WAVEFORM_PCM_BANK_B;
              if (params.waveform !== expectedWaveform) {
                onChange('waveform', expectedWaveform);
              }
              onChange('pcmWaveNumber', parseInt(e.target.value, 10));
              onCommit?.();
            }}
            className="input w-full"
            disabled={disabled}
          >
            {Array.from({ length: 128 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}: {getPcmWaveName(pcmBank, i)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pulse Width (only shown for Square) */}
      {isSquare && (
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
          <label className="label mb-2">Pitch Bender</label>
          <button
            onClick={() => {
              onChange('pitchBenderSwitch', !params.pitchBenderSwitch);
              onCommit?.();
            }}
            className={cn(
              'btn w-full',
              params.pitchBenderSwitch ? 'btn-primary' : 'btn-secondary'
            )}
            disabled={disabled}
          >
            {params.pitchBenderSwitch ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
