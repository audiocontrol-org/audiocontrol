import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { CollapsibleSection } from '@audiocontrol/editor-core';
import { ParameterRow, Section, NumberInput, Toggle } from '@/components/ui';
import { formatMidiNote } from '@/lib/midi-note-parser';
import { VelocityZoneEditor } from '@/components/keygroups/VelocityZoneEditor';
import { KeyRangeEditor } from '@/components/keygroups/KeyRangeEditor';

interface KeygroupEditorProps {
  header: KeygroupHeader;
  keygroupIndex: number;
  sampleNames: string[];
  onParameterChange: (field: string, value: number | string) => void;
}

const collapsibleTheme = {
  container: 'border border-gray-700 rounded-lg overflow-hidden mb-3',
  headerButton:
    'w-full flex items-center justify-between bg-gray-800 px-3 py-2 text-sm font-medium cursor-pointer hover:bg-gray-750 transition-colors',
  title: 'text-sm font-medium text-gray-200',
  icon: 'text-gray-400 text-xs',
  body: 'divide-y divide-gray-800',
};

function NoteRangeSection({
  header,
  changeNum,
  onParameterChange,
}: {
  header: KeygroupHeader;
  changeNum: (field: string) => (v: number) => void;
  onParameterChange: (field: string, value: number | string) => void;
}): JSX.Element {
  return (
    <Section title="Note Range">
      <KeyRangeEditor
        lowNote={header.LONOTE}
        highNote={header.HINOTE}
        onChange={(field, value) => onParameterChange(field, value)}
      />
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
    <CollapsibleSection title="Amp Envelope" defaultOpen={false} theme={collapsibleTheme}>
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
    </CollapsibleSection>
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
    <CollapsibleSection title="Filter" defaultOpen={false} theme={collapsibleTheme}>
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
    </CollapsibleSection>
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
    <CollapsibleSection title="Filter Envelope" defaultOpen={false} theme={collapsibleTheme}>
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
    </CollapsibleSection>
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
    <CollapsibleSection title="Crossfade" defaultOpen={false} theme={collapsibleTheme}>
      <ParameterRow label="Velocity Crossfade">
        <Toggle checked={header.VXFADE === 1} onChange={changeBool('VXFADE')} />
      </ParameterRow>
      <ParameterRow label="Left Key Crossfade">
        <NumberInput value={header.LKXF} min={0} max={99} onChange={changeNum('LKXF')} />
      </ParameterRow>
      <ParameterRow label="Right Key Crossfade">
        <NumberInput value={header.RKXF} min={0} max={99} onChange={changeNum('RKXF')} />
      </ParameterRow>
    </CollapsibleSection>
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
    <CollapsibleSection title="Pitch" defaultOpen={false} theme={collapsibleTheme}>
      <ParameterRow label="LFO -> Pitch">
        <NumberInput value={header.L_PTCH} min={-50} max={50} onChange={changeNum('L_PTCH')} />
      </ParameterRow>
    </CollapsibleSection>
  );
}

export function KeygroupEditor({
  header,
  keygroupIndex,
  sampleNames,
  onParameterChange,
}: KeygroupEditorProps): JSX.Element {
  const changeNum = (field: string) => (value: number) =>
    onParameterChange(field, value);

  const changeBool = (field: string) => (value: boolean) =>
    onParameterChange(field, value ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="px-3 py-2 text-lg font-semibold text-gray-200">
        Keygroup {keygroupIndex + 1}: {formatMidiNote(header.LONOTE)}–{formatMidiNote(header.HINOTE)}
      </div>

      <NoteRangeSection header={header} changeNum={changeNum} onParameterChange={onParameterChange} />
      <CollapsibleSection title="Velocity Zones" defaultOpen={true} theme={collapsibleTheme}>
        <VelocityZoneEditor
          header={header}
          sampleNames={sampleNames}
          onParameterChange={onParameterChange}
        />
      </CollapsibleSection>
      <AmplitudeEnvelopeSection header={header} changeNum={changeNum} />
      <FilterSection header={header} changeNum={changeNum} />
      <FilterEnvelopeSection header={header} changeNum={changeNum} />
      <CrossfadeSection header={header} changeNum={changeNum} changeBool={changeBool} />
      <PitchSection header={header} changeNum={changeNum} />
    </div>
  );
}
