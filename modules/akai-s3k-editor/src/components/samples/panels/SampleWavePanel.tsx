/**
 * `<SampleWavePanel>` — body content for the SampleEditor "Wave" tab
 * (mockup `mockups/samples.html:100-159`).
 *
 * The Wave tab carries the sample's "what is this audio?" surface:
 * source format / bandwidth pickers at the top, volume / pan /
 * velocity / fade-in / fade-out sliders in the middle, and the
 * length / duration / size / peak readouts at the bottom (read-only
 * context derived from the SLNGTH + SSRATE fields).
 *
 * Extracted from `SampleEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcNumberInput, formatBytes } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';

export interface SampleWavePanelProps {
  header: SampleHeader;
  num: (field: string) => (value: number) => void;
}

const BANDWIDTH_OPTIONS = [
  { value: 0, label: '10kHz' },
  { value: 1, label: '20kHz' },
];

function formatSampleDuration(frames: number, sampleRate: number): string {
  if (sampleRate <= 0) return '—';
  const seconds = frames / sampleRate;
  return `${seconds.toFixed(2)} s`;
}

function approximateSampleBytes(frames: number): number {
  return frames * 2;
}

export function SampleWavePanel({
  header,
  num,
}: SampleWavePanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-compact-grid">
        <S3kParamSelectRow label="Bandwidth" value={header.SBANDW} options={BANDWIDTH_OPTIONS} onChange={num('SBANDW')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="Original Key" value={header.SPITCH} min={21} max={127} onChange={num('SPITCH')} />
      </div>

      <div className="ac-compact-grid">
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Sample Rate</span>
          <AcNumberInput value={header.SSRATE} unit="Hz" ariaLabel="Sample rate (read-only)" />
        </div>
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Length</span>
          <AcNumberInput value={header.SLNGTH} ariaLabel="Sample length (read-only)" />
        </div>
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Duration</span>
          <span className="ac-field-readout">{formatSampleDuration(header.SLNGTH, header.SSRATE)}</span>
        </div>
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Size</span>
          <span className="ac-field-readout">{formatBytes(approximateSampleBytes(header.SLNGTH))}</span>
        </div>
      </div>
    </div>
  );
}
