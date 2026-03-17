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

  const push = useCallback((slices: SliceDefinitionOutput[], label: string) => {
    const snapshot = slices.map((s) => ({ ...s }));
    const entry: HistoryEntry = { label, slices: snapshot, timestamp: Date.now() };

    setEntries((prev) => {
      const ci = currentIndex;
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
        setCurrentIndex(trimmed.length - 1);
        lastLabelRef.current = label;
        return trimmed;
      }
      setCurrentIndex(updated.length - 1);
      lastLabelRef.current = label;
      return updated;
    });
  }, [currentIndex]);

  const undo = useCallback((): SliceDefinitionOutput[] | null => {
    if (currentIndex <= 0) return null;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    lastLabelRef.current = null;
    return entries[newIndex]?.slices.map((s) => ({ ...s })) ?? null;
  }, [currentIndex, entries]);

  const redo = useCallback((): SliceDefinitionOutput[] | null => {
    if (currentIndex >= entries.length - 1) return null;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    lastLabelRef.current = null;
    return entries[newIndex]?.slices.map((s) => ({ ...s })) ?? null;
  }, [currentIndex, entries]);

  const restore = useCallback((index: number): SliceDefinitionOutput[] => {
    setCurrentIndex(index);
    lastLabelRef.current = null;
    return entries[index].slices.map((s) => ({ ...s }));
  }, [entries]);

  const clear = useCallback(() => {
    setEntries([]);
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
