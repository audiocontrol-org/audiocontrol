/**
 * Shared drag helpers for AcEnvelope's two variants (multi-segment +
 * adsr). Both variants implement the same setPointerCapture / try-catch /
 * releasePointerCapture boilerplate around a per-frame pointer-position
 * calculation; the helpers below centralize that boilerplate so the
 * variant-specific code only spells out the value math.
 *
 * Extracted in akai-harmonization Phase 2 task 2.2 (AcEnvelope kind:
 * 'adsr' variant landing) to keep the new AcEnvelopeAdsr component and
 * the existing AcEnvelopeGraph component from sharing inline clones the
 * clone-detector would (correctly) flag.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Pointer position expressed as percentages of the canvas dimensions. */
export interface CanvasPointer {
  /** 0..100 across the canvas width. */
  readonly xPct: number;
  /** 0..100 down the canvas height. */
  readonly yPct: number;
}

/**
 * Best-effort `setPointerCapture` that swallows the synthetic-event
 * throw seen in jsdom + some browsers. Returns true on capture; false
 * if no capture could be acquired (callers can rely on a global fallback
 * path in that case).
 */
export function tryCapturePointer(
  e: ReactPointerEvent<HTMLButtonElement>,
): boolean {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort `releasePointerCapture` that swallows the throw when no
 * capture is active (jsdom + some browsers). Always safe to call from a
 * pointerup / pointercancel handler.
 */
export function tryReleasePointer(
  e: ReactPointerEvent<HTMLButtonElement>,
): void {
  try {
    e.currentTarget.releasePointerCapture(e.pointerId);
  } catch {
    /* no capture active; release is a no-op */
  }
}

/**
 * Convert a pointer event to canvas-local percentages, given a canvas
 * `<div>` ref. Returns null when the canvas hasn't measured yet (no
 * bounding rect or zero dimensions); callers should bail in that case.
 */
export function pointerToCanvasPct(
  canvas: HTMLElement | null,
  e: ReactPointerEvent<HTMLButtonElement>,
): CanvasPointer | null {
  if (canvas === null) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  return {
    xPct: ((e.clientX - rect.left) / rect.width) * 100,
    yPct: ((e.clientY - rect.top) / rect.height) * 100,
  };
}

/**
 * Clamp + integer-round a parameter value into [0, maxValue]. Throws on
 * NaN/Infinity so a corrupt prop fails loud at first paint.
 */
export function clampEnvelopeParam(
  value: number,
  maxValue: number,
  paramName: string,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${paramName} received non-finite parameter: ${value}`);
  }
  if (value < 0) {
    return 0;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return Math.round(value);
}
