/**
 * State management hook for the sample editor.
 *
 * Maintains an undo/redo history stack of sample operations.
 * Each operation produces a new Int16Array that becomes the current state.
 * Maximum 50 history entries — oldest entries are dropped when exceeded.
 */

import { useState, useCallback, useMemo } from 'react';
import type { HistoryEntry } from '@/types';

const MAX_HISTORY = 50;

export interface UseSampleEditorParams {
  initialSamples: Int16Array | null;
  sampleRate: number;
}

export interface UseSampleEditorReturn {
  /** Current samples after all applied operations. */
  samples: Int16Array | null;
  sampleRate: number;
  /** Selection region for trim. */
  selection: { start: number; end: number } | null;
  setSelection: (sel: { start: number; end: number } | null) => void;
  /** Apply an operation, pushing to history. */
  apply(label: string, operation: (samples: Int16Array, sr: number) => Int16Array): void;
  /** Undo/redo. */
  canUndo: boolean;
  canRedo: boolean;
  undo(): void;
  redo(): void;
  /** Whether samples have been modified from initial. */
  isDirty: boolean;
  /** History for display. */
  history: Array<{ label: string; isCurrent: boolean }>;
  /** Preview samples — if non-null, the waveform should show these instead of committed samples. */
  preview: Int16Array | null;
  /** Set a preview by applying an operation to the current committed samples. Null to clear. */
  setPreview(operation: ((samples: Int16Array, sr: number) => Int16Array) | null): void;
  /** Commit the current preview to the undo history with a label. */
  commitPreview(label: string): void;
  /** The samples to display (preview if active, otherwise committed). */
  displaySamples: Int16Array | null;
}

interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
}

export function useSampleEditor({
  initialSamples,
  sampleRate,
}: UseSampleEditorParams): UseSampleEditorReturn {
  const [historyState, setHistoryState] = useState<HistoryState>(() => ({
    entries: initialSamples
      ? [{ label: 'Original', samples: initialSamples }]
      : [],
    currentIndex: initialSamples ? 0 : -1,
  }));

  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [preview, setPreviewState] = useState<Int16Array | null>(null);

  const currentEntry = historyState.currentIndex >= 0
    ? historyState.entries[historyState.currentIndex]
    : null;

  const samples = currentEntry?.samples ?? null;

  const apply = useCallback(
    (label: string, operation: (s: Int16Array, sr: number) => Int16Array) => {
      setHistoryState((prev) => {
        const current = prev.currentIndex >= 0
          ? prev.entries[prev.currentIndex]
          : null;

        if (!current) {
          return prev;
        }

        const result = operation(current.samples, sampleRate);
        const newEntry: HistoryEntry = { label, samples: result };

        // Truncate any redo entries beyond current position
        const base = prev.entries.slice(0, prev.currentIndex + 1);
        const entries = [...base, newEntry];

        // Enforce max history — drop oldest (but keep entry 0 as "Original")
        if (entries.length > MAX_HISTORY) {
          const excess = entries.length - MAX_HISTORY;
          return {
            entries: entries.slice(excess),
            currentIndex: entries.length - excess - 1,
          };
        }

        return {
          entries,
          currentIndex: entries.length - 1,
        };
      });
    },
    [sampleRate],
  );

  const setPreview = useCallback(
    (operation: ((s: Int16Array, sr: number) => Int16Array) | null) => {
      if (!operation || !samples) {
        setPreviewState(null);
        return;
      }
      setPreviewState(operation(samples, sampleRate));
    },
    [samples, sampleRate],
  );

  const commitPreview = useCallback(
    (label: string) => {
      if (!preview) return;
      const committed = preview;
      setPreviewState(null);
      setHistoryState((prev) => {
        const base = prev.entries.slice(0, prev.currentIndex + 1);
        const entries = [...base, { label, samples: committed }];
        if (entries.length > MAX_HISTORY) {
          const excess = entries.length - MAX_HISTORY;
          return { entries: entries.slice(excess), currentIndex: entries.length - excess - 1 };
        }
        return { entries, currentIndex: entries.length - 1 };
      });
    },
    [preview],
  );

  const displaySamples = preview ?? samples;

  const canUndo = historyState.currentIndex > 0;
  const canRedo = historyState.currentIndex < historyState.entries.length - 1;

  const undo = useCallback(() => {
    setPreviewState(null);
    setHistoryState((prev) =>
      prev.currentIndex > 0
        ? { ...prev, currentIndex: prev.currentIndex - 1 }
        : prev,
    );
  }, []);

  const redo = useCallback(() => {
    setPreviewState(null);
    setHistoryState((prev) =>
      prev.currentIndex < prev.entries.length - 1
        ? { ...prev, currentIndex: prev.currentIndex + 1 }
        : prev,
    );
  }, []);

  const isDirty = samples !== initialSamples;

  const history = useMemo(
    () =>
      historyState.entries.map((entry, i) => ({
        label: entry.label,
        isCurrent: i === historyState.currentIndex,
      })),
    [historyState],
  );

  return {
    samples,
    sampleRate,
    selection,
    setSelection,
    apply,
    canUndo,
    canRedo,
    undo,
    redo,
    isDirty,
    history,
    preview,
    setPreview,
    commitPreview,
    displaySamples,
  };
}
