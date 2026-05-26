/**
 * `<SampleWavePanel>` — body content for the SampleEditor "Wave" tab
 * (mockup `mockups/samples.html:100-159`).
 *
 * The Wave tab carries the sample's "what is this audio?" surface:
 * source format / bandwidth pill-radios at the top, original-key
 * slider in the middle, and the length / duration / size / sample-rate
 * readouts at the bottom (read-only context derived from the SLNGTH +
 * SSRATE fields, rendered with `.ac-compact-field--readout` chrome).
 *
 * Extracted from `SampleEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { formatBytes } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamRadioRow } from '@/components/ui/S3kParamRadioRow';

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
        <S3kParamRadioRow label="Bandwidth" value={header.SBANDW} options={BANDWIDTH_OPTIONS} onChange={num('SBANDW')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="Original Key" value={header.SPITCH} min={21} max={127} onChange={num('SPITCH')} />
      </div>

      <div className="ac-compact-grid">
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Sample Rate</span>
          <span className="ac-field-readout">{header.SSRATE} Hz</span>
        </div>
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Length</span>
          <span className="ac-field-readout">{header.SLNGTH}</span>
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
