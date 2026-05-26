/**
 * `<SampleTrimPanel>` — body content for the SampleEditor "Trim" tab
 * (mockup `mockups/samples.html:207-235`).
 *
 * The Trim tab carries the Start / End frame-bound editors + the
 * Length read-only context. Maps to the S3000XL SSTART + SMPEND
 * device-field pair; SLNGTH is the read-only frame-count derived
 * from the actual sample data.
 *
 * Extracted from `SampleEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcNumberInput } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';

export interface SampleTrimPanelProps {
  header: SampleHeader;
  num: (field: string) => (value: number) => void;
}

export function SampleTrimPanel({
  header,
  num,
}: SampleTrimPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-param-rows">
        <S3kParamRow label="Start" value={header.SSTART} min={0} max={header.SLNGTH} onChange={num('SSTART')} />
        <S3kParamRow label="End" value={header.SMPEND} min={0} max={header.SLNGTH} onChange={num('SMPEND')} />
      </div>

      <div className="ac-compact-grid">
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">Length</span>
          <AcNumberInput value={header.SLNGTH} ariaLabel="Trim length (read-only)" />
        </div>
      </div>
    </div>
  );
}
