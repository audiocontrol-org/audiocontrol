/**
 * `<KeygroupPitchPanel>` — body content for the KeygroupEditor "Pitch"
 * tab (mockup `mockups/keygroups.html:158-186`).
 *
 * The Pitch tab carries the per-keygroup pitch-modulation surface.
 * Per the keygroup header contract this is mostly cross-fade controls
 * (VXFADE toggle + LKXF / RKXF crossfade depths) and per-sample tune
 * (KGTUNO lives on the Zones tab; this tab carries the modulation
 * routing instead).
 *
 * The mockup's "Tune (cents)" / "Semitone" / "Tracking" / "Vel →
 * pitch" / "Pres → pitch" / "Glide time" sliders are not all present
 * on the live S3000XL keygroup header contract — only the params that
 * exist as device fields are rendered here. Faithfulness to the mockup
 * is bounded by the device contract (per `feedback_editor_tools_all_devices`
 * the editor MUST stay functionally complete — the mockup is a visual
 * spec, not a license to invent device fields).
 *
 * Extracted from `KeygroupEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';

export interface KeygroupPitchPanelProps {
  header: KeygroupHeader;
  num: (field: string) => (value: number) => void;
  bool: (field: string) => (checked: boolean) => void;
}

export function KeygroupPitchPanel({
  header,
  num,
  bool,
}: KeygroupPitchPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-compact-grid">
        <S3kParamToggleRow label="Vel crossfade" checked={header.VXFADE === 1} onChange={bool('VXFADE')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="Left key XFade" value={header.LKXF} min={0} max={99} onChange={num('LKXF')} />
        <S3kParamRow label="Right key XFade" value={header.RKXF} min={0} max={99} onChange={num('RKXF')} />
      </div>
    </div>
  );
}
