import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcNumberInput } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';
import { Section } from '@/components/ui/Section';

interface ProgramEditorProps {
  header: ProgramHeader;
  programIndex: number;
  onParameterChange: (field: string, value: number | string) => void;
  children?: React.ReactNode;
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

const LFO_WAVEFORM_OPTIONS = [
  { value: 0, label: 'Triangle' },
  { value: 1, label: 'Sawtooth' },
  { value: 2, label: 'Square' },
];

const BEND_MODE_OPTIONS = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Held' },
];

const PORTAMENTO_TYPE_OPTIONS = [
  { value: 0, label: 'Rate' },
  { value: 1, label: 'Time' },
];

export function ProgramEditor({
  header,
  onParameterChange,
  children,
}: ProgramEditorProps): JSX.Element {
  const num = (field: string) => (value: number) => onParameterChange(field, value);
  const bool = (field: string) => (checked: boolean) => onParameterChange(field, checked ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Name as an editable field at the top, not inside a section */}
      <div className="flex items-center gap-3 px-1">
        <input
          type="text"
          value={header.PRNAME}
          maxLength={12}
          onChange={(e) => onParameterChange('PRNAME', e.target.value)}
          className="flex-1 bg-transparent border-b border-gray-600 focus:border-amber-500 px-1 py-1 text-lg text-gray-100 font-mono uppercase outline-none transition-colors"
        />
      </div>

      {children}

      {/* Two-column layout for related sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="MIDI">
          <S3kParamRow label="Program #" value={header.PRGNUM} min={0} max={128} onChange={num('PRGNUM')} />
          <S3kParamRow label="Channel" value={header.PMCHAN} min={0} max={255} onChange={num('PMCHAN')} />
          <S3kParamRow label="Polyphony" value={header.POLYPH} min={0} max={31} onChange={num('POLYPH')} />
          <S3kParamSelectRow label="Priority" value={header.PRIORT} options={PRIORITY_OPTIONS} onChange={num('PRIORT')} />
          <S3kParamSelectRow label="Stealing" value={header.VASSOQ} options={VOICE_STEALING_OPTIONS} onChange={num('VASSOQ')} />
        </Section>

        <Section title="Output">
          <S3kParamRow label="Level" value={header.PRLOUD} min={0} max={99} onChange={num('PRLOUD')} />
          <S3kParamRow label="Pan" value={header.PANPOS} min={-50} max={50} onChange={num('PANPOS')} bipolar />
          <S3kParamRow label="Stereo" value={header.STEREO} min={0} max={99} onChange={num('STEREO')} />
          <S3kParamRow label="Routing" value={header.OUTPUT} min={0} max={99} onChange={num('OUTPUT')} />
          <S3kParamRow label="Vel→Amp" value={header.V_LOUD} min={-50} max={50} onChange={num('V_LOUD')} bipolar />
          <S3kParamRow label="FX Bus" value={header.PFXCHAN} min={0} max={4} onChange={num('PFXCHAN')} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Pitch">
          <S3kParamRow label="Tune" value={header.PTUNO} min={-50} max={50} onChange={num('PTUNO')} bipolar />
          <S3kParamRow label="Transpose" value={header.TRANSPOSE} min={-50} max={50} onChange={num('TRANSPOSE')} bipolar />
          <S3kParamRow label="Bend ↑" value={header.B_PTCH} min={0} max={99} onChange={num('B_PTCH')} />
          <S3kParamRow label="Bend ↓" value={header.B_PTCHD} min={0} max={99} onChange={num('B_PTCHD')} />
          <S3kParamRow label="Press→Pitch" value={header.P_PTCH} min={-50} max={50} onChange={num('P_PTCH')} bipolar />
          <S3kParamSelectRow label="Bend Mode" value={header.B_MODE} options={BEND_MODE_OPTIONS} onChange={num('B_MODE')} />
        </Section>

        <Section title="Portamento">
          <S3kParamToggleRow label="Enable" checked={header.PORTEN === 1} onChange={bool('PORTEN')} />
          <S3kParamRow label="Time" value={header.PORTIME} min={0} max={99} onChange={num('PORTIME')} />
          <S3kParamSelectRow label="Type" value={header.PORTYPE} options={PORTAMENTO_TYPE_OPTIONS} onChange={num('PORTYPE')} />
          <S3kParamToggleRow label="Legato" checked={header.LEGATO === 1} onChange={bool('LEGATO')} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="LFO 1">
          <S3kParamRow label="Rate" value={header.LFORAT} min={0} max={99} onChange={num('LFORAT')} />
          <S3kParamRow label="Depth" value={header.LFODEP} min={0} max={99} onChange={num('LFODEP')} />
          <S3kParamRow label="Delay" value={header.LFODEL} min={0} max={99} onChange={num('LFODEL')} />
          <S3kParamSelectRow label="Wave" value={header.LFO1WAVE} options={LFO_WAVEFORM_OPTIONS} onChange={num('LFO1WAVE')} />
          <S3kParamToggleRow label="Desync" checked={header.DESYNC === 1} onChange={bool('DESYNC')} />
          <S3kParamRow label="Mod Wheel" value={header.MWLDEP} min={0} max={99} onChange={num('MWLDEP')} />
          <S3kParamRow label="Aftertouch" value={header.PRSDEP} min={0} max={99} onChange={num('PRSDEP')} />
          <S3kParamRow label="Velocity" value={header.VELDEP} min={0} max={99} onChange={num('VELDEP')} />
        </Section>

        <Section title="LFO 2 — Pan">
          <S3kParamRow label="Rate" value={header.PANRAT} min={0} max={99} onChange={num('PANRAT')} />
          <S3kParamRow label="Depth" value={header.PANDEP} min={0} max={99} onChange={num('PANDEP')} />
          <S3kParamRow label="Delay" value={header.PANDEL} min={0} max={99} onChange={num('PANDEL')} />
          <S3kParamSelectRow label="Wave" value={header.LFO2WAVE} options={LFO_WAVEFORM_OPTIONS} onChange={num('LFO2WAVE')} />
          <S3kParamToggleRow label="Retrigger" checked={header.LFO2TRIG === 1} onChange={bool('LFO2TRIG')} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Soft Pedal">
          <S3kParamRow label="Loudness" value={header.SPLOUD} min={0} max={99} onChange={num('SPLOUD')} />
          <S3kParamRow label="Attack" value={header.SPATT} min={0} max={99} onChange={num('SPATT')} />
          <S3kParamRow label="Filter" value={header.SPFILT} min={0} max={99} onChange={num('SPFILT')} />
        </Section>

        <Section title="Advanced">
          <S3kParamToggleRow label="KG Crossfade" checked={header.KXFADE === 1} onChange={bool('KXFADE')} />
          <div className="ac-compact-field">
            <span className="ac-field-label">Keygroups</span>
            <AcNumberInput value={header.GROUPS} ariaLabel="Keygroups (read-only)" />
          </div>
        </Section>
      </div>
    </div>
  );
}
