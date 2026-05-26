/**
 * `<KeygroupLfoPanel>` — body content for the KeygroupEditor "LFO"
 * tab (mockup `mockups/keygroups.html:335-369`).
 *
 * The S3000XL LFO SOURCE (rate / depth / waveform / delay) lives on
 * the PROGRAM header, not the keygroup header — see the ProgramEditor
 * "Effects" tab. The keygroup-level LFO surface is the per-keygroup
 * MODULATION DEPTH routing: how much the program-level LFO sweeps the
 * keygroup's pitch / filter / etc.
 *
 * The mockup's LFO tab shows Rate / Depth / Delay / Mod wheel / Pres
 * → depth / Vel → depth sliders, which are the program-level LFO
 * source params. They are NOT keygroup-header fields; rendering them
 * here as editable controls would silently write to keygroup fields
 * that don't exist on the device contract (a bug factory per
 * `feedback_contract_enforcement`). The keygroup LFO tab is therefore
 * narrower than the mockup: it carries the L_PTCH depth + an inline
 * informational note pointing the operator to the program-level LFO
 * source.
 *
 * Extracted from `KeygroupEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';

export interface KeygroupLfoPanelProps {
  header: KeygroupHeader;
  num: (field: string) => (value: number) => void;
}

export function KeygroupLfoPanel({
  header,
  num,
}: KeygroupLfoPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-param-rows">
        <S3kParamRow label="LFO → Pitch" value={header.L_PTCH} min={-50} max={50} onChange={num('L_PTCH')} bipolar />
      </div>

      <div className="ac-compact-grid">
        <div className="ac-compact-field ac-compact-field--readout">
          <span className="ac-field-label">LFO source</span>
          <span className="ac-field-readout">
            Rate / Depth / Delay / Waveform — see Program editor → Effects tab
          </span>
        </div>
      </div>
    </div>
  );
}
