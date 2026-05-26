import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcNumberInput } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';
import { Section } from '@/components/ui/Section';

interface SampleEditorProps {
  header: SampleHeader;
  sampleIndex: number;
  onParameterChange: (field: string, value: number | string) => void;
}

const BANDWIDTH_OPTIONS = [
  { value: 0, label: '10kHz' },
  { value: 1, label: '20kHz' },
];

const PLAYBACK_MODE_OPTIONS = [
  { value: 0, label: 'Looping' },
  { value: 1, label: 'Loop+Release' },
  { value: 2, label: 'No Loop' },
  { value: 3, label: 'Play to End' },
];

function LoopSection({
  loopNumber,
  loopAt,
  loopLength,
  dwell,
  maxLength,
  num,
}: {
  loopNumber: number;
  loopAt: number;
  loopLength: number;
  dwell: number;
  maxLength: number;
  num: (field: string) => (value: number) => void;
}): JSX.Element {
  return (
    <Section title={`Loop ${loopNumber}`}>
      <S3kParamRow label="Loop Start" value={loopAt} min={0} max={maxLength} onChange={num(`LOOPAT${loopNumber}`)} />
      <S3kParamRow label="Loop Length" value={loopLength} min={0} max={maxLength} onChange={num(`LLNGTH${loopNumber}`)} />
      <S3kParamRow label="Dwell" value={dwell} min={0} max={9999} onChange={num(`LDWELL${loopNumber}`)} />
    </Section>
  );
}

export function SampleEditor({
  header,
  onParameterChange,
}: SampleEditorProps): JSX.Element {
  const num = (field: string) => (value: number) => onParameterChange(field, value);

  return (
    <div className="space-y-3">
      {/* Name as an editable field at the top, not inside a section */}
      <div className="flex items-center gap-3 px-1">
        <input
          type="text"
          value={header.SHNAME}
          maxLength={12}
          onChange={(e) => onParameterChange('SHNAME', e.target.value)}
          className="flex-1 bg-transparent border-b border-gray-600 focus:border-amber-500 px-1 py-1 text-lg text-gray-100 font-mono uppercase outline-none transition-colors"
        />
      </div>

      {/* Row 1: Basic + Tuning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Basic">
          <S3kParamRow label="Original Key" value={header.SPITCH} min={21} max={127} onChange={num('SPITCH')} />
          <S3kParamSelectRow label="Bandwidth" value={header.SBANDW} options={BANDWIDTH_OPTIONS} onChange={num('SBANDW')} />
          <div className="ac-compact-field">
            <span className="ac-field-label">Sample Rate</span>
            <AcNumberInput value={header.SSRATE} unit="Hz" ariaLabel="Sample rate (read-only)" />
          </div>
          <S3kParamSelectRow label="Playback Mode" value={header.SPTYPE} options={PLAYBACK_MODE_OPTIONS} onChange={num('SPTYPE')} />
        </Section>

        <Section title="Tuning">
          <S3kParamRow label="Tune Offset" value={header.STUNO} min={-3600} max={3600} onChange={num('STUNO')} bipolar />
          <S3kParamRow label="Hold Loop Tune" value={header.SHLTO} min={-50} max={50} onChange={num('SHLTO')} bipolar />
        </Section>
      </div>

      {/* Row 2: Playback Range + Loop 1 (if present) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Playback Range">
          <S3kParamRow label="Start" value={header.SSTART} min={0} max={header.SLNGTH} onChange={num('SSTART')} />
          <S3kParamRow label="End" value={header.SMPEND} min={0} max={header.SLNGTH} onChange={num('SMPEND')} />
          <div className="ac-compact-field">
            <span className="ac-field-label">Length</span>
            <AcNumberInput value={header.SLNGTH} ariaLabel="Sample length (read-only)" />
          </div>
        </Section>

        {header.SLOOPS >= 1 && (
          <LoopSection
            loopNumber={1}
            loopAt={header.LOOPAT1}
            loopLength={header.LLNGTH1}
            dwell={header.LDWELL1}
            maxLength={header.SLNGTH}
            num={num}
          />
        )}
      </div>

      {/* Row 3: Loop 2 + Loop 3 (if present) */}
      {(header.SLOOPS >= 2 || header.SLOOPS >= 3) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {header.SLOOPS >= 2 && (
            <LoopSection
              loopNumber={2}
              loopAt={header.LOOPAT2}
              loopLength={header.LLNGTH2}
              dwell={header.LDWELL2}
              maxLength={header.SLNGTH}
              num={num}
            />
          )}
          {header.SLOOPS >= 3 && (
            <LoopSection
              loopNumber={3}
              loopAt={header.LOOPAT3}
              loopLength={header.LLNGTH3}
              dwell={header.LDWELL3}
              maxLength={header.SLNGTH}
              num={num}
            />
          )}
        </div>
      )}

      {/* Row 4: Loop 4 (if present) */}
      {header.SLOOPS >= 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <LoopSection
            loopNumber={4}
            loopAt={header.LOOPAT4}
            loopLength={header.LLNGTH4}
            dwell={header.LDWELL4}
            maxLength={header.SLNGTH}
            num={num}
          />
        </div>
      )}
    </div>
  );
}
