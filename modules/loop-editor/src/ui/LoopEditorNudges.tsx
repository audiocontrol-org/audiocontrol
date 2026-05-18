/**
 * Loop-editor nudge controls — End / Loop point numeric inputs with «‹›»
 * stepper buttons. Styled by `loop-editor-primitives.css`.
 *
 * Testids preserved: `end-point-input`, `loop-point-input` (consumed by
 * the loop-editor-production e2e suite + tone-loop wiring tests).
 */

export interface LoopEditorNudgesProps {
  endPoint: number;
  loopPoint: number;
  startPoint: number;
  onEndPointChange?: (next: number) => void;
  onLoopPointChange?: (next: number) => void;
  onCommit?: () => void;
  nudgeEndPoint: (delta: number) => void;
  nudgeLoopPoint: (delta: number) => void;
}

export function LoopEditorNudges({
  endPoint,
  loopPoint,
  startPoint,
  onEndPointChange,
  onLoopPointChange,
  onCommit,
  nudgeEndPoint,
  nudgeLoopPoint,
}: LoopEditorNudgesProps): JSX.Element {
  return (
    <div className="ac-loop-nudges">
      <div className="ac-loop-nudge-field">
        <label className="ac-field-label">End Point</label>
        <div className="ac-loop-nudge-row">
          <button onClick={() => nudgeEndPoint(-100)} className="ac-icon-btn" title="Move end point -100 samples" aria-label="Move end point -100 samples">«</button>
          <button onClick={() => nudgeEndPoint(-1)} className="ac-icon-btn" title="Move end point -1 sample" aria-label="Move end point -1 sample">‹</button>
          <input
            type="number"
            value={endPoint}
            onChange={(e) => { onEndPointChange?.(Math.max(loopPoint, parseInt(e.target.value) || 0)); }}
            onBlur={() => onCommit?.()}
            className="ac-input"
            data-testid="end-point-input"
          />
          <button onClick={() => nudgeEndPoint(1)} className="ac-icon-btn" title="Move end point +1 sample" aria-label="Move end point +1 sample">›</button>
          <button onClick={() => nudgeEndPoint(100)} className="ac-icon-btn" title="Move end point +100 samples" aria-label="Move end point +100 samples">»</button>
        </div>
      </div>
      <div className="ac-loop-nudge-field">
        <label className="ac-field-label">Loop Point</label>
        <div className="ac-loop-nudge-row">
          <button onClick={() => nudgeLoopPoint(-100)} className="ac-icon-btn" title="Move loop point -100 samples" aria-label="Move loop point -100 samples">«</button>
          <button onClick={() => nudgeLoopPoint(-1)} className="ac-icon-btn" title="Move loop point -1 sample" aria-label="Move loop point -1 sample">‹</button>
          <input
            type="number"
            value={loopPoint}
            onChange={(e) => { onLoopPointChange?.(Math.min(endPoint, Math.max(startPoint, parseInt(e.target.value) || 0))); }}
            onBlur={() => onCommit?.()}
            className="ac-input"
            data-testid="loop-point-input"
          />
          <button onClick={() => nudgeLoopPoint(1)} className="ac-icon-btn" title="Move loop point +1 sample" aria-label="Move loop point +1 sample">›</button>
          <button onClick={() => nudgeLoopPoint(100)} className="ac-icon-btn" title="Move loop point +100 samples" aria-label="Move loop point +100 samples">»</button>
        </div>
      </div>
    </div>
  );
}
