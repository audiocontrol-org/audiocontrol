import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Draggable zone boundary fields.
 * LONOTE/HINOTE for key range, LOVEL1-4/HIVEL1-4 for velocity zone boundaries.
 */
export type ZoneDragField =
  | 'LONOTE'
  | 'HINOTE'
  | 'LOVEL1'
  | 'HIVEL1'
  | 'LOVEL2'
  | 'HIVEL2'
  | 'LOVEL3'
  | 'HIVEL3'
  | 'LOVEL4'
  | 'HIVEL4';

export type VelocityZoneIndex = 1 | 2 | 3 | 4;

const LOVEL_FIELDS: Record<VelocityZoneIndex, ZoneDragField> = {
  1: 'LOVEL1',
  2: 'LOVEL2',
  3: 'LOVEL3',
  4: 'LOVEL4',
};

const HIVEL_FIELDS: Record<VelocityZoneIndex, ZoneDragField> = {
  1: 'HIVEL1',
  2: 'HIVEL2',
  3: 'HIVEL3',
  4: 'HIVEL4',
};

/** Get the LOVEL field name for a velocity zone index (1-4). */
export function lovelField(zoneIndex: VelocityZoneIndex): ZoneDragField {
  return LOVEL_FIELDS[zoneIndex];
}

/** Get the HIVEL field name for a velocity zone index (1-4). */
export function hivelField(zoneIndex: VelocityZoneIndex): ZoneDragField {
  return HIVEL_FIELDS[zoneIndex];
}

export interface ZoneDragCallbacks {
  /** Called continuously during drag with the new value. Update local state here. */
  onDrag: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
  /** Called once on mouseup. Write to device here. */
  onCommit: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
}

export interface ZoneDragState {
  isDragging: boolean;
  activeKeygroupIndex: number | null;
  activeField: ZoneDragField | null;
}

interface ActiveDrag {
  keygroupIndex: number;
  field: ZoneDragField;
  getValueFromEvent: (e: MouseEvent) => number;
  lastValue: number;
}

/**
 * Custom hook for draggable zone boundaries.
 *
 * Follows the EnvelopeEditor pattern:
 * - onDrag callbacks for continuous UI updates during pointer movement
 * - onCommit callbacks for device writes on mouseup
 * - Global event listeners attached on mousedown, removed on mouseup/unmount
 */
export function useZoneDrag(callbacks: ZoneDragCallbacks): {
  state: ZoneDragState;
  startDrag: (
    keygroupIndex: number,
    field: ZoneDragField,
    getValueFromEvent: (e: MouseEvent) => number,
  ) => (e: React.MouseEvent) => void;
} {
  const [state, setState] = useState<ZoneDragState>({
    isDragging: false,
    activeKeygroupIndex: null,
    activeField: null,
  });

  const activeDragRef = useRef<ActiveDrag | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = activeDragRef.current;
    if (!drag) return;

    const value = drag.getValueFromEvent(e);
    if (value !== drag.lastValue) {
      drag.lastValue = value;
      callbacksRef.current.onDrag(drag.keygroupIndex, drag.field, value);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    const drag = activeDragRef.current;
    if (!drag) return;

    callbacksRef.current.onCommit(drag.keygroupIndex, drag.field, drag.lastValue);
    activeDragRef.current = null;
    setState({
      isDragging: false,
      activeKeygroupIndex: null,
      activeField: null,
    });

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDrag = useCallback(
    (
      keygroupIndex: number,
      field: ZoneDragField,
      getValueFromEvent: (e: MouseEvent) => number,
    ) => {
      return (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const nativeEvent = e.nativeEvent;
        const initialValue = getValueFromEvent(nativeEvent);

        activeDragRef.current = {
          keygroupIndex,
          field,
          getValueFromEvent,
          lastValue: initialValue,
        };

        setState({
          isDragging: true,
          activeKeygroupIndex: keygroupIndex,
          activeField: field,
        });

        callbacksRef.current.onDrag(keygroupIndex, field, initialValue);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };
    },
    [handleMouseMove, handleMouseUp],
  );

  return { state, startDrag };
}
