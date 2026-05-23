/**
 * SlotInfo
 *
 * Shared slot-info column rendered by PatchList and ToneList. Wraps
 * the slot-name span + the optional "click to load" eyebrow inside
 * an `.ac-list-info` container.
 *
 * Extracted 2026-05-22 from PatchList.tsx (lines 227-240) and
 * ToneList.tsx (lines 226-239) per clones.yaml group 80299d9fda8d
 * disposition. Pre-extraction the two files held byte-identical
 * markup that differed only by the `data-testid` value
 * (`patch-name` vs `tone-name`). Wrapper class `.ac-list-info`,
 * eyebrow class `.ac-list-eyebrow`, and the "click to load" copy
 * are preserved verbatim — the contract is protected by
 * `D-PATCH-LIST-09` (patches.spec.ts) and `D-TONE-LIST-08`
 * (tones.spec.ts) wiring assertions added before the extraction.
 */

export interface SlotInfoProps {
  /** Computed class for the inner name span. Callers compute this
   *  per-slot (`ac-list-name` / `--placeholder` / `--empty`) based on
   *  load state + emptiness. Routed in rather than computed here so
   *  each caller owns its own emptiness heuristic. */
  nameClass: string;
  /** The text rendered in the name span. Empty string is a valid value
   *  (intentional silence when an unloaded slot's eyebrow is the
   *  state-conveyance affordance). When `isDragOver` is true AND
   *  `dragOverText` is set, that replaces `displayName` for the
   *  drop-zone affordance. */
  displayName: string;
  /** Whether the underlying bank reports the slot as loaded. */
  isLoaded: boolean;
  /** Whether the underlying bank is mid-load. Suppresses the
   *  "click to load" eyebrow during in-flight loads (the row
   *  already shows `(loading...)` upstream). */
  isBankLoading: boolean;
  /** `data-testid` for the inner name span. Optional — the original
   *  PatchList/ToneList call sites set this to `patch-name` /
   *  `tone-name` and the e2e suite relies on those exact values.
   *  DeviceMemoryPanel doesn't carry a per-slot name-span testid;
   *  it relies on the slot row's own `device-{tone,patch}-slot-N`
   *  testid instead. */
  testId?: string;
  /** Text rendered in place of `displayName` when `isDragOver` is true
   *  (e.g., DeviceMemoryPanel uses "Drop to import" as the drop-zone
   *  affordance). Omit to disable the drag-over swap entirely. */
  dragOverText?: string;
  /** Defaults to false. When true AND `dragOverText` is provided, the
   *  name span displays `dragOverText` and the "click to load" eyebrow
   *  is suppressed. Used by DeviceMemoryPanel's drop-zone slots. */
  isDragOver?: boolean;
}

export function SlotInfo({
  nameClass,
  displayName,
  isLoaded,
  isBankLoading,
  testId,
  dragOverText,
  isDragOver = false,
}: SlotInfoProps): JSX.Element {
  const showDragOver = isDragOver && dragOverText !== undefined;
  return (
    <span className="ac-list-info">
      <span className={nameClass} {...(testId !== undefined ? { 'data-testid': testId } : {})}>
        {showDragOver ? dragOverText : displayName}
      </span>
      {!isLoaded && !isBankLoading && !showDragOver && (
        <span className="ac-list-eyebrow">click to load</span>
      )}
    </span>
  );
}
