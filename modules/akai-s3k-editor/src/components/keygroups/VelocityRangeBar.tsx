/**
 * VelocityRangeBar — 4-zone velocity strip with split-handle drag.
 *
 * Promoted to <AcZoneStrip splitHandles={true}> on 2026-05-24 during
 * akai-harmonization Phase 2 task 2.2 (Commit 2 of the AcZoneStrip
 * extraction sequence). The pre-promotion implementation was 199 lines
 * of inline tailwind palette + DOM-event drag-tracking; the canonical
 * primitive owns the chrome (border, segment placement, handle visual
 * affordance) so this wrapper only carries the akai-specific bits:
 *
 *   1. Velocity-zone → AcZoneStripZone shape mapping (lowVel /
 *      highVel / sampleName / per-index hue).
 *   2. Pointer-driven split-handle drag tracking — AcZoneStrip signals
 *      drag-start; this wrapper binds window pointermove / pointerup
 *      and translates client X → velocity via the bar's bounding rect.
 *      onSplitDrag fires continuously during the drag; onSplitCommit
 *      fires once on pointer-up.
 *   3. The 0 / 32 / 64 / 96 / 127 velocity scale labels below the bar
 *      (axis labels — not part of the strip primitive).
 *
 * Hue palette: 4 hues distributed across the color wheel (200deg blue,
 * 140deg emerald, 40deg amber, 280deg purple) — same color identity as
 * the prior tailwind classes (bg-blue-800 / bg-emerald-800 /
 * bg-amber-800 / bg-purple-800) but expressed as hue degrees so the
 * zone-strip-primitives.css HSL math (saturation/lightness derived
 * from the dialect-token base) takes over.
 */

import { useRef, useCallback, useEffect } from 'react';
import { AcZoneStrip, type AcZoneStripZone } from '@audiocontrol/editor-core';

interface VelocityZone {
  lowVel: number;
  highVel: number;
  sampleName: string;
}

interface VelocityRangeBarProps {
  zones: VelocityZone[];
  selectedZone: number;
  onSelectZone: (index: number) => void;
  /** Called continuously during split point drag. splitIndex is the boundary between zones[splitIndex] and zones[splitIndex+1]. */
  onSplitDrag?: (splitIndex: number, velocity: number) => void;
  /** Called on mouseup after split point drag. */
  onSplitCommit?: (splitIndex: number, velocity: number) => void;
}

/**
 * Per-zone hue palette. Indices 0-3 carry blue / emerald / amber /
 * purple — same color identities as the pre-migration tailwind palette
 * (bg-blue-800 / bg-emerald-800 / bg-amber-800 / bg-purple-800), now
 * expressed as hue degrees so the canonical AcZoneStrip HSL math
 * (anchored at +200deg blue base) derives the fill + stroke.
 */
const AKAI_VELOCITY_ZONE_HUES: readonly number[] = [0, 240, 200, 80];

const VELOCITY_MAX = 127;

function clampVelocity(value: number): number {
  return Math.max(0, Math.min(VELOCITY_MAX, Math.round(value)));
}

interface SplitDragState {
  splitIndex: number;
  lastVelocity: number;
}

export function VelocityRangeBar({
  zones,
  selectedZone,
  onSelectZone,
  onSplitDrag,
  onSplitCommit,
}: VelocityRangeBarProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<SplitDragState | null>(null);

  const callbacksRef = useRef({ onSplitDrag, onSplitCommit });
  callbacksRef.current = { onSplitDrag, onSplitCommit };

  const clientXToVelocity = useCallback((clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return clampVelocity(ratio * VELOCITY_MAX);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const velocity = clientXToVelocity(e.clientX);
      if (velocity !== drag.lastVelocity) {
        drag.lastVelocity = velocity;
        callbacksRef.current.onSplitDrag?.(drag.splitIndex, velocity);
      }
    },
    [clientXToVelocity],
  );

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    callbacksRef.current.onSplitCommit?.(drag.splitIndex, drag.lastVelocity);
    dragRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove]);

  // Defensive cleanup if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleStartDrag = useCallback(
    (
      zoneIndex: number,
      handle: 'start' | 'end' | 'split',
      event: React.PointerEvent<HTMLElement>,
    ) => {
      // splitHandles mode only emits 'split' events; defensive guard
      // for the per-edge events even though they shouldn't fire here.
      if (handle !== 'split') return;
      if (!callbacksRef.current.onSplitDrag || !callbacksRef.current.onSplitCommit) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const velocity = clientXToVelocity(event.clientX);
      dragRef.current = { splitIndex: zoneIndex, lastVelocity: velocity };
      callbacksRef.current.onSplitDrag(zoneIndex, velocity);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [clientXToVelocity, handlePointerMove, handlePointerUp],
  );

  const hasSplitCallbacks =
    onSplitDrag !== undefined && onSplitCommit !== undefined;

  // AUDIT-20260524-12 (close): preserve the source-array index
  // alongside each rendered zone so that visually skipping malformed
  // entries (`highVel < lowVel`) does NOT rewrite the callback/index
  // contract. The pre-compaction shape is `{ sourceIndex, zone }`
  // pairs; the wrapper splits that into a bare AcZoneStripZone[] for
  // the primitive + a renderedIndex → sourceIndex translator
  // (`sourceIndexFor`) used by the callback adapters below.
  const stripEntries: { sourceIndex: number; zone: AcZoneStripZone }[] = zones
    .map<{ sourceIndex: number; zone: AcZoneStripZone } | null>((zone, sourceIndex) => {
      // Skip zones where highVel < lowVel (matches the legacy
      // skip-if-malformed behavior).
      if (zone.highVel < zone.lowVel) return null;
      // Modulo arithmetic guarantees the lookup is in-bounds; the
      // explicit `?? 0` keeps the TS contract honest without
      // suppressing the narrowing.
      const hue =
        AKAI_VELOCITY_ZONE_HUES[sourceIndex % AKAI_VELOCITY_ZONE_HUES.length] ?? 0;
      return {
        sourceIndex,
        zone: {
          startValue: zone.lowVel,
          endValue: zone.highVel,
          hue,
          label: zone.sampleName.trim() || `Z${sourceIndex + 1}`,
          isSelected: sourceIndex === selectedZone,
          title: `Zone ${sourceIndex + 1}: ${zone.sampleName.trim() || '(empty)'} (${zone.lowVel}-${zone.highVel})`,
        },
      };
    })
    .filter(
      (entry): entry is { sourceIndex: number; zone: AcZoneStripZone } =>
        entry !== null,
    );

  const stripZones: AcZoneStripZone[] = stripEntries.map((e) => e.zone);
  const sourceIndexFor = (renderedIndex: number): number | undefined =>
    stripEntries[renderedIndex]?.sourceIndex;

  const handleStripSelect = (renderedIndex: number): void => {
    const src = sourceIndexFor(renderedIndex);
    if (src === undefined) return;
    onSelectZone(src);
  };

  const handleStripStartDrag = (
    renderedIndex: number,
    handle: 'start' | 'end' | 'split',
    event: React.PointerEvent<HTMLElement>,
  ): void => {
    const src = sourceIndexFor(renderedIndex);
    if (src === undefined) return;
    handleStartDrag(src, handle, event);
  };

  return (
    <div className="px-3 py-2">
      <AcZoneStrip
        barRef={barRef}
        zones={stripZones}
        range={{ min: 0, max: VELOCITY_MAX }}
        onSelect={handleStripSelect}
        onStartDrag={hasSplitCallbacks ? handleStripStartDrag : undefined}
        splitHandles={true}
        ariaLabel="Velocity zones"
        emptyText="No velocity zones"
      />

      {/* Velocity scale labels (axis; not part of the strip primitive). */}
      <div className="relative h-4 mt-1">
        {[0, 32, 64, 96, 127].map((v) => (
          <span
            key={v}
            className="absolute text-[10px] text-gray-500 -translate-x-1/2"
            style={{ left: `${(v / VELOCITY_MAX) * 100}%` }}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
