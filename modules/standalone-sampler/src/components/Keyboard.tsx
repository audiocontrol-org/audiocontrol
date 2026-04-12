import { useCallback, useRef } from 'react';
import { clsx } from 'clsx';

interface KeyboardProps {
  /** Lowest MIDI note displayed. */
  lowNote?: number;
  /** Highest MIDI note displayed. */
  highNote?: number;
  /** Currently active (playing) MIDI notes. */
  activeNotes?: Set<number>;
  /** Called on mouse/touch down. Velocity 1–127 based on vertical position. */
  onNoteOn: (note: number, velocity: number) => void;
  /** Called on mouse/touch up. */
  onNoteOff: (note: number) => void;
}

const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);

function isBlackKey(note: number): boolean {
  return BLACK_KEY_OFFSETS.has(note % 12);
}

function noteToName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  return `${names[note % 12]}${octave}`;
}

/**
 * Calculate velocity from vertical position within a key element.
 * Top of key = low velocity (1), bottom of key = high velocity (127).
 */
function velocityFromPosition(rect: DOMRect, clientY: number): number {
  const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  return Math.round(1 + ratio * 126);
}

export function Keyboard({
  lowNote = 36,
  highNote = 96,
  activeNotes = new Set(),
  onNoteOn,
  onNoteOff,
}: KeyboardProps): JSX.Element {
  const activeNoteRef = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (note: number, event: React.PointerEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const velocity = velocityFromPosition(rect, event.clientY);
      activeNoteRef.current = note;
      onNoteOn(note, velocity);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [onNoteOn],
  );

  const handlePointerUp = useCallback(() => {
    if (activeNoteRef.current !== null) {
      onNoteOff(activeNoteRef.current);
      activeNoteRef.current = null;
    }
  }, [onNoteOff]);

  // Build white and black keys
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];

  for (let note = lowNote; note <= highNote; note++) {
    if (isBlackKey(note)) {
      blackKeys.push(note);
    } else {
      whiteKeys.push(note);
    }
  }

  const whiteKeyWidth = 100 / whiteKeys.length;

  // Map each white key to its index for positioning black keys
  const whiteKeyIndex = new Map<number, number>();
  whiteKeys.forEach((note, idx) => whiteKeyIndex.set(note, idx));

  // Position of a black key: centered between the two adjacent white keys
  function blackKeyLeftPercent(note: number): number {
    // The white key just below this black key
    const prevWhite = note - 1;
    const idx = whiteKeyIndex.get(prevWhite);
    if (idx === undefined) return 0;
    return (idx + 1) * whiteKeyWidth - whiteKeyWidth * 0.3;
  }

  return (
    <div
      className="relative select-none"
      style={{ height: '160px' }}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* White keys */}
      {whiteKeys.map((note, idx) => (
        <button
          key={note}
          className={clsx(
            'absolute top-0 h-full border border-sampler-border rounded-b',
            activeNotes.has(note)
              ? 'bg-sampler-highlight'
              : 'bg-white hover:bg-gray-100',
          )}
          style={{
            left: `${idx * whiteKeyWidth}%`,
            width: `${whiteKeyWidth}%`,
          }}
          onPointerDown={(e) => handlePointerDown(note, e)}
          aria-label={noteToName(note)}
        />
      ))}

      {/* Black keys */}
      {blackKeys.map((note) => (
        <button
          key={note}
          className={clsx(
            'absolute top-0 rounded-b z-10 border border-sampler-border',
            activeNotes.has(note)
              ? 'bg-sampler-highlight'
              : 'bg-gray-900 hover:bg-gray-700',
          )}
          style={{
            left: `${blackKeyLeftPercent(note)}%`,
            width: `${whiteKeyWidth * 0.6}%`,
            height: '60%',
          }}
          onPointerDown={(e) => handlePointerDown(note, e)}
          aria-label={noteToName(note)}
        />
      ))}
    </div>
  );
}
