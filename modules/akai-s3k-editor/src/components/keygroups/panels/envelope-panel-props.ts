/**
 * Shared prop contract for keygroup panels that mount an `<AcEnvelope>`
 * (KeygroupAmpPanel, KeygroupFilterPanel). Both panels carry the same
 * five-slot shape: `header` (KeygroupHeader source), `num` (the
 * pre-bound onParameterChange-by-field adapter), `onParameterChange`
 * (raw fallback when no drag-mode dispatch is supplied), `onDragChange`
 * (optional optimistic-update channel during drag), and `onCommitHeader`
 * (optional commit-on-release callback).
 *
 * Extracted 2026-05-25 per AUDIT-20260525-25 to dispose clones.yaml
 * group `d880dc795edb` (9-line prop-interface duplication detected by
 * the clone-duplication gate). The interface lives in its own file so
 * the two panels can compose the shape without re-declaring it.
 */

import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';

export interface EnvelopePanelProps {
  header: KeygroupHeader;
  /** Pre-bound `(field) => (value) => onParameterChange(field, value)` adapter. */
  num: (field: string) => (value: number) => void;
  /** Raw onParameterChange — used for drag-end / non-drag emissions. */
  onParameterChange: (field: string, value: number | string) => void;
  /** Optimistic-update channel during drag; bypasses device-write debouncing. */
  onDragChange?: (field: string, value: number) => void;
  /** Commit the in-memory header to the device — called on drag end. */
  onCommitHeader?: () => void;
}
