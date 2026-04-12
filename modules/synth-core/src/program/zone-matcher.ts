import type { ZonePlayback } from '@/types/program-playback';

/** A matched zone with its index in the original zones array. */
export interface ZoneMatch {
  zone: ZonePlayback;
  index: number;
}

/**
 * Find all zones that match a given MIDI note and velocity.
 *
 * A zone matches when the note falls within its keyRange AND the
 * velocity falls within its velocityRange. Multiple zones can match
 * (velocity layers, overlapping key ranges).
 *
 * Returns each match with the zone's index in the original array,
 * avoiding the need for a separate indexOf lookup.
 */
export function findMatchingZones(
  zones: readonly ZonePlayback[],
  note: number,
  velocity: number,
): ZoneMatch[] {
  const matches: ZoneMatch[] = [];

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i]!;
    const [lowKey, highKey] = zone.keyRange;
    const [lowVel, highVel] = zone.velocityRange;

    if (note >= lowKey && note <= highKey && velocity >= lowVel && velocity <= highVel) {
      matches.push({ zone, index: i });
    }
  }

  return matches;
}
