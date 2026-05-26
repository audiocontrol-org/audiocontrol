/**
 * `<KeygroupZonesPanel>` — body content for the KeygroupEditor "Zones"
 * tab (mockup `mockups/keygroups.html:96-155`).
 *
 * The Zones tab carries the per-keygroup note-range affordance + the
 * VelocityZoneEditor (which itself uses AcRadioTabs in controlled mode
 * for Zone 1..4 selection — preserved as-is, this panel only embeds
 * it). The KGTUNO tune-offset belongs here (zone-level tuning).
 *
 * Extracted from `KeygroupEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { VelocityZoneEditor } from '@/components/keygroups/VelocityZoneEditor';
import { KeyRangeEditor } from '@/components/keygroups/KeyRangeEditor';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';

export interface KeygroupZonesPanelProps {
  header: KeygroupHeader;
  sampleNames: string[];
  onParameterChange: (field: string, value: number | string) => void;
  num: (field: string) => (value: number) => void;
  noteRange: NoteRange;
}

export function KeygroupZonesPanel({
  header,
  sampleNames,
  onParameterChange,
  num,
  noteRange,
}: KeygroupZonesPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <div className="ac-param-rows">
        <div style={{ gridColumn: '1 / -1' }}>
          <KeyRangeEditor
            lowNote={header.LONOTE}
            highNote={header.HINOTE}
            onChange={(field, value) => onParameterChange(field, value)}
            noteRange={noteRange}
          />
        </div>
        <S3kParamRow
          label="Tune Offset"
          value={header.KGTUNO}
          min={-50}
          max={50}
          onChange={num('KGTUNO')}
          bipolar
        />
      </div>

      <div>
        <VelocityZoneEditor
          header={header}
          sampleNames={sampleNames}
          onParameterChange={onParameterChange}
        />
      </div>
    </div>
  );
}
