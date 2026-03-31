import type { ReactNode } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3000xl-browser';

interface KeygroupEditorProps {
  header: KeygroupHeader;
  keygroupIndex: number;
  onParameterChange: (field: string, value: number) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}

function ParameterRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between py-1.5 px-3">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden mb-3">
      <div className="bg-gray-800 px-3 py-2 text-sm font-medium">{title}</div>
      <div className="divide-y divide-gray-800">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 text-right"
    />
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-600'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function NoteRangeSection({
  header,
  changeNum,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
}): JSX.Element {
  return (
    <Section title="Note Range">
      <ParameterRow label={`Low Note (${midiNoteToName(header.LONOTE)})`}>
        <NumberInput value={header.LONOTE} min={21} max={127} onChange={changeNum('LONOTE')} />
      </ParameterRow>
      <ParameterRow label={`High Note (${midiNoteToName(header.HINOTE)})`}>
        <NumberInput value={header.HINOTE} min={21} max={127} onChange={changeNum('HINOTE')} />
      </ParameterRow>
      <ParameterRow label="Tuning Offset">
        <NumberInput value={header.KGTUNO} min={-50} max={50} onChange={changeNum('KGTUNO')} />
      </ParameterRow>
    </Section>
  );
}

function AmplitudeEnvelopeSection({
  header,
  changeNum,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
}): JSX.Element {
  return (
    <Section title="Amplitude Envelope (Env 1)">
      <ParameterRow label="Attack">
        <NumberInput value={header.ATTAK1} min={0} max={99} onChange={changeNum('ATTAK1')} />
      </ParameterRow>
      <ParameterRow label="Decay">
        <NumberInput value={header.DECAY1} min={0} max={99} onChange={changeNum('DECAY1')} />
      </ParameterRow>
      <ParameterRow label="Sustain">
        <NumberInput value={header.SUSTN1} min={0} max={99} onChange={changeNum('SUSTN1')} />
      </ParameterRow>
      <ParameterRow label="Release">
        <NumberInput value={header.RELSE1} min={0} max={99} onChange={changeNum('RELSE1')} />
      </ParameterRow>
      <ParameterRow label="Vel -> Attack">
        <NumberInput value={header.V_ATT1} min={-50} max={50} onChange={changeNum('V_ATT1')} />
      </ParameterRow>
      <ParameterRow label="Vel -> Release">
        <NumberInput value={header.V_REL1} min={-50} max={50} onChange={changeNum('V_REL1')} />
      </ParameterRow>
      <ParameterRow label="Off Vel -> Release">
        <NumberInput value={header.O_REL1} min={-50} max={50} onChange={changeNum('O_REL1')} />
      </ParameterRow>
      <ParameterRow label="Key -> Decay/Release">
        <NumberInput value={header.K_DAR1} min={-50} max={50} onChange={changeNum('K_DAR1')} />
      </ParameterRow>
    </Section>
  );
}

function FilterSection({
  header,
  changeNum,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
}): JSX.Element {
  return (
    <Section title="Filter">
      <ParameterRow label="Frequency">
        <NumberInput value={header.FILFRQ} min={0} max={99} onChange={changeNum('FILFRQ')} />
      </ParameterRow>
      <ParameterRow label="Resonance">
        <NumberInput value={header.FILQ} min={0} max={15} onChange={changeNum('FILQ')} />
      </ParameterRow>
      <ParameterRow label="Key Tracking">
        <NumberInput value={header.K_FREQ} min={-50} max={50} onChange={changeNum('K_FREQ')} />
      </ParameterRow>
      <ParameterRow label="Vel -> Filter">
        <NumberInput value={header.V_FREQ} min={-50} max={50} onChange={changeNum('V_FREQ')} />
      </ParameterRow>
      <ParameterRow label="Pressure -> Filter">
        <NumberInput value={header.P_FREQ} min={-50} max={50} onChange={changeNum('P_FREQ')} />
      </ParameterRow>
      <ParameterRow label="Env -> Filter">
        <NumberInput value={header.E_FREQ} min={-50} max={50} onChange={changeNum('E_FREQ')} />
      </ParameterRow>
    </Section>
  );
}

function FilterEnvelopeSection({
  header,
  changeNum,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
}): JSX.Element {
  return (
    <Section title="Filter Envelope (Env 2)">
      <ParameterRow label="Rate 1 (Attack)">
        <NumberInput value={header.ENV2R1} min={0} max={99} onChange={changeNum('ENV2R1')} />
      </ParameterRow>
      <ParameterRow label="Level 1">
        <NumberInput value={header.ENV2L1} min={0} max={99} onChange={changeNum('ENV2L1')} />
      </ParameterRow>
      <ParameterRow label="Rate 2">
        <NumberInput value={header.ENV2R2} min={0} max={99} onChange={changeNum('ENV2R2')} />
      </ParameterRow>
      <ParameterRow label="Level 2">
        <NumberInput value={header.ENV2L2} min={0} max={99} onChange={changeNum('ENV2L2')} />
      </ParameterRow>
      <ParameterRow label="Rate 3 (Decay)">
        <NumberInput value={header.ENV2R3} min={0} max={99} onChange={changeNum('ENV2R3')} />
      </ParameterRow>
      <ParameterRow label="Level 3 (Sustain)">
        <NumberInput value={header.ENV2L3} min={0} max={99} onChange={changeNum('ENV2L3')} />
      </ParameterRow>
      <ParameterRow label="Rate 4 (Release)">
        <NumberInput value={header.ENV2R4} min={0} max={99} onChange={changeNum('ENV2R4')} />
      </ParameterRow>
      <ParameterRow label="Level 4 (Final)">
        <NumberInput value={header.ENV2L4} min={0} max={99} onChange={changeNum('ENV2L4')} />
      </ParameterRow>
      <ParameterRow label="Vel -> Attack">
        <NumberInput value={header.V_ATT2} min={-50} max={50} onChange={changeNum('V_ATT2')} />
      </ParameterRow>
      <ParameterRow label="Vel -> Release">
        <NumberInput value={header.V_REL2} min={-50} max={50} onChange={changeNum('V_REL2')} />
      </ParameterRow>
      <ParameterRow label="Off Vel -> Release">
        <NumberInput value={header.O_REL2} min={-50} max={50} onChange={changeNum('O_REL2')} />
      </ParameterRow>
      <ParameterRow label="Key -> Decay/Release">
        <NumberInput value={header.K_DAR2} min={-50} max={50} onChange={changeNum('K_DAR2')} />
      </ParameterRow>
      <ParameterRow label="Vel -> Env 2 Level">
        <NumberInput value={header.V_ENV2} min={-50} max={50} onChange={changeNum('V_ENV2')} />
      </ParameterRow>
    </Section>
  );
}

function CrossfadeSection({
  header,
  changeNum,
  changeBool,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
  changeBool: (field: string) => (v: boolean) => void;
}): JSX.Element {
  return (
    <Section title="Crossfade">
      <ParameterRow label="Velocity Crossfade">
        <Toggle checked={header.VXFADE === 1} onChange={changeBool('VXFADE')} />
      </ParameterRow>
      <ParameterRow label="Left Key Crossfade">
        <NumberInput value={header.LKXF} min={0} max={99} onChange={changeNum('LKXF')} />
      </ParameterRow>
      <ParameterRow label="Right Key Crossfade">
        <NumberInput value={header.RKXF} min={0} max={99} onChange={changeNum('RKXF')} />
      </ParameterRow>
    </Section>
  );
}

function PitchSection({
  header,
  changeNum,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
}): JSX.Element {
  return (
    <Section title="Pitch">
      <ParameterRow label="LFO -> Pitch">
        <NumberInput value={header.L_PTCH} min={-50} max={50} onChange={changeNum('L_PTCH')} />
      </ParameterRow>
    </Section>
  );
}

export function KeygroupEditor({
  header,
  keygroupIndex,
  onParameterChange,
}: KeygroupEditorProps): JSX.Element {
  const changeNum = (field: string) => (value: number) =>
    onParameterChange(field, value);

  const changeBool = (field: string) => (value: boolean) =>
    onParameterChange(field, value ? 1 : 0);

  return (
    <div className="space-y-1">
      <div className="px-3 py-2 text-lg font-semibold text-gray-200">
        Keygroup {keygroupIndex + 1}: {midiNoteToName(header.LONOTE)}–{midiNoteToName(header.HINOTE)}
      </div>

      <NoteRangeSection header={header} changeNum={changeNum} />
      <AmplitudeEnvelopeSection header={header} changeNum={changeNum} />
      <FilterSection header={header} changeNum={changeNum} />
      <FilterEnvelopeSection header={header} changeNum={changeNum} />
      <CrossfadeSection header={header} changeNum={changeNum} changeBool={changeBool} />
      <PitchSection header={header} changeNum={changeNum} />
    </div>
  );
}
