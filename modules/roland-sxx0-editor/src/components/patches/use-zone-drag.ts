/**
 * useZoneDrag — pointer-driven drag-resize for zone bar segments.
 *
 * The hook tracks drag state for one of the two edge handles on a
 * zone segment and exposes a "draft" zones array that callers
 * render in place of the committed zones during the drag. On
 * pointer-up, the hook fires `onCommit(zones)` once with the final
 * shape and resets state.
 *
 * Commit cadence: drag emits exactly one `onCommit` on pointer-up.
 * Per-tick `onCommit` calls would fire ~100 sendPatchData writes
 * during a smooth drag, which is the wrong shape for the SysEx
 * round-trip path. The draft state keeps the UI live; the device
 * write happens once at the drag boundary.
 *
 * Listener lifecycle: window-level pointermove/pointerup listeners
 * are attached synchronously inside startDrag (not via a useEffect
 * that watches `dragging`). The useEffect approach would race with
 * fast pointer-down→pointer-move sequences: React's state flush +
 * effect mount happen on the next microtask, so a pointer-move
 * that fires in the same frame as pointer-down would arrive before
 * the listener exists.
 */

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';
import {
  MIN_KEY,
  MAX_KEY,
  TOTAL_KEYS,
  type ToneZone,
} from './tone-zone-utils';

export type ZoneDragHandle = 'start' | 'end';

interface UseZoneDragOptions {
  zones: ToneZone[];
  barRef: React.RefObject<HTMLDivElement>;
  onCommit: (zones: ToneZone[]) => void;
}

interface ZoneDragApi {
  /** Draft override for the rendered zones during an active drag.
   *  `null` when no drag is in progress (renderer falls back to
   *  the committed zones). */
  draftZones: ToneZone[] | null;
  /** Which zone+handle is being dragged, or null. The editor uses
   *  this to render a "dragging" modifier and to suppress the
   *  zone segment's click handler. */
  dragging: { zoneIndex: number; handle: ZoneDragHandle } | null;
  startDrag: (
    e: ReactPointerEvent<HTMLElement>,
    zoneIndex: number,
    handle: ZoneDragHandle,
  ) => void;
}

function clientXToKey(clientX: number, rect: DOMRect): number {
  const x = clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, x / rect.width));
  return MIN_KEY + Math.round(ratio * (TOTAL_KEYS - 1));
}

export function useZoneDrag({ zones, barRef, onCommit }: UseZoneDragOptions): ZoneDragApi {
  const [draftZones, setDraftZones] = useState<ToneZone[] | null>(null);
  const [dragging, setDragging] = useState<{ zoneIndex: number; handle: ZoneDragHandle } | null>(null);

  // Track the latest draft in a ref so the pointer-up listener
  // (closed over at drag-start) reads the freshest value.
  const draftRef = useRef<ToneZone[] | null>(null);

  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>, zoneIndex: number, handle: ZoneDragHandle) => {
      const bar = barRef.current;
      if (!bar) return;
      e.preventDefault();
      e.stopPropagation();

      const barRect = bar.getBoundingClientRect();
      const baseZones = zones;
      // Initialize the draft to a fresh snapshot of the committed
      // zones so the renderer has something to show before the
      // first pointermove fires.
      draftRef.current = baseZones;
      setDraftZones(baseZones);
      setDragging({ zoneIndex, handle });

      const apply = (clientX: number) => {
        const next = baseZones.map((z, i) => {
          if (i !== zoneIndex) return z;
          const key = clientXToKey(clientX, barRect);
          if (handle === 'start') {
            return { ...z, startKey: Math.max(MIN_KEY, Math.min(key, z.endKey)) };
          }
          return { ...z, endKey: Math.min(MAX_KEY, Math.max(key, z.startKey)) };
        });
        draftRef.current = next;
        setDraftZones(next);
      };

      const handleMove = (ev: PointerEvent) => {
        ev.preventDefault();
        apply(ev.clientX);
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        const finalZones = draftRef.current;
        draftRef.current = null;
        setDraftZones(null);
        setDragging(null);
        if (finalZones) onCommit(finalZones);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);

      // Capture so the handle keeps receiving move events even
      // when the pointer leaves its hit area.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [barRef, zones, onCommit],
  );

  return { draftZones, dragging, startDrag };
}
