/**
 * `<SampleMiscPanel>` — body content for the SampleEditor "Misc" tab
 * (mockup `mockups/samples.html:238-270`).
 *
 * The Misc tab carries playback-mode + tuning + key-range parameters
 * that don't belong in Wave / Loop / Trim. Maps to the S3000XL
 * device fields:
 *   - SPTYPE  — Playback Mode pick (looping / no-loop / play-to-end)
 *   - STUNO   — Tune Offset (cents, ±3600 = ±1 semitone × 36 = 3 octaves)
 *   - SHLTO   — Hold Loop Tune (cents per hold-loop iteration)
 *
 * Extracted from `SampleEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamRadioRow } from '@/components/ui/S3kParamRadioRow';

export interface SampleMiscPanelProps {
  header: SampleHeader;
  num: (field: string) => (value: number) => void;
}

const PLAYBACK_MODE_OPTIONS = [
  { value: 0, label: 'Looping' },
  { value: 1, label: 'Loop+Release' },
  { value: 2, label: 'No Loop' },
  { value: 3, label: 'Play to End' },
];

export function SampleMiscPanel({
  header,
  num,
}: SampleMiscPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-compact-grid">
        <S3kParamRadioRow label="Playback Mode" value={header.SPTYPE} options={PLAYBACK_MODE_OPTIONS} onChange={num('SPTYPE')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="Tune Offset" value={header.STUNO} min={-3600} max={3600} onChange={num('STUNO')} bipolar />
        <S3kParamRow label="Hold Loop Tune" value={header.SHLTO} min={-50} max={50} onChange={num('SHLTO')} bipolar />
      </div>
    </div>
  );
}
