import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';
import { formatMidiNote } from '@/lib/midi-note-parser';
import { VelocityZoneEditor } from '@/components/keygroups/VelocityZoneEditor';
import { KeyRangeEditor } from '@/components/keygroups/KeyRangeEditor';
import { AdsrDisplay, MultiPointEnvelopeDisplay } from '@/components/keygroups/AdsrDisplay';
import { FilterDisplay } from '@/components/keygroups/FilterDisplay';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';

interface KeygroupEditorProps {
  header: KeygroupHeader;
  keygroupIndex: number;
  sampleNames: string[];
  onParameterChange: (field: string, value: number | string) => void;
  /** Optimistic-only update during drag (no device write) */
  onDragChange?: (field: string, value: number) => void;
  /** Write current header to device (called on drag end) */
  onCommitHeader?: () => void;
  noteRange: NoteRange;
}

function Section({
  title,
  children,
  headerContent,
}: {
  title: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="s3k-section">
      <div className="s3k-section-title">{title}</div>
      {headerContent && (
        <div className="s3k-section-header-content">{headerContent}</div>
      )}
      <div className="s3k-section-grid">{children}</div>
    </div>
  );
}

export function KeygroupEditor({
  header,
  keygroupIndex,
  sampleNames,
  onParameterChange,
  onDragChange,
  onCommitHeader,
  noteRange,
}: KeygroupEditorProps): JSX.Element {
  const num = (field: string) => (value: number) =>
    onParameterChange(field, value);
  const bool = (field: string) => (checked: boolean) =>
    onParameterChange(field, checked ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Title */}
      <div className="px-1 text-lg font-semibold text-gray-200">
        Keygroup {keygroupIndex + 1}: {formatMidiNote(header.LONOTE)}–
        {formatMidiNote(header.HINOTE)}
      </div>

      {/* Note Range — keep KeyRangeEditor as-is */}
      <div className="s3k-section">
        <div className="s3k-section-title">Note Range</div>
        <div className="s3k-section-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <KeyRangeEditor
              lowNote={header.LONOTE}
              highNote={header.HINOTE}
              onChange={(field, value) => onParameterChange(field, value)}
              noteRange={noteRange}
            />
          </div>
          <S3kParamRow
            label="Tune Offset"
            value={header.KGTUNO}
            min={-50}
            max={50}
            onChange={num('KGTUNO')}
            bipolar
          />
        </div>
      </div>

      {/* Velocity Zones — keep VelocityZoneEditor as-is */}
      <div className="s3k-section">
        <div className="s3k-section-title">Velocity Zones</div>
        <div className="p-3">
          <VelocityZoneEditor
            header={header}
            sampleNames={sampleNames}
            onParameterChange={onParameterChange}
          />
        </div>
      </div>

      {/* Row 1: Filter Envelope + Filter (envelope on left to stack above amp envelope) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section
          title="Filter Envelope"
          headerContent={
            <MultiPointEnvelopeDisplay
              rates={[header.ENV2R1, header.ENV2R2, header.ENV2R3, header.ENV2R4]}
              levels={[header.ENV2L1, header.ENV2L2, header.ENV2L3, header.ENV2L4]}
              onChange={onDragChange ? (changes) => { for (const [f, v] of Object.entries(changes)) onDragChange(f, v); } : (changes) => { for (const [f, v] of Object.entries(changes)) onParameterChange(f, v); }}
              onCommit={onCommitHeader}
            />
          }
        >
          <S3kParamRow label="R1" value={header.ENV2R1} min={0} max={99} onChange={num('ENV2R1')} />
          <S3kParamRow label="L1" value={header.ENV2L1} min={0} max={99} onChange={num('ENV2L1')} />
          <S3kParamRow label="R2" value={header.ENV2R2} min={0} max={99} onChange={num('ENV2R2')} />
          <S3kParamRow label="L2" value={header.ENV2L2} min={0} max={99} onChange={num('ENV2L2')} />
          <S3kParamRow label="R3" value={header.ENV2R3} min={0} max={99} onChange={num('ENV2R3')} />
          <S3kParamRow label="L3" value={header.ENV2L3} min={0} max={99} onChange={num('ENV2L3')} />
          <S3kParamRow label="R4" value={header.ENV2R4} min={0} max={99} onChange={num('ENV2R4')} />
          <S3kParamRow label="L4" value={header.ENV2L4} min={0} max={99} onChange={num('ENV2L4')} />
          <S3kParamRow label="Vel→Atk" value={header.V_ATT2} min={-50} max={50} onChange={num('V_ATT2')} bipolar />
          <S3kParamRow label="Vel→Rel" value={header.V_REL2} min={-50} max={50} onChange={num('V_REL2')} bipolar />
          <S3kParamRow label="OffVel→Rel" value={header.O_REL2} min={-50} max={50} onChange={num('O_REL2')} bipolar />
          <S3kParamRow label="Key→D/R" value={header.K_DAR2} min={-50} max={50} onChange={num('K_DAR2')} bipolar />
          <S3kParamRow label="Vel→Env2" value={header.V_ENV2} min={-50} max={50} onChange={num('V_ENV2')} bipolar />
        </Section>

        <Section
          title="Filter"
          headerContent={
            <FilterDisplay
              frequency={header.FILFRQ}
              resonance={header.FILQ}
              onChange={onDragChange ? (changes) => { for (const [f, v] of Object.entries(changes)) onDragChange(f, v); } : (changes) => { for (const [f, v] of Object.entries(changes)) onParameterChange(f, v); }}
              onCommit={onCommitHeader}
            />
          }
        >
          <S3kParamRow label="Freq" value={header.FILFRQ} min={0} max={99} onChange={num('FILFRQ')} />
          <S3kParamRow label="Resonance" value={header.FILQ} min={0} max={15} onChange={num('FILQ')} />
          <S3kParamRow label="Key Track" value={header.K_FREQ} min={-50} max={50} onChange={num('K_FREQ')} bipolar />
          <S3kParamRow label="Vel→Filt" value={header.MODVFILT1} min={-50} max={50} onChange={num('MODVFILT1')} bipolar />
          <S3kParamRow label="LFO2→Filt" value={header.MODVFILT2} min={-50} max={50} onChange={num('MODVFILT2')} bipolar />
          <S3kParamRow label="Env→Filt" value={header.MODVFILT3} min={-50} max={50} onChange={num('MODVFILT3')} bipolar />
        </Section>
      </div>

      {/* Row 2: Amp Envelope + Pitch & Crossfade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section
          title="Amp Envelope"
          headerContent={
            <AdsrDisplay
              attack={header.ATTAK1}
              decay={header.DECAY1}
              sustain={header.SUSTN1}
              release={header.RELSE1}
              onChange={onDragChange ? (changes) => { for (const [f, v] of Object.entries(changes)) onDragChange(f, v); } : (changes) => { for (const [f, v] of Object.entries(changes)) onParameterChange(f, v); }}
              onCommit={onCommitHeader}
            />
          }
        >
          <S3kParamRow label="Attack" value={header.ATTAK1} min={0} max={99} onChange={num('ATTAK1')} />
          <S3kParamRow label="Decay" value={header.DECAY1} min={0} max={99} onChange={num('DECAY1')} />
          <S3kParamRow label="Sustain" value={header.SUSTN1} min={0} max={99} onChange={num('SUSTN1')} />
          <S3kParamRow label="Release" value={header.RELSE1} min={0} max={99} onChange={num('RELSE1')} />
          <S3kParamRow label="Vel→Atk" value={header.V_ATT1} min={-50} max={50} onChange={num('V_ATT1')} bipolar />
          <S3kParamRow label="Vel→Rel" value={header.V_REL1} min={-50} max={50} onChange={num('V_REL1')} bipolar />
          <S3kParamRow label="OffVel→Rel" value={header.O_REL1} min={-50} max={50} onChange={num('O_REL1')} bipolar />
          <S3kParamRow label="Key→D/R" value={header.K_DAR1} min={-50} max={50} onChange={num('K_DAR1')} bipolar />
        </Section>

        <Section title="Pitch & Crossfade">
          <S3kParamRow label="LFO→Pitch" value={header.L_PTCH} min={-50} max={50} onChange={num('L_PTCH')} bipolar />
          <S3kParamToggleRow label="Vel XFade" checked={header.VXFADE === 1} onChange={bool('VXFADE')} />
          <S3kParamRow label="L Key XF" value={header.LKXF} min={0} max={99} onChange={num('LKXF')} />
          <S3kParamRow label="R Key XF" value={header.RKXF} min={0} max={99} onChange={num('RKXF')} />
        </Section>
      </div>
    </div>
  );
}
