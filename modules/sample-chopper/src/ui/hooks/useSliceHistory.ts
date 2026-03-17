/**
 * Slice History Hook
 *
 * Maintains an undo/redo journal for slice definitions.
 * Each entry is a labeled snapshot of the slice array.
 * Drag operations are coalesced: consecutive entries with the same
 * label replace the previous entry instead of adding a new one.
 */

import { useState, useCallback, useRef } from 'react';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';

export interface HistoryEntry {
  label: string;
  slices: SliceDefinitionOutput[];
  timestamp: number;
}

const MAX_HISTORY = 50;

export interface UseSliceHistoryReturn {
  /** Push a new snapshot onto the history stack */
  push: (slices: SliceDefinitionOutput[], label: string) => void;
  /** Undo: move back one step, returns the restored slices or null */
  undo: () => SliceDefinitionOutput[] | null;
  /** Redo: move forward one step, returns the restored slices or null */
  redo: () => SliceDefinitionOutput[] | null;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** All history entries */
  entries: HistoryEntry[];
  /** Current position in history (index into entries) */
  currentIndex: number;
  /** Restore a specific entry by index, returns the slices */
  restore: (index: number) => SliceDefinitionOutput[];
  /** Clear all history */
  clear: () => void;
}

export function useSliceHistory(): UseSliceHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const lastLabelRef = useRef<string | null>(null);
  // Use a ref to track currentIndex for push() so it doesn't need
  // currentIndex as a dependency (which would cause infinite re-renders
  // when push is called from effects).
  const currentIndexRef = useRef(-1);
  currentIndexRef.current = currentIndex;

  const push = useCallback((slices: SliceDefinitionOutput[], label: string) => {
    const snapshot = slices.map((s) => ({ ...s }));
    const entry: HistoryEntry = { label, slices: snapshot, timestamp: Date.now() };

    setEntries((prev) => {
      const ci = currentIndexRef.current;
      // Truncate any redo entries beyond current position
      const base = ci >= 0 ? prev.slice(0, ci + 1) : [];

      // Coalesce consecutive entries with the same label (e.g. drag operations)
      if (base.length > 0 && lastLabelRef.current === label) {
        const coalesced = [...base];
        coalesced[coalesced.length - 1] = entry;
        return coalesced;
      }

      const updated = [...base, entry];
      // Trim old entries if over limit
      if (updated.length > MAX_HISTORY) {
        const trimmed = updated.slice(updated.length - MAX_HISTORY);
        const newIdx = trimmed.length - 1;
        currentIndexRef.current = newIdx;
        setCurrentIndex(newIdx);
        lastLabelRef.current = label;
        return trimmed;
      }
      const newIdx = updated.length - 1;
      currentIndexRef.current = newIdx;
      setCurrentIndex(newIdx);
      lastLabelRef.current = label;
      return updated;
    });
  }, []);

  const undo = useCallback((): SliceDefinitionOutput[] | null => {
    const ci = currentIndexRef.current;
    if (ci <= 0) return null;
    const newIndex = ci - 1;
    currentIndexRef.current = newIndex;
    setCurrentIndex(newIndex);
    lastLabelRef.current = null;
    // Read from the ref-tracked entries via the state setter pattern
    let result: SliceDefinitionOutput[] | null = null;
    setEntries((prev) => {
      result = prev[newIndex]?.slices.map((s) => ({ ...s })) ?? null;
      return prev;
    });
    return result;
  }, []);

  const redo = useCallback((): SliceDefinitionOutput[] | null => {
    let result: SliceDefinitionOutput[] | null = null;
    setEntries((prev) => {
      const ci = currentIndexRef.current;
      if (ci >= prev.length - 1) return prev;
      const newIndex = ci + 1;
      currentIndexRef.current = newIndex;
      setCurrentIndex(newIndex);
      lastLabelRef.current = null;
      result = prev[newIndex]?.slices.map((s) => ({ ...s })) ?? null;
      return prev;
    });
    return result;
  }, []);

  const restore = useCallback((index: number): SliceDefinitionOutput[] => {
    currentIndexRef.current = index;
    setCurrentIndex(index);
    lastLabelRef.current = null;
    // entries is read from closure but stable enough for click handlers
    return entries[index].slices.map((s) => ({ ...s }));
  }, [entries]);

  const clear = useCallback(() => {
    setEntries([]);
    currentIndexRef.current = -1;
    setCurrentIndex(-1);
    lastLabelRef.current = null;
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < entries.length - 1,
    entries,
    currentIndex,
    restore,
    clear,
  };
}
