/**
 * Format a time value for display. Values below 1 second are shown in
 * milliseconds; values at or above 1 second are shown in seconds.
 */
export function formatTime(value: number): string {
  if (value < 1) return `${Math.round(value * 1000)}ms`;
  return `${value.toFixed(2)}s`;
}
