/**
 * `<KeygroupFilterPanel>` — body content for the KeygroupEditor
 * "Filter" tab (mockup `mockups/keygroups.html:189-250`).
 *
 * Wraps both the filter envelope (4-segment ENV2 family) and the
 * filter cutoff / resonance / modulation controls. The envelope graph
 * mounts at the top via AcEnvelope (multi-segment kind); the
 * frequency-response display mounts below it; the parameter sliders
 * are the editable surface beneath both visualizations.
 *
 * Filter-envelope adapter (`AKAI_FILTER_ENV_RATE_FIELDS` +
 * `AKAI_FILTER_ENV_LEVEL_FIELDS`) maps AcEnvelope's segment-indexed
 * onTimeChange / onLevelChange back to the akai header field names.
 * Frequency-response adapter (`dispatchAkaiFilterChange`) rounds +
 * clamps float values from drag into the integer device-field range
 * (see AUDIT-20260524-14 closure for why the adapter is non-optional).
 *
 * Extracted from `KeygroupEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import {
  AcEnvelope,
  AcFrequencyResponse,
  type AcEnvelopeSegment,
} from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import {
  AKAI_FILTER_FREQ_HZ_RANGE,
  AKAI_FILTER_RESONANCE_RANGE,
  dispatchAkaiFilterChange,
  filfrqToHz,
} from '@/components/keygroups/akai-filter-adapter';
import type { EnvelopePanelProps } from '@/components/keygroups/panels/envelope-panel-props';

export type KeygroupFilterPanelProps = EnvelopePanelProps;

/**
 * Map the akai 4-segment filter envelope's flat (rates[4], levels[4])
 * shape onto AcEnvelope's uniform `{time, level}[]` segment array.
 * Akai's RATE parameters ARE the canonical "time" values for the
 * envelope visualization (the cumulative-advance model in
 * AcEnvelopeGraph treats higher `time` as advancing the cursor less,
 * which is the same intent here: high rate = fast segment = short
 * visible extent).
 */
function akaiFilterEnvSegments(header: KeygroupHeader): AcEnvelopeSegment[] {
  return [
    { time: header.ENV2R1, level: header.ENV2L1 },
    { time: header.ENV2R2, level: header.ENV2L2 },
    { time: header.ENV2R3, level: header.ENV2L3 },
    { time: header.ENV2R4, level: header.ENV2L4 },
  ];
}

const AKAI_FILTER_ENV_RATE_FIELDS = ['ENV2R1', 'ENV2R2', 'ENV2R3', 'ENV2R4'] as const;
const AKAI_FILTER_ENV_LEVEL_FIELDS = ['ENV2L1', 'ENV2L2', 'ENV2L3', 'ENV2L4'] as const;

export function KeygroupFilterPanel({
  header,
  num,
  onParameterChange,
  onDragChange,
  onCommitHeader,
}: KeygroupFilterPanelProps): JSX.Element {
  return (
    <div className="ac-panel-stack">
      <AcEnvelope
        kind="multi-segment"
        label="TVF · 4-SEGMENT"
        totalSegments={4}
        segments={akaiFilterEnvSegments(header)}
        maxTime={99}
        maxLevel={99}
        sustainSegment={4}
        endSegment={4}
        activeSegment={null}
        onTimeChange={(segIndex, time) => {
          const field = AKAI_FILTER_ENV_RATE_FIELDS[segIndex - 1];
          if (onDragChange) onDragChange(field, time);
          else onParameterChange(field, time);
        }}
        onLevelChange={(segIndex, level) => {
          const field = AKAI_FILTER_ENV_LEVEL_FIELDS[segIndex - 1];
          if (onDragChange) onDragChange(field, level);
          else onParameterChange(field, level);
        }}
        onCommit={onCommitHeader}
      />

      <AcFrequencyResponse
        label="FILTER · LPF"
        frequency={filfrqToHz(header.FILFRQ)}
        resonance={header.FILQ}
        filterType="lowpass"
        freqRange={AKAI_FILTER_FREQ_HZ_RANGE}
        resonanceRange={AKAI_FILTER_RESONANCE_RANGE}
        onChange={(changes) => {
          // dispatchAkaiFilterChange rounds + clamps both FILFRQ and
          // FILQ before forwarding into the integer device fields.
          // AcFrequencyResponse emits floats during drag; without
          // this adapter boundary the floats leak into header
          // writes. See AUDIT-20260524-14.
          const dispatch = onDragChange ?? ((f: string, v: number) => onParameterChange(f, v));
          dispatchAkaiFilterChange(changes, dispatch);
        }}
        onCommit={onCommitHeader}
      />

      <div className="ac-param-rows">
        <S3kParamRow label="Cutoff" value={header.FILFRQ} min={0} max={99} onChange={num('FILFRQ')} />
        <S3kParamRow label="Resonance" value={header.FILQ} min={0} max={15} onChange={num('FILQ')} />
        <S3kParamRow label="Key Track" value={header.K_FREQ} min={-50} max={50} onChange={num('K_FREQ')} bipolar />
        <S3kParamRow label="Vel → cutoff" value={header.MODVFILT1} min={-50} max={50} onChange={num('MODVFILT1')} bipolar />
        <S3kParamRow label="LFO → cutoff" value={header.MODVFILT2} min={-50} max={50} onChange={num('MODVFILT2')} bipolar />
        <S3kParamRow label="Env → cutoff" value={header.MODVFILT3} min={-50} max={50} onChange={num('MODVFILT3')} bipolar />
        <S3kParamRow label="Env R1" value={header.ENV2R1} min={0} max={99} onChange={num('ENV2R1')} />
        <S3kParamRow label="Env L1" value={header.ENV2L1} min={0} max={99} onChange={num('ENV2L1')} />
        <S3kParamRow label="Env R2" value={header.ENV2R2} min={0} max={99} onChange={num('ENV2R2')} />
        <S3kParamRow label="Env L2" value={header.ENV2L2} min={0} max={99} onChange={num('ENV2L2')} />
        <S3kParamRow label="Env R3" value={header.ENV2R3} min={0} max={99} onChange={num('ENV2R3')} />
        <S3kParamRow label="Env L3" value={header.ENV2L3} min={0} max={99} onChange={num('ENV2L3')} />
        <S3kParamRow label="Env R4" value={header.ENV2R4} min={0} max={99} onChange={num('ENV2R4')} />
        <S3kParamRow label="Env L4" value={header.ENV2L4} min={0} max={99} onChange={num('ENV2L4')} />
        <S3kParamRow label="Vel → Env atk" value={header.V_ATT2} min={-50} max={50} onChange={num('V_ATT2')} bipolar />
        <S3kParamRow label="Vel → Env rel" value={header.V_REL2} min={-50} max={50} onChange={num('V_REL2')} bipolar />
        <S3kParamRow label="OffVel → Env rel" value={header.O_REL2} min={-50} max={50} onChange={num('O_REL2')} bipolar />
        <S3kParamRow label="Key → D/R" value={header.K_DAR2} min={-50} max={50} onChange={num('K_DAR2')} bipolar />
        <S3kParamRow label="Vel → Env amt" value={header.V_ENV2} min={-50} max={50} onChange={num('V_ENV2')} bipolar />
      </div>
    </div>
  );
}
