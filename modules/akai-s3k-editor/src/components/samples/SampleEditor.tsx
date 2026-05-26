import { useState } from 'react';
import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import {
  AcRadioTabs,
  formatBytes,
  type AcRadioTabDef,
} from '@audiocontrol/editor-core';
import { SampleWavePanel } from '@/components/samples/panels/SampleWavePanel';
import { SampleLoopPanel } from '@/components/samples/panels/SampleLoopPanel';
import { SampleTrimPanel } from '@/components/samples/panels/SampleTrimPanel';
import { SampleMiscPanel } from '@/components/samples/panels/SampleMiscPanel';

interface SampleEditorProps {
  header: SampleHeader;
  sampleIndex: number;
  /** Total samples on device — drives the "N of M" eyebrow. */
  sampleCount: number;
  onParameterChange: (field: string, value: number | string) => void;
}

const SAMPLE_TABS: readonly AcRadioTabDef[] = [
  { id: 'as-wave', label: 'Wave' },
  { id: 'as-loop', label: 'Loop' },
  { id: 'as-trim', label: 'Trim' },
  { id: 'as-misc', label: 'Misc' },
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

export function SampleEditor({
  header,
  sampleIndex,
  sampleCount,
  onParameterChange,
}: SampleEditorProps): JSX.Element {
  const num = (field: string) => (value: number) => onParameterChange(field, value);

  // Controlled-mode tabs (per the canonical pattern set by
  // VelocityZoneEditor 2026-05-24): only the active panel renders;
  // no per-tab-ID CSS selectors need registering in any stylesheet.
  const [activeTab, setActiveTab] = useState<string>('as-wave');

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
            size={12}
            onChange={(e) => onParameterChange('SHNAME', e.target.value)}
            placeholder="(unnamed)"
            data-testid="sample-name-input"
            className="ac-input ac-detail-name-input"
          />
        </h3>
      </header>

      <div className="ac-detail-body">
        {/* AcRadioTabs partitions the sample parameters into four
            mockup-specified panels: Wave / Loop / Trim / Misc (per
            mockups/samples.html:84-95). Each panel body is a per-tab
            component under ./panels/ so this file stays under the
            300-500 line cap. */}
        <AcRadioTabs
          tabs={SAMPLE_TABS}
          panels={{
            'as-wave': <SampleWavePanel header={header} num={num} />,
            'as-loop': <SampleLoopPanel header={header} num={num} />,
            'as-trim': <SampleTrimPanel header={header} num={num} />,
            'as-misc': <SampleMiscPanel header={header} num={num} />,
          }}
          activeId={activeTab}
          onActiveIdChange={setActiveTab}
          groupName="sample-editor-tabs"
          ariaLabel="Sample editor sections"
        />
      </div>
    </article>
  );
}
