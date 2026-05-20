/**
 * ToneEditor — detail-head component.
 *
 * Renders the eyebrow row (Tone · Editing · Source · <device>) and
 * the slot+name title row. The action-button cluster (Export to
 * Library / Download Sample / Import Sample / Chop into Drum Kit)
 * that previously lived here was removed 2026-05-19 — those flows
 * are operator-owned by the library page now, and the title row is
 * the same shape as PatchEditor's by design (shared `.ac-detail-*`
 * primitives in `_shared.css`).
 *
 * Existing `data-testid` on the name input is preserved verbatim so
 * `tone-writes.spec.ts` D-TONE-WAVE-01 (tone name commit path) keeps
 * working.
 */

import { type SamplerTone } from '@/core/midi/SamplerClient';
import { formatS330Number } from '@/lib/utils';

interface ToneEditorHeadProps {
  tone: SamplerTone;
  index: number;
  deviceName: string;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneEditorHead({
  tone,
  index,
  deviceName,
  onUpdate,
  onCommit,
}: ToneEditorHeadProps) {
  return (
    <header className="ac-detail-head">
      <div className="ac-detail-eyebrow-row">
        <span>Tone</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span className="ac-detail-eyebrow-accent">Editing</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>Source · {deviceName}</span>
      </div>

      <h3 className="ac-detail-title">
        <span className="ac-detail-slot">T{formatS330Number(index)}</span>
        <input
          type="text"
          value={tone.name}
          onChange={(e) => onUpdate?.({ ...tone, name: e.target.value.slice(0, 8) })}
          onBlur={() => onCommit?.()}
          placeholder="(unnamed)"
          data-testid="tone-name-input"
          maxLength={8}
          className="ac-input ac-detail-name-input"
        />
      </h3>
    </header>
  );
}
