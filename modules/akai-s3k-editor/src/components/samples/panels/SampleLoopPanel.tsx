/**
 * `<SampleLoopPanel>` — body content for the SampleEditor "Loop" tab
 * (mockup `mockups/samples.html:162-204`).
 *
 * The Loop tab carries SLOOPS-gated loop sections. Each loop (1..4)
 * gets a Loop Start / Loop Length / Dwell row trio when SLOOPS >=
 * that loop index. The previous flat layout's Loop 1..4 sections fold
 * into this one tab; loops are only revealed when the device says
 * they exist (SLOOPS controls visibility per the device contract).
 *
 * Extracted from `SampleEditor.tsx` 2026-05-25 per AUDIT-20260525-25.
 */

import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import { S3kParamRow } from '@/components/ui/S3kParamRow';

export interface SampleLoopPanelProps {
  header: SampleHeader;
  num: (field: string) => (value: number) => void;
}

function LoopRows({
  loopNumber,
  loopAt,
  loopLength,
  dwell,
  maxLength,
  num,
}: {
  loopNumber: number;
  loopAt: number;
  loopLength: number;
  dwell: number;
  maxLength: number;
  num: (field: string) => (value: number) => void;
}): JSX.Element {
  return (
    <>
      <S3kParamRow label={`Loop ${loopNumber} start`} value={loopAt} min={0} max={maxLength} onChange={num(`LOOPAT${loopNumber}`)} />
      <S3kParamRow label={`Loop ${loopNumber} length`} value={loopLength} min={0} max={maxLength} onChange={num(`LLNGTH${loopNumber}`)} />
      <S3kParamRow label={`Loop ${loopNumber} dwell`} value={dwell} min={0} max={9999} onChange={num(`LDWELL${loopNumber}`)} />
    </>
  );
}

export function SampleLoopPanel({
  header,
  num,
}: SampleLoopPanelProps): JSX.Element {
  if (header.SLOOPS === 0) {
    return (
      <div className="ac-panel-stack">
        <div className="ac-compact-grid">
          <div className="ac-compact-field ac-compact-field--readout">
            <span className="ac-field-label">Loops</span>
            <span className="ac-field-readout">No loops on this sample</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="ac-panel-stack">
      <div className="ac-param-rows">
        {header.SLOOPS >= 1 && (
          <LoopRows
            loopNumber={1}
            loopAt={header.LOOPAT1}
            loopLength={header.LLNGTH1}
            dwell={header.LDWELL1}
            maxLength={header.SLNGTH}
            num={num}
          />
        )}
        {header.SLOOPS >= 2 && (
          <LoopRows
            loopNumber={2}
            loopAt={header.LOOPAT2}
            loopLength={header.LLNGTH2}
            dwell={header.LDWELL2}
            maxLength={header.SLNGTH}
            num={num}
          />
        )}
        {header.SLOOPS >= 3 && (
          <LoopRows
            loopNumber={3}
            loopAt={header.LOOPAT3}
            loopLength={header.LLNGTH3}
            dwell={header.LDWELL3}
            maxLength={header.SLNGTH}
            num={num}
          />
        )}
        {header.SLOOPS >= 4 && (
          <LoopRows
            loopNumber={4}
            loopAt={header.LOOPAT4}
            loopLength={header.LLNGTH4}
            dwell={header.LDWELL4}
            maxLength={header.SLNGTH}
            num={num}
          />
        )}
      </div>
    </div>
  );
}
