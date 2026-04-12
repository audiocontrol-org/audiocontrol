import type { ZonePlayback } from '@/types/program-playback';

/**
 * Find all zones that match a given MIDI note and velocity.
 *
 * A zone matches when the note falls within its keyRange AND the
 * velocity falls within its velocityRange. Multiple zones can match
 * (velocity layers, overlapping key ranges).
 */
export function findMatchingZones(
  zones: readonly ZonePlayback[],
  note: number,
  velocity: number,
): ZonePlayback[] {
  const matches: ZonePlayback[] = [];

  for (const zone of zones) {
    const [lowKey, highKey] = zone.keyRange;
    const [lowVel, highVel] = zone.velocityRange;

    if (note >= lowKey && note <= highKey && velocity >= lowVel && velocity <= highVel) {
      matches.push(zone);
    }
  }

  return matches;
}
