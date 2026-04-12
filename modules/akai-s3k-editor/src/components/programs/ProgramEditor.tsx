import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { ParameterRow, Section, NumberInput, SelectInput, Toggle } from '@/components/ui';

interface ProgramEditorProps {
  header: ProgramHeader;
  programIndex: number;
  onParameterChange: (field: string, value: number | string) => void;
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
  programIndex,
  onParameterChange,
}: ProgramEditorProps): JSX.Element {
  const change = (field: string) => (value: number | string) =>
    onParameterChange(field, value);

  const changeNum = (field: string) => (value: number) =>
    onParameterChange(field, value);

  const changeBool = (field: string) => (value: boolean) =>
    onParameterChange(field, value ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="px-3 py-2 text-lg font-semibold text-gray-200">
        Program {programIndex + 1}: {header.PRNAME.trim() || '(unnamed)'}
      </div>

      <Section title="Basic">
        <ParameterRow label="Program Name">
          <input
            type="text"
            value={header.PRNAME}
            maxLength={12}
            onChange={(e) => change('PRNAME')(e.target.value)}
            className="w-40 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono uppercase"
          />
        </ParameterRow>
        <ParameterRow label="MIDI Program Number">
          <NumberInput value={header.PRGNUM} min={0} max={128} onChange={changeNum('PRGNUM')} />
        </ParameterRow>
        <ParameterRow label="MIDI Channel">
          <NumberInput value={header.PMCHAN} min={0} max={255} onChange={changeNum('PMCHAN')} />
        </ParameterRow>
        <ParameterRow label="Polyphony">
          <NumberInput value={header.POLYPH} min={0} max={31} onChange={changeNum('POLYPH')} />
        </ParameterRow>
        <ParameterRow label="Priority">
          <SelectInput value={header.PRIORT} options={PRIORITY_OPTIONS} onChange={changeNum('PRIORT')} />
        </ParameterRow>
        <ParameterRow label="Voice Stealing">
          <SelectInput value={header.VASSOQ} options={VOICE_STEALING_OPTIONS} onChange={changeNum('VASSOQ')} />
        </ParameterRow>
      </Section>

      <Section title="Output">
        <ParameterRow label="Output Routing">
          <NumberInput value={header.OUTPUT} min={0} max={99} onChange={changeNum('OUTPUT')} />
        </ParameterRow>
        <ParameterRow label="Stereo Level">
          <NumberInput value={header.STEREO} min={0} max={99} onChange={changeNum('STEREO')} />
        </ParameterRow>
        <ParameterRow label="Pan Position">
          <NumberInput value={header.PANPOS} min={-50} max={50} onChange={changeNum('PANPOS')} />
        </ParameterRow>
        <ParameterRow label="Program Level">
          <NumberInput value={header.PRLOUD} min={0} max={99} onChange={changeNum('PRLOUD')} />
        </ParameterRow>
        <ParameterRow label="Velocity to Amp">
          <NumberInput value={header.V_LOUD} min={-50} max={50} onChange={changeNum('V_LOUD')} />
        </ParameterRow>
        <ParameterRow label="Effects Bus">
          <NumberInput value={header.PFXCHAN} min={0} max={4} onChange={changeNum('PFXCHAN')} />
        </ParameterRow>
      </Section>

      <Section title="Pitch">
        <ParameterRow label="Bend Up">
          <NumberInput value={header.B_PTCH} min={0} max={99} onChange={changeNum('B_PTCH')} />
        </ParameterRow>
        <ParameterRow label="Bend Down">
          <NumberInput value={header.B_PTCHD} min={0} max={99} onChange={changeNum('B_PTCHD')} />
        </ParameterRow>
        <ParameterRow label="Pressure to Pitch">
          <NumberInput value={header.P_PTCH} min={-50} max={50} onChange={changeNum('P_PTCH')} />
        </ParameterRow>
        <ParameterRow label="Tuning">
          <NumberInput value={header.PTUNO} min={-50} max={50} onChange={changeNum('PTUNO')} />
        </ParameterRow>
        <ParameterRow label="Transpose">
          <NumberInput value={header.TRANSPOSE} min={-50} max={50} onChange={changeNum('TRANSPOSE')} />
        </ParameterRow>
      </Section>

      <Section title="Portamento">
        <ParameterRow label="Enable">
          <Toggle checked={header.PORTEN === 1} onChange={changeBool('PORTEN')} />
        </ParameterRow>
        <ParameterRow label="Time">
          <NumberInput value={header.PORTIME} min={0} max={99} onChange={changeNum('PORTIME')} />
        </ParameterRow>
        <ParameterRow label="Type">
          <SelectInput value={header.PORTYPE} options={PORTAMENTO_TYPE_OPTIONS} onChange={changeNum('PORTYPE')} />
        </ParameterRow>
      </Section>

      <Section title="LFO 1">
        <ParameterRow label="Rate">
          <NumberInput value={header.LFORAT} min={0} max={99} onChange={changeNum('LFORAT')} />
        </ParameterRow>
        <ParameterRow label="Depth">
          <NumberInput value={header.LFODEP} min={0} max={99} onChange={changeNum('LFODEP')} />
        </ParameterRow>
        <ParameterRow label="Delay">
          <NumberInput value={header.LFODEL} min={0} max={99} onChange={changeNum('LFODEL')} />
        </ParameterRow>
        <ParameterRow label="Waveform">
          <SelectInput value={header.LFO1WAVE} options={LFO_WAVEFORM_OPTIONS} onChange={changeNum('LFO1WAVE')} />
        </ParameterRow>
        <ParameterRow label="Desync">
          <Toggle checked={header.DESYNC === 1} onChange={changeBool('DESYNC')} />
        </ParameterRow>
      </Section>

      <Section title="LFO 1 Mod Sources">
        <ParameterRow label="Modwheel to LFO1">
          <NumberInput value={header.MWLDEP} min={0} max={99} onChange={changeNum('MWLDEP')} />
        </ParameterRow>
        <ParameterRow label="Aftertouch to LFO1">
          <NumberInput value={header.PRSDEP} min={0} max={99} onChange={changeNum('PRSDEP')} />
        </ParameterRow>
        <ParameterRow label="Velocity to LFO1">
          <NumberInput value={header.VELDEP} min={0} max={99} onChange={changeNum('VELDEP')} />
        </ParameterRow>
      </Section>

      <Section title="LFO 2 (Pan)">
        <ParameterRow label="Rate">
          <NumberInput value={header.PANRAT} min={0} max={99} onChange={changeNum('PANRAT')} />
        </ParameterRow>
        <ParameterRow label="Depth">
          <NumberInput value={header.PANDEP} min={0} max={99} onChange={changeNum('PANDEP')} />
        </ParameterRow>
        <ParameterRow label="Delay">
          <NumberInput value={header.PANDEL} min={0} max={99} onChange={changeNum('PANDEL')} />
        </ParameterRow>
        <ParameterRow label="Waveform">
          <SelectInput value={header.LFO2WAVE} options={LFO_WAVEFORM_OPTIONS} onChange={changeNum('LFO2WAVE')} />
        </ParameterRow>
        <ParameterRow label="Retrigger">
          <Toggle checked={header.LFO2TRIG === 1} onChange={changeBool('LFO2TRIG')} />
        </ParameterRow>
      </Section>

      <Section title="Soft Pedal">
        <ParameterRow label="Loudness Reduction">
          <NumberInput value={header.SPLOUD} min={0} max={99} onChange={changeNum('SPLOUD')} />
        </ParameterRow>
        <ParameterRow label="Attack Stretch">
          <NumberInput value={header.SPATT} min={0} max={99} onChange={changeNum('SPATT')} />
        </ParameterRow>
        <ParameterRow label="Filter Reduction">
          <NumberInput value={header.SPFILT} min={0} max={99} onChange={changeNum('SPFILT')} />
        </ParameterRow>
      </Section>

      <Section title="Advanced">
        <ParameterRow label="Keygroup Crossfade">
          <Toggle checked={header.KXFADE === 1} onChange={changeBool('KXFADE')} />
        </ParameterRow>
        <ParameterRow label="Legato">
          <Toggle checked={header.LEGATO === 1} onChange={changeBool('LEGATO')} />
        </ParameterRow>
        <ParameterRow label="Bend Mode">
          <SelectInput value={header.B_MODE} options={BEND_MODE_OPTIONS} onChange={changeNum('B_MODE')} />
        </ParameterRow>
        <ParameterRow label="Keygroups">
          <span className="text-sm text-gray-300 font-mono">{header.GROUPS}</span>
        </ParameterRow>
      </Section>
    </div>
  );
}
