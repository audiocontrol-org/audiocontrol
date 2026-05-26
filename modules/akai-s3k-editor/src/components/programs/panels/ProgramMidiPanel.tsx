/**
 * `<ProgramMidiPanel>` — body content for the ProgramEditor "MIDI"
 * tab (mockup `mockups/programs.html:221-297`).
 *
 * Per the mockup spec the MIDI tab carries MIDI-channel + bend / mod-
 * wheel / aftertouch / portamento configuration. The toggle cluster
 * groups portamento + bend-mode (mode picks) at the top; the slider
 * rows carry Receive ch / Bend up / Bend down / Mod wheel / Press →
 * pitch + the portamento time + the velocity-modulation depths.
 *
 * Extracted from `ProgramEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';

export interface ProgramMidiPanelProps {
  header: ProgramHeader;
  num: (field: string) => (value: number) => void;
  bool: (field: string) => (checked: boolean) => void;
}

const BEND_MODE_OPTIONS = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Held' },
];

const PORTAMENTO_TYPE_OPTIONS = [
  { value: 0, label: 'Rate' },
  { value: 1, label: 'Time' },
];

export function ProgramMidiPanel({
  header,
  num,
  bool,
}: ProgramMidiPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-compact-grid">
        <S3kParamSelectRow label="Bend mode" value={header.B_MODE} options={BEND_MODE_OPTIONS} onChange={num('B_MODE')} />
        <S3kParamSelectRow label="Portamento type" value={header.PORTYPE} options={PORTAMENTO_TYPE_OPTIONS} onChange={num('PORTYPE')} />
        <S3kParamToggleRow label="Portamento" checked={header.PORTEN === 1} onChange={bool('PORTEN')} />
        <S3kParamToggleRow label="Legato" checked={header.LEGATO === 1} onChange={bool('LEGATO')} />
      </div>

      <div className="ac-param-rows">
        <S3kParamRow label="Program #" value={header.PRGNUM} min={0} max={128} onChange={num('PRGNUM')} />
        <S3kParamRow label="Receive ch" value={header.PMCHAN} min={0} max={255} onChange={num('PMCHAN')} />
        <S3kParamRow label="Bend up" value={header.B_PTCH} min={0} max={99} onChange={num('B_PTCH')} />
        <S3kParamRow label="Bend down" value={header.B_PTCHD} min={0} max={99} onChange={num('B_PTCHD')} />
        <S3kParamRow label="Mod wheel" value={header.MWLDEP} min={0} max={99} onChange={num('MWLDEP')} />
        <S3kParamRow label="Press → pitch" value={header.P_PTCH} min={-50} max={50} onChange={num('P_PTCH')} bipolar />
        <S3kParamRow label="Portamento time" value={header.PORTIME} min={0} max={99} onChange={num('PORTIME')} />
      </div>
    </div>
  );
}
