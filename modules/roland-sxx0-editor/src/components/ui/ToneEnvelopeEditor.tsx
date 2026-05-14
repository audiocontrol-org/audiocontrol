/**
 * ToneEnvelopeEditor — Phase 9 Task 4 envelope editor (TonesPage amend).
 *
 * Composes the v3 `AcEnvelope` (graph + meta-pip radios + readout table
 * from editor-core, commits 2c078954 + fc3bac98) with an inline edit grid
 * for per-segment Rate + Level. AcEnvelope is display-only by design
 * (mockup source 04-tones.html:1786-1862 + 2737-2832); editing happens
 * in the grid below.
 *
 * Mapping `SamplerEnvelope` ↔ `AcEnvelope`:
 *   - segments[i].time  ← rates[i]   (S-series "rate" is the per-segment
 *                                     time advance; 1 = slowest, 127 = fastest)
 *   - segments[i].level ← levels[i]
 *   - sustainSegment    ← sustainPoint + 1   (UI is 1-based, store is 0-based)
 *   - endSegment        ← endPoint           (already 1-based, 1..8)
 *
 * Sustain + End edits route through AcEnvelope's pip-radio rows
 * (`AcEnvelopeMeta`, with full WAI-ARIA radiogroup keyboard pattern). The
 * old `<select>` controls are replaced by the pips — per project memory
 * `feedback_envelope_pattern`, the 8-segment VFD-glow envelope IS the
 * v3 surface.
 *
 * Edit-grid data attributes:
 *   - `[data-edit-row="rate"] input` — row of 8 rate inputs
 *   - `[data-edit-row="level"] input` — row of 8 level inputs
 * The capability spec helper `fillEnvelopeFirstCell` targets these.
 */

import type { SamplerEnvelope } from '@/core/midi/SamplerClient';
import { AcEnvelope, type AcEnvelopeSegment } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';

interface ToneEnvelopeEditorProps {
  envelope: SamplerEnvelope;
  onChange: (envelope: SamplerEnvelope) => void;
  /**
   * Called after a value change should be committed to the device. The
   * latest envelope value is passed explicitly so the panel-level handler
   * can synthesize the full tone the device-write contract expects.
   * Mirrors the sibling-handler pattern in TonePitchPanel / ToneAmpPanel
   * etc. where each commit handler builds `updatedTone` and passes it
   * through — avoids the implicit "commit reads from store" coupling that
   * future async store updates could silently break.
   */
  onCommit?: (envelope: SamplerEnvelope) => void;
  label: string;
  disabled?: boolean;
}

export function ToneEnvelopeEditor({
  envelope,
  onChange,
  onCommit,
  label,
  disabled = false,
}: ToneEnvelopeEditorProps) {
  const { levels, rates, sustainPoint, endPoint } = envelope;

  // Build the segments array AcEnvelope expects from the S-series store
  // shape. Slice to endSegment is handled internally by AcEnvelope.
  const segments: AcEnvelopeSegment[] = rates.map((rate, i) => ({
    time: rate,
    level: levels[i],
  }));

  const updateRate = (index: number, raw: number) => {
    const next = Math.max(1, Math.min(127, raw));
    const newRates = [...rates] as SamplerEnvelope['rates'];
    newRates[index] = next;
    onChange({ ...envelope, rates: newRates });
  };

  const updateLevel = (index: number, raw: number) => {
    const next = Math.max(0, Math.min(127, raw));
    const newLevels = [...levels] as SamplerEnvelope['levels'];
    newLevels[index] = next;
    onChange({ ...envelope, levels: newLevels });
  };

  // Sustain + End come from pip clicks. The UI is 1-based; the store is
  // 0-based for sustainPoint, 1-based for endPoint. We also clamp sustain
  // to be < endPoint and reclamp on endPoint change.
  const handleSustainChange = (uiIndex: number) => {
    const storedSustain = Math.max(0, Math.min(uiIndex - 1, endPoint - 1));
    const next = { ...envelope, sustainPoint: storedSustain };
    onChange(next);
    onCommit?.(next);
  };

  const handleEndChange = (uiEnd: number) => {
    const clampedEnd = Math.max(1, Math.min(8, uiEnd));
    const reclampedSustain = Math.min(sustainPoint, clampedEnd - 1);
    const next = {
      ...envelope,
      endPoint: clampedEnd,
      sustainPoint: reclampedSustain,
    };
    onChange(next);
    onCommit?.(next);
  };

  // The AcEnvelope `disabled` prop (added by the fix-up dispatch) is the
  // canonical disabled gate: it removes pip tab stops and adds the native
  // HTML `disabled` attribute to graph/table buttons. The wrapper keeps
  // `opacity-50` for the visual dim cue only — no `pointer-events-none`,
  // which would block mouse but leak keyboard interaction.
  return (
    <div className={cn('space-y-3', disabled && 'opacity-50')}>
      <AcEnvelope
        label={`${label} · 8-SEGMENT`}
        segments={segments}
        sustainSegment={sustainPoint + 1}
        endSegment={endPoint}
        activeSegment={sustainPoint + 1}
        onSustainChange={handleSustainChange}
        onEndChange={handleEndChange}
        onTimeChange={(segmentIndex, time) => updateRate(segmentIndex - 1, time)}
        onLevelChange={(segmentIndex, level) => updateLevel(segmentIndex - 1, level)}
        disabled={disabled}
      />

      {/* Inline edit grid — preserves the live numeric-editing affordance
          that AcEnvelope's display-only table cannot offer. Rate (1..127)
          and Level (0..127) per segment, in two rows of 8 inputs. The
          `data-edit-row` attribute is the spec-helper anchor. The current
          `envelope` prop reflects the latest streaming value (the panel
          calls `onUpdate` on every keystroke), so onBlur commits with it. */}
      <div className="tones__envelope-edit-grid">
        <div className="tones__envelope-edit-row" data-edit-row="rate">
          <span className="ac-field-label">Rate</span>
          {rates.map((rate, i) => (
            <input
              key={i}
              type="number"
              min={1}
              max={127}
              value={rate}
              onChange={(e) => updateRate(i, Number(e.target.value))}
              onBlur={() => onCommit?.(envelope)}
              className="ac-input ac-input-sm ac-input-center"
              disabled={disabled || i >= endPoint}
              aria-label={`${label} rate segment ${i + 1}`}
            />
          ))}
        </div>
        <div className="tones__envelope-edit-row" data-edit-row="level">
          <span className="ac-field-label">Level</span>
          {levels.map((level, i) => (
            <input
              key={i}
              type="number"
              min={0}
              max={127}
              value={level}
              onChange={(e) => updateLevel(i, Number(e.target.value))}
              onBlur={() => onCommit?.(envelope)}
              className="ac-input ac-input-sm ac-input-center"
              disabled={disabled || i >= endPoint}
              aria-label={`${label} level segment ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
