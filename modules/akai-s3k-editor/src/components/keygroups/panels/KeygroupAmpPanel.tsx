/**
 * `<KeygroupAmpPanel>` — body content for the KeygroupEditor "Amp"
 * tab (mockup `mockups/keygroups.html:253-332`).
 *
 * Mounts the keygroup-level amp envelope (ENV1 / ADSR shape) at the
 * top via AcEnvelope (adsr kind), then the per-segment editable
 * sliders + the velocity-modulation depths below it.
 *
 * Extracted from `KeygroupEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import { AcEnvelope } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import type { EnvelopePanelProps } from '@/components/keygroups/panels/envelope-panel-props';

export type KeygroupAmpPanelProps = EnvelopePanelProps;

export function KeygroupAmpPanel({
  header,
  num,
  onParameterChange,
  onDragChange,
  onCommitHeader,
}: KeygroupAmpPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <AcEnvelope
        kind="adsr"
        label="AMP · ADSR"
        attack={header.ATTAK1}
        decay={header.DECAY1}
        sustain={header.SUSTN1}
        release={header.RELSE1}
        maxValue={99}
        onChange={(changes) => {
          const dispatch = onDragChange ?? ((f: string, v: number) => onParameterChange(f, v));
          if (changes.attack !== undefined) dispatch('ATTAK1', changes.attack);
          if (changes.decay !== undefined) dispatch('DECAY1', changes.decay);
          if (changes.sustain !== undefined) dispatch('SUSTN1', changes.sustain);
          if (changes.release !== undefined) dispatch('RELSE1', changes.release);
        }}
        onCommit={onCommitHeader}
      />

      <div className="ac-param-rows">
        <S3kParamRow label="Attack" value={header.ATTAK1} min={0} max={99} onChange={num('ATTAK1')} />
        <S3kParamRow label="Decay" value={header.DECAY1} min={0} max={99} onChange={num('DECAY1')} />
        <S3kParamRow label="Sustain" value={header.SUSTN1} min={0} max={99} onChange={num('SUSTN1')} />
        <S3kParamRow label="Release" value={header.RELSE1} min={0} max={99} onChange={num('RELSE1')} />
        <S3kParamRow label="Vel → Atk" value={header.V_ATT1} min={-50} max={50} onChange={num('V_ATT1')} bipolar />
        <S3kParamRow label="Vel → Rel" value={header.V_REL1} min={-50} max={50} onChange={num('V_REL1')} bipolar />
        <S3kParamRow label="OffVel → Rel" value={header.O_REL1} min={-50} max={50} onChange={num('O_REL1')} bipolar />
        <S3kParamRow label="Key → D/R" value={header.K_DAR1} min={-50} max={50} onChange={num('K_DAR1')} bipolar />
      </div>
    </div>
  );
}
