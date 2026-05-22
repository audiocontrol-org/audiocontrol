/**
 * Shared helpers for the bank-based slot lists (PatchList, ToneList).
 *
 * Pre-extraction the two files repeated the same collapse-state hook,
 * the same bank-info compute block, and the same per-row keyboard
 * handler — three clones (clones.yaml 3785f9b1220a + 38542efd1697 +
 * e7ed36d3a106). Each helper is small in isolation but the three
 * together cover 43 lines of strict duplication.
 *
 * The existing patches.spec.ts + tones.spec.ts wiring suites already
 * exercise every visible affordance these helpers underpin (click-to-
 * select, click-to-load-bank, keyboard activation), so they double as
 * protecting assertions for this extraction. No new test was added.
 */

import { useState, type KeyboardEvent } from 'react';

/**
 * Per-bank collapse state. Default: every bank expanded. Operator
 * clicks the bank header chevron-button to toggle. State is
 * component-local (not persisted across navigations) — kept simple
 * until we hear the operator wants persistence.
 */
export function useCollapsedBanks(): {
  collapsedBanks: ReadonlySet<number>;
  toggleBank: (bankIndex: number) => void;
} {
  const [collapsedBanks, setCollapsedBanks] = useState<Set<number>>(
    () => new Set(),
  );
  const toggleBank = (i: number): void => {
    setCollapsedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  return { collapsedBanks, toggleBank };
}

export interface BankInfo {
  bankStart: number;
  bankEnd: number;
  firstSlotLabel: string;
  lastSlotLabel: string;
  isCollapsed: boolean;
  isBankLoaded: boolean;
  isThisBankLoading: boolean;
}

/**
 * Compute per-bank rendering info from the list-level state. The
 * formatter callback decouples PatchList (formatPatchSlot) from
 * ToneList (formatToneSlot) without leaking memoryLayout knowledge
 * into this helper.
 */
export function computeBankInfo<T>({
  items,
  bankIndex,
  perBank,
  formatSlot,
  collapsedBanks,
  loadingBank,
}: {
  items: (T | undefined)[];
  bankIndex: number;
  perBank: number;
  formatSlot: (index: number) => string;
  collapsedBanks: ReadonlySet<number>;
  loadingBank?: number | null;
}): BankInfo {
  const bankStart = bankIndex * perBank;
  const bankEnd = Math.min(bankStart + perBank, items.length);
  return {
    bankStart,
    bankEnd,
    firstSlotLabel: formatSlot(bankStart),
    lastSlotLabel: formatSlot(bankEnd - 1),
    isCollapsed: collapsedBanks.has(bankIndex),
    isBankLoaded: items.slice(bankStart, bankEnd).some((x) => x !== undefined),
    isThisBankLoading: loadingBank === bankIndex,
  };
}

/**
 * Per-row keyboard activation handler. Mirrors native button semantics
 * (Enter / Space → click) because the row outer is a `role="button"`
 * div, not a real <button>, to allow nesting an inline action button
 * without violating button-in-button.
 */
export function createRowKeyDownHandler({
  isBankLoading,
  onActivate,
}: {
  isBankLoading: boolean;
  onActivate: () => void;
}): (e: KeyboardEvent<HTMLDivElement>) => void {
  return (e) => {
    if (isBankLoading) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  };
}
