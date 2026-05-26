/**
 * `<ProgramOutputPanel>` — body content for the ProgramEditor "Output"
 * tab (mockup `mockups/programs.html:332-365`).
 *
 * The mockup Output tab carries bus / stereo-width pickers + master
 * level / pan / bus level / bus pan / headroom / limiter sliders.
 * Mapping to the S3000XL program-header contract: OUTPUT is the
 * output routing (the FX-bus pick is PFXCHAN); V_LOUD is the
 * velocity-to-amp depth (output-stage modulation); TRANSPOSE shifts
 * the entire output up/down semitones; SPATT / SPFILT round out the
 * soft-pedal envelope's output-stage attack/filter shaping.
 *
 * Extracted from `ProgramEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';

export interface ProgramOutputPanelProps {
  header: ProgramHeader;
  num: (field: string) => (value: number) => void;
}

export function ProgramOutputPanel({
  header,
  num,
}: ProgramOutputPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-param-rows">
        <S3kParamRow label="Output routing" value={header.OUTPUT} min={0} max={99} onChange={num('OUTPUT')} />
        <S3kParamRow label="FX bus" value={header.PFXCHAN} min={0} max={4} onChange={num('PFXCHAN')} />
        <S3kParamRow label="Vel → amp" value={header.V_LOUD} min={-50} max={50} onChange={num('V_LOUD')} bipolar />
        <S3kParamRow label="Transpose" value={header.TRANSPOSE} min={-50} max={50} onChange={num('TRANSPOSE')} bipolar />
        <S3kParamRow label="Soft pedal attack" value={header.SPATT} min={0} max={99} onChange={num('SPATT')} />
        <S3kParamRow label="Soft pedal filter" value={header.SPFILT} min={0} max={99} onChange={num('SPFILT')} />
      </div>
    </div>
  );
}
