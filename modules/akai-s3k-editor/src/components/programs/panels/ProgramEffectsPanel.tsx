/**
 * `<ProgramEffectsPanel>` — body content for the ProgramEditor
 * "Effects" tab (mockup `mockups/programs.html:302-326`).
 *
 * The S3000XL program-level "effects" surface in the live header is
 * the two LFOs (LFO 1 modulating pitch/filter/etc.; LFO 2 dedicated
 * to pan) plus the FX-bus routing field. The mockup's Effects tab
 * carries an FX type pick + FX send / dry/wet / pre-delay / time /
 * feedback / HF damp sliders; the S3000XL device contract has no
 * dedicated FX-type field (program-bus FX live in the S3000XL's
 * dedicated FX section, not the program header). The two LFOs are
 * the program-header's modulation source — they belong in the
 * Effects tab as the visible modulation surface.
 *
 * Extracted from `ProgramEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamRadioRow } from '@/components/ui/S3kParamRadioRow';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';

export interface ProgramEffectsPanelProps {
  header: ProgramHeader;
  num: (field: string) => (value: number) => void;
  bool: (field: string) => (checked: boolean) => void;
}

const LFO_WAVEFORM_OPTIONS = [
  { value: 0, label: 'Triangle' },
  { value: 1, label: 'Sawtooth' },
  { value: 2, label: 'Square' },
];

export function ProgramEffectsPanel({
  header,
  num,
  bool,
}: ProgramEffectsPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-compact-grid">
        <S3kParamRadioRow label="LFO 1 wave" value={header.LFO1WAVE} options={LFO_WAVEFORM_OPTIONS} onChange={num('LFO1WAVE')} />
        <S3kParamRadioRow label="LFO 2 wave" value={header.LFO2WAVE} options={LFO_WAVEFORM_OPTIONS} onChange={num('LFO2WAVE')} />
        <S3kParamToggleRow label="LFO 1 desync" checked={header.DESYNC === 1} onChange={bool('DESYNC')} />
        <S3kParamToggleRow label="LFO 2 retrig" checked={header.LFO2TRIG === 1} onChange={bool('LFO2TRIG')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="LFO 1 rate" value={header.LFORAT} min={0} max={99} onChange={num('LFORAT')} />
        <S3kParamRow label="LFO 1 depth" value={header.LFODEP} min={0} max={99} onChange={num('LFODEP')} />
        <S3kParamRow label="LFO 1 delay" value={header.LFODEL} min={0} max={99} onChange={num('LFODEL')} />
        <S3kParamRow label="LFO 2 rate (pan)" value={header.PANRAT} min={0} max={99} onChange={num('PANRAT')} />
        <S3kParamRow label="LFO 2 depth (pan)" value={header.PANDEP} min={0} max={99} onChange={num('PANDEP')} />
        <S3kParamRow label="LFO 2 delay (pan)" value={header.PANDEL} min={0} max={99} onChange={num('PANDEL')} />
      </div>
    </div>
  );
}
