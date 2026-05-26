import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcNumberInput, formatBytes } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';
import { Section } from '@/components/ui/Section';

interface SampleEditorProps {
  header: SampleHeader;
  sampleIndex: number;
  /** Total samples on device — drives the "N of M" eyebrow. */
  sampleCount: number;
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

/**
 * Format a sample slot index as a 3-digit decimal string ("001", "012",
 * "452"). Akai S3000XL samples are numbered 1..N starting from index 0;
 * 3-digit width covers the maximum 512 samples per device.
 */
function formatSampleSlot(index: number): string {
  return String(index + 1).padStart(3, '0');
}

/**
 * Format sample duration in seconds (e.g., "0.91 s") from frame count
 * and sample rate. Returns an em-dash for SSRATE = 0 (invalid header)
 * so the eyebrow stays readable instead of rendering "Infinity s".
 */
function formatSampleDuration(frames: number, sampleRate: number): string {
  if (sampleRate <= 0) return '—';
  const seconds = frames / sampleRate;
  return `${seconds.toFixed(2)} s`;
}

/**
 * Approximate sample size in bytes: 2 bytes per frame (16-bit mono PCM
 * on the S3000XL). Used for the eyebrow size estimate — not the wire-
 * level transfer size (which includes header/loop-points overhead).
 */
function approximateSampleBytes(frames: number): number {
  return frames * 2;
}

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
  sampleIndex,
  sampleCount,
  onParameterChange,
}: SampleEditorProps): JSX.Element {
  const num = (field: string) => (value: number) => onParameterChange(field, value);

  return (
    <article
      className="ac-detail-pane"
      aria-label="Sample editor"
      data-testid="sample-detail"
    >
      {/* Detail head — eyebrow ("Sample · Editing · NNN of MMM · <rate> Hz
          · <size> · <duration>") + slot ("NNN") + editable name. Mockup
          contract at docs/.../mockups/samples.html. Canonical chrome
          lives in editor-core/src/design/detail-pane-primitives.css
          (promoted from roland-sxx0-editor 2026-05-25 per
          AUDIT-20260525-26). */}
      <header className="ac-detail-head">
        <div className="ac-detail-eyebrow-row">
          <span>Sample</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span className="ac-detail-eyebrow-accent">Editing</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span>{formatSampleSlot(sampleIndex)} of {String(sampleCount).padStart(3, '0')}</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span>{header.SSRATE} Hz · {formatBytes(approximateSampleBytes(header.SLNGTH))} · {formatSampleDuration(header.SLNGTH, header.SSRATE)}</span>
        </div>
        <h3 id="sample-detail-title" className="ac-detail-title">
          <span className="ac-detail-slot">{formatSampleSlot(sampleIndex)}</span>
          <input
            type="text"
            value={header.SHNAME}
            maxLength={12}
            onChange={(e) => onParameterChange('SHNAME', e.target.value)}
            placeholder="(unnamed)"
            data-testid="sample-name-input"
            className="ac-input ac-detail-name-input"
          />
        </h3>
      </header>

      <div className="ac-detail-body">
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
    </article>
  );
}
