/**
 * AcLiveStatusFooter — canonical live-editing footer for parameter-streaming
 * editor pages.
 *
 * Both the roland S-330/S-550 editor and the akai S3000XL editor stream
 * parameter edits to the device on every change (no save/cancel/undo).
 * Per project memories `feedback_live_editing_no_save` and
 * `feedback_rec_led_accent`, every such editing page surfaces a slim
 * footer at the bottom of the detail column:
 *
 *     ● LIVE · writing to S3000XL · last edit 0.4s ago
 *
 * The rec-LED indicator (small filled circle, `--ac-color-rec` token) is
 * the device-active indicator — NEVER used for danger. The status text
 * updates via an internal 100ms tick so the "X.Xs ago" elapsed-time
 * readout stays current without the parent component re-rendering.
 *
 * The component is intentionally PRESENTATIONAL — the consumer owns the
 * `lastEditAt` timestamp; the consumer updates it via
 * `setLastEditAt(Date.now())` in its parameter-change handler. The footer
 * itself does not subscribe to any store, hook, or device-state — it
 * renders exactly what its props say.
 *
 * State precedence:
 *   - `state="error"` → renders `errorMessage` in danger styling.
 *   - `state="offline"` → renders muted "OFFLINE · device disconnected".
 *   - `state="live"` (default):
 *       - `lastEditAt === null` → renders "READY · {deviceLabel} connected"
 *       - `lastEditAt !== null` → renders "LIVE · writing to {deviceLabel} ·
 *         last edit X.Xs ago"; the X.Xs portion is driven by an internal
 *         tick.
 *
 * ARIA: footer is `role="status"` + `aria-live="polite"` so screen readers
 * announce edit confirmations without interrupting other speech.
 */

import { useEffect, useState } from 'react';

export interface AcLiveStatusFooterProps {
  /** Device name shown in the live status text, e.g. "S3000XL" / "S-330" / "S-550". */
  deviceLabel: string;
  /**
   * Timestamp (ms since epoch) of the most recent parameter edit, or null
   * if no edits yet. The footer updates its "last edit X s ago" text via
   * an internal 100ms tick when this is non-null. When null AND
   * state='live', the footer renders a "ready" state.
   */
  lastEditAt: number | null;
  /**
   * Status state. Defaults to 'live' when the device is connected.
   * 'offline' renders a muted "OFFLINE · device disconnected" instead of
   * the live text. 'error' renders the errorMessage in danger styling.
   */
  state?: 'live' | 'offline' | 'error';
  /** Error text shown when state='error'. Required if state='error'; ignored otherwise. */
  errorMessage?: string;
  /** Optional className appended to the footer root. */
  className?: string;
}

const TICK_INTERVAL_MS = 100;

/**
 * Format elapsed milliseconds as a human-readable "ago" string.
 *
 *   < 60_000 ms → "0.4s ago" / "12.3s ago" (fractional seconds)
 *   ≥ 60_000 ms → "1m 23s ago" (minutes + integer seconds)
 *   ≥ 3_600_000 ms → "1h 02m ago" (hours + integer minutes)
 */
function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < 0) return '0.0s ago';
  if (elapsedMs < 60_000) {
    const seconds = elapsedMs / 1000;
    return `${seconds.toFixed(1)}s ago`;
  }
  if (elapsedMs < 3_600_000) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s ago`;
  }
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ago`;
}

export function AcLiveStatusFooter({
  deviceLabel,
  lastEditAt,
  state = 'live',
  errorMessage,
  className,
}: AcLiveStatusFooterProps): JSX.Element {
  // `now` drives the elapsed-time readout. Only ticks when the footer is
  // in 'live' state AND `lastEditAt` is non-null — no idle CPU otherwise.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (state !== 'live' || lastEditAt === null) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state, lastEditAt]);

  const rootClassName = className
    ? `ac-live-status-footer ${className}`
    : 'ac-live-status-footer';

  let statusText: string;
  if (state === 'error') {
    statusText = errorMessage ?? 'ERROR';
  } else if (state === 'offline') {
    statusText = 'OFFLINE · device disconnected';
  } else if (lastEditAt === null) {
    statusText = `READY · ${deviceLabel} connected`;
  } else {
    const elapsed = now - lastEditAt;
    statusText = `LIVE · writing to ${deviceLabel} · last edit ${formatElapsed(elapsed)}`;
  }

  return (
    <div
      className={rootClassName}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <span className="ac-live-status-footer__led" aria-hidden="true" />
      <span className="ac-live-status-footer__text">{statusText}</span>
    </div>
  );
}
