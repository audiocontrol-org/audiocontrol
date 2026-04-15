/**
 * Timing utilities for converting between timecodes and frame numbers
 */

/**
 * Parse a timecode string into frame numbers
 * Supported formats:
 * - "MM:SS.mmm" (e.g., "1:30.500")
 * - "SS.mmm" (e.g., "45.250")
 * - Integer frame numbers (e.g., 120)
 */
export function parseTimecode(timecode: string | number, fps: number): number {
  if (typeof timecode === "number") {
    return Math.round(timecode);
  }

  const trimmed = timecode.trim();

  // Check if it's just a number (frame count)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Parse MM:SS.mmm or SS.mmm format
  const parts = trimmed.split(":");

  let totalSeconds: number;

  if (parts.length === 2) {
    // MM:SS.mmm format
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) {
      throw new Error(`Invalid timecode format: "${timecode}"`);
    }
    totalSeconds = minutes * 60 + seconds;
  } else if (parts.length === 1) {
    // SS.mmm format
    totalSeconds = parseFloat(parts[0]);
    if (isNaN(totalSeconds)) {
      throw new Error(`Invalid timecode format: "${timecode}"`);
    }
  } else {
    throw new Error(
      `Invalid timecode format: "${timecode}". Expected MM:SS.mmm, SS.mmm, or frame number`
    );
  }

  return Math.round(totalSeconds * fps);
}

/**
 * Convert frame number to timecode string (MM:SS.mmm)
 */
export function framesToTimecode(frames: number, fps: number): string {
  const totalSeconds = frames / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = seconds.toFixed(3).padStart(6, "0");
  return `${minutes}:${formatted}`;
}

/**
 * Convert seconds to frame count
 */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/**
 * Convert frames to seconds
 */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

/**
 * Parse a duration string (e.g., "2:30") into total frames
 */
export function parseDuration(duration: string | number, fps: number): number {
  if (typeof duration === "number") {
    return secondsToFrames(duration, fps);
  }
  return parseTimecode(duration, fps);
}

/**
 * Calculate total duration from an array of items with outFrame properties
 */
export function calculateDurationFromOverlays(
  overlays: Array<{ outFrame: number }>
): number {
  if (overlays.length === 0) {
    return 0;
  }
  return Math.max(...overlays.map((o) => o.outFrame));
}
