/**
 * `<ProgramCommonPanel>` — body content for the ProgramEditor "Common"
 * tab (mockup `mockups/programs.html:112-218`).
 *
 * Per the mockup spec the Common tab carries:
 *   - toggle cluster at the top (Voice priority, Reassign, KG Crossfade
 *     — all rendered as pill-radio `<S3kParamRadioRow>` / `<S3kParamToggleRow>`)
 *   - linear / bipolar slider rows (Polyphony, Output level,
 *     Output pan, Detune, A.T sens, Vel sens, Soft pedal, Loudness)
 *   - identity-readout strip at the bottom (Program #, Keygroups —
 *     `.ac-compact-field--readout` chrome; read-only metadata)
 *
 * Extracted from `ProgramEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamRadioRow } from '@/components/ui/S3kParamRadioRow';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';

export interface ProgramCommonPanelProps {
  header: ProgramHeader;
  /** Pre-bound `(field) => (value) => onParameterChange(field, value)` adapter. */
  num: (field: string) => (value: number) => void;
  /** Pre-bound `(field) => (checked) => onParameterChange(field, 0|1)` adapter. */
  bool: (field: string) => (checked: boolean) => void;
  /** Zero-based program slot index; rendered 1-based in the read-only readout. */
  programIndex: number;
}

const PRIORITY_OPTIONS = [
  { value: 0, label: 'Low' },
  { value: 1, label: 'Normal' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Hold' },
];

const VOICE_STEALING_OPTIONS = [
  { value: 0, label: 'Oldest' },
  { value: 1, label: 'Quietest' },
];

function formatProgramSlot(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function ProgramCommonPanel({
  header,
  num,
  bool,
  programIndex,
}: ProgramCommonPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-compact-grid">
        <S3kParamRadioRow label="Voice priority" value={header.PRIORT} options={PRIORITY_OPTIONS} onChange={num('PRIORT')} />
        <S3kParamRadioRow label="Reassign" value={header.VASSOQ} options={VOICE_STEALING_OPTIONS} onChange={num('VASSOQ')} />
        <S3kParamToggleRow label="KG Crossfade" checked={header.KXFADE === 1} onChange={bool('KXFADE')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="Polyphony" value={header.POLYPH} min={0} max={31} onChange={num('POLYPH')} />
        <S3kParamRow label="Output level" value={header.PRLOUD} min={0} max={99} onChange={num('PRLOUD')} />
        <S3kParamRow label="Output pan" value={header.PANPOS} min={-50} max={50} onChange={num('PANPOS')} bipolar />
        <S3kParamRow label="Detune" value={header.PTUNO} min={-50} max={50} onChange={num('PTUNO')} bipolar />
        <S3kParamRow label="A.T sens" value={header.PRSDEP} min={0} max={99} onChange={num('PRSDEP')} />
        <S3kParamRow label="Vel sens" value={header.VELDEP} min={0} max={99} onChange={num('VELDEP')} />
        <S3kParamRow label="Soft pedal" value={header.SPLOUD} min={0} max={99} onChange={num('SPLOUD')} />
        <S3kParamRow label="Loudness" value={header.STEREO} min={0} max={99} onChange={num('STEREO')} />
      </div>

      <div className="ac-compact-grid">
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Program #</span>
          <span className="ac-field-readout">{formatProgramSlot(programIndex)}</span>
        </div>
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Keygroups</span>
          <span className="ac-field-readout">{header.GROUPS}</span>
        </div>
      </div>
    </div>
  );
}
