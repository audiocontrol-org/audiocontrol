import { useState, useCallback, useEffect } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { percentToNote, clampVelocity } from '@/components/keygroups/note-coordinate-utils';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import type { ZoneDragField } from '@/components/keygroups/use-zone-drag';

export interface NewZoneRange {
  lowNote: number;
  highNote: number;
  lowVel: number;
  highVel: number;
}

interface CreationDragState {
  startNote: number;
  startVel: number;
  currentNote: number;
  currentVel: number;
}

interface TranslateDragState {
  keygroupIndex: number;
  startNote: number;
  originalLONOTE: number;
  originalHINOTE: number;
}

interface UseZoneOverviewDragsOptions {
  vizRef: React.RefObject<HTMLDivElement | null>;
  noteRange: NoteRange;
  keygroups: (KeygroupHeader | undefined)[];
  hasDragCallbacks: boolean;
  onZoneDrag?: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
  onZoneCommit?: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
  onCreateZone?: (range: NewZoneRange) => void;
}

function useNoteFromEvent(
  vizRef: React.RefObject<HTMLDivElement | null>,
  noteRange: NoteRange,
): (e: MouseEvent) => number {
  return useCallback(
    (e: MouseEvent): number => {
      const el = vizRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      return percentToNote(percent, noteRange);
    },
    [vizRef, noteRange],
  );
}

function useVelocityFromEvent(
  vizRef: React.RefObject<HTMLDivElement | null>,
): (e: MouseEvent) => number {
  return useCallback(
    (e: MouseEvent): number => {
      const el = vizRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return clampVelocity(Math.round(127 * (1 - (e.clientY - rect.top) / rect.height)));
    },
    [vizRef],
  );
}

export function useZoneOverviewDrags({
  vizRef,
  noteRange,
  keygroups,
  hasDragCallbacks,
  onZoneDrag,
  onZoneCommit,
  onCreateZone,
}: UseZoneOverviewDragsOptions) {
  const [creationDrag, setCreationDrag] = useState<CreationDragState | null>(null);
  const [translateDrag, setTranslateDrag] = useState<TranslateDragState | null>(null);

  const getNoteFromEvent = useNoteFromEvent(vizRef, noteRange);
  const getVelocityFromEvent = useVelocityFromEvent(vizRef);

  // --- Creation drag ---
  const handleVizMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onCreateZone) return;
      if (e.button !== 0) return;
      const note = getNoteFromEvent(e.nativeEvent);
      const vel = getVelocityFromEvent(e.nativeEvent);
      setCreationDrag({ startNote: note, startVel: vel, currentNote: note, currentVel: vel });
    },
    [onCreateZone, getNoteFromEvent, getVelocityFromEvent],
  );

  useEffect(() => {
    if (!creationDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const note = getNoteFromEvent(e);
      const vel = getVelocityFromEvent(e);
      setCreationDrag((prev) =>
        prev ? { ...prev, currentNote: note, currentVel: vel } : null,
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      setCreationDrag((current) => {
        if (current && onCreateZone) {
          const note = getNoteFromEvent(e);
          const vel = getVelocityFromEvent(e);
          const lowNote = Math.min(current.startNote, note);
          const highNote = Math.max(current.startNote, note);
          const lowVel = Math.min(current.startVel, vel);
          const highVel = Math.max(current.startVel, vel);
          if (highNote > lowNote || highVel > lowVel) {
            onCreateZone({ lowNote, highNote, lowVel, highVel });
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [creationDrag, getNoteFromEvent, getVelocityFromEvent, onCreateZone]);

  // --- Translate drag ---
  const handleStartTranslate = useCallback(
    (keygroupIndex: number, e: React.MouseEvent) => {
      if (!hasDragCallbacks) return;
      e.preventDefault();
      const kg = keygroups[keygroupIndex];
      if (!kg) return;
      const startNote = getNoteFromEvent(e.nativeEvent);
      setTranslateDrag({
        keygroupIndex,
        startNote,
        originalLONOTE: kg.LONOTE,
        originalHINOTE: kg.HINOTE,
      });
    },
    [hasDragCallbacks, keygroups, getNoteFromEvent],
  );

  useEffect(() => {
    if (!translateDrag) return;

    const computeNewRange = (currentNote: number) => {
      const delta = currentNote - translateDrag.startNote;
      const rangeSize = translateDrag.originalHINOTE - translateDrag.originalLONOTE;
      let newLo = translateDrag.originalLONOTE + delta;
      let newHi = translateDrag.originalHINOTE + delta;
      if (newLo < 0) { newLo = 0; newHi = rangeSize; }
      if (newHi > 127) { newHi = 127; newLo = 127 - rangeSize; }
      return { newLo, newHi };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { newLo, newHi } = computeNewRange(getNoteFromEvent(e));
      if (onZoneDrag) {
        onZoneDrag(translateDrag.keygroupIndex, 'LONOTE', newLo);
        onZoneDrag(translateDrag.keygroupIndex, 'HINOTE', newHi);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const { newLo, newHi } = computeNewRange(getNoteFromEvent(e));
      if (onZoneCommit) {
        onZoneCommit(translateDrag.keygroupIndex, 'LONOTE', newLo);
        onZoneCommit(translateDrag.keygroupIndex, 'HINOTE', newHi);
      }
      setTranslateDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [translateDrag, getNoteFromEvent, onZoneDrag, onZoneCommit]);

  return {
    creationDrag,
    translateDrag,
    getNoteFromEvent,
    getVelocityFromEvent,
    handleVizMouseDown,
    handleStartTranslate,
  };
}
