/**
 * Roland S-series tone predicates.
 *
 * Small set of authoritative yes/no questions over an `SSeriesBaseTone`
 * that multiple call sites need to ask. Centralized here so the UI, the
 * library exporter, and any future call site agree on the answer.
 *
 * Earlier drift: three UI surfaces (`ToneList`, `ToneWavePanel`,
 * `ToneEditorHead`) gated their export / loop-editor affordances on
 * `endPoint > startPoint`, while the library exporter and incremental
 * save used `segmentLength > 0`. Both predicates *almost* agree, but
 * tones written to the device with a non-empty segment range and an
 * unwritten in-segment play range (start = end = 0) read as
 * "has wave data" to the export path and "no wave data" to the UI.
 * That produced T11-style UI bugs where a clearly-loaded, audible tone
 * showed no Export / Loop Editor affordances.
 *
 * Segment occupancy is the load-bearing signal — if a tone owns wave
 * bank slots, it has sample data the engine can play.
 */

import type { SSeriesBaseTone } from './s-series-types.js';

/**
 * Whether a tone has wave data — i.e. occupies one or more segments of
 * its wave bank. Type-guarded so callers iterating a sparse tone array
 * can drop the preceding null-check AND get the narrowed type inside
 * the truthy branch.
 */
export function toneHasWaveData<T extends SSeriesBaseTone>(
    tone: T | null | undefined,
): tone is T {
    return tone != null && tone.wave.segmentLength > 0;
}
