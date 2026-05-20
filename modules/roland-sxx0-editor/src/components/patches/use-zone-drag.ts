/**
 * useZoneDrag — pointer-driven drag-resize for zone bar segments.
 *
 * Drag mechanics:
 *   - pointer-down on a handle: capture pointer + register window
 *     pointer-move / pointer-up listeners synchronously.
 *   - pointer-move: map clientX through the bar's bounding rect to
 *     a key index, compute the edited zone's new bounds, then
 *     resolve overlaps against other zones (clip / remove) so the
 *     dragged zone always wins. The draft state holds the post-
 *     resolution zones list and is rendered in place of the
 *     committed zones during the drag.
 *   - pointer-up: fire `onCommit(finalZones, draggedSnapshot)`
 *     exactly once with the post-resolution list + the dragged
 *     zone's final bounds. Caller persists and updates its own
 *     selection state.
 *
 * Overlap resolution: when the dragged zone's new range overlaps
 * another zone, the other zone is clipped or removed so the
 * dragged zone occupies the contested keys. Without this step,
 * `zonesToArray` would write the dragged zone before any later-
 * list zones (or vice-versa) and the array round-trip would
 * either silently merge them (same tone) or let the later list
 * entry win (different tone) — both produce surprising behavior
 * when the user is actively trying to push one zone into another.
 *
 * Listener lifecycle: the move/up listeners are bound
 * synchronously inside `startDrag` (not via a useEffect that
 * watches `dragging`). The useEffect approach races with fast
 * pointer-down → pointer-move sequences in the same frame.
 */

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';
import {
  MIN_KEY,
  MAX_KEY,
  TOTAL_KEYS,
  type ToneZone,
} from './tone-zone-utils';

export type ZoneDragHandle = 'start' | 'end';

export interface ZoneDragCommit {
  zones: ToneZone[];
  /** The dragged zone's final bounds (its bounds in `zones`). The
   *  caller uses this to locate the dragged zone in the post-commit
   *  zones list (arrayToZones may re-order, merge, or split it
   *  during the toneData normalization). */
  draggedZone: ToneZone;
}

interface UseZoneDragOptions {
  zones: ToneZone[];
  barRef: React.RefObject<HTMLDivElement>;
  onCommit: (commit: ZoneDragCommit) => void;
}

interface ZoneDragApi {
  /** Draft override for the rendered zones during an active drag.
   *  `null` when no drag is in progress. */
  draftZones: ToneZone[] | null;
  /** Index of the dragged zone within draftZones (the post-
   *  resolution list). The editor uses this for the editing form
   *  during a drag so the form tracks the dragged zone even when
   *  other zones get removed from the list. */
  draftDraggedIndex: number | null;
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

/**
 * Walk the zones list, replacing the edited zone at `editedIndex`
 * with `edited` and clipping/removing other zones that overlap
 * the edited range. Returns the resolved list plus the dragged
 * zone's new index (accounting for any removals BEFORE it).
 */
function resolveDragOverlap(
  zones: ToneZone[],
  editedIndex: number,
  edited: ToneZone,
): { next: ToneZone[]; newIndex: number } {
  const ds = edited.startKey;
  const de = edited.endKey;
  let removedBefore = 0;
  const next: ToneZone[] = [];

  zones.forEach((z, i) => {
    if (i === editedIndex) {
      next.push(edited);
      return;
    }
    // No overlap with the edited range — keep as-is.
    if (z.endKey < ds || z.startKey > de) {
      next.push(z);
      return;
    }
    // z is fully engulfed by edited — drop it.
    if (z.startKey >= ds && z.endKey <= de) {
      if (i < editedIndex) removedBefore++;
      return;
    }
    // edited is fully engulfed by z (rare drag shape) — clip z to
    // its lower portion. Splitting z into low+high segments would
    // be the maximalist response; clipping is the conservative one
    // and keeps the zones-list arity stable.
    if (z.startKey < ds && z.endKey > de) {
      next.push({ ...z, endKey: ds - 1 });
      return;
    }
    // z overlaps from above the edited range — push its start past
    // the dragged zone's end.
    if (z.startKey >= ds) {
      next.push({ ...z, startKey: de + 1 });
      return;
    }
    // z overlaps from below the edited range — pull its end before
    // the dragged zone's start.
    next.push({ ...z, endKey: ds - 1 });
  });

  return { next, newIndex: editedIndex - removedBefore };
}

export function useZoneDrag({ zones, barRef, onCommit }: UseZoneDragOptions): ZoneDragApi {
  const [draftZones, setDraftZones] = useState<ToneZone[] | null>(null);
  const [draftDraggedIndex, setDraftDraggedIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{ zoneIndex: number; handle: ZoneDragHandle } | null>(null);

  // Refs so the pointer-up handler (closed over at drag-start)
  // reads the freshest draft + dragged-zone snapshot.
  const draftRef = useRef<ToneZone[] | null>(null);
  const draggedRef = useRef<ToneZone | null>(null);

  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>, zoneIndex: number, handle: ZoneDragHandle) => {
      const bar = barRef.current;
      if (!bar) return;
      e.preventDefault();
      e.stopPropagation();

      const barRect = bar.getBoundingClientRect();
      const baseZones = zones;
      const baseDragged = baseZones[zoneIndex];
      if (!baseDragged) return;

      // Initial draft = base zones, no resolution yet.
      draftRef.current = baseZones;
      draggedRef.current = baseDragged;
      setDraftZones(baseZones);
      setDraftDraggedIndex(zoneIndex);
      setDragging({ zoneIndex, handle });

      const apply = (clientX: number) => {
        const key = clientXToKey(clientX, barRect);
        const edited: ToneZone = handle === 'start'
          ? { ...baseDragged, startKey: Math.max(MIN_KEY, Math.min(key, baseDragged.endKey)) }
          : { ...baseDragged, endKey: Math.min(MAX_KEY, Math.max(key, baseDragged.startKey)) };
        const { next, newIndex } = resolveDragOverlap(baseZones, zoneIndex, edited);
        draftRef.current = next;
        draggedRef.current = edited;
        setDraftZones(next);
        setDraftDraggedIndex(newIndex);
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
        const finalDragged = draggedRef.current;
        draftRef.current = null;
        draggedRef.current = null;
        setDraftZones(null);
        setDraftDraggedIndex(null);
        setDragging(null);
        if (finalZones && finalDragged) {
          onCommit({ zones: finalZones, draggedZone: finalDragged });
        }
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);

      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [barRef, zones, onCommit],
  );

  return { draftZones, draftDraggedIndex, dragging, startDrag };
}
