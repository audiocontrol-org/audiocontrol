/**
 * Calculate film brightness flicker using multiple layers:
 * - Slow drift (lamp warming/cooling)
 * - Medium ripple (power supply, ~24fps cadence)
 * - Random hard dips (gate obstruction)
 * - Occasional bright flashes
 * - Per-frame jitter
 */
export function calculateFlicker(timestamp: number, intensity: number): number {
  if (intensity <= 0) return 1

  const t = timestamp * 0.001

  // Layer 1: Slow drift
  const drift = Math.sin(t * 1.3) * 0.15

  // Layer 2: Medium oscillation (projector cadence)
  const ripple = Math.sin(t * 24 * Math.PI * 2 * 0.04) * 0.2

  // Layer 3: Random hard dips
  let dip = 0
  const dipChance = Math.sin(t * 5.1) * Math.sin(t * 7.3)
  if (dipChance > 0.85) {
    dip = -0.4 * (dipChance - 0.85) / 0.15
  }

  // Layer 4: Occasional bright flashes
  let flash = 0
  const flashChance = Math.sin(t * 3.7) * Math.sin(t * 11.9)
  if (flashChance > 0.9) {
    flash = 0.3 * (flashChance - 0.9) / 0.1
  }

  // Layer 5: Per-frame jitter
  const jitter = (Math.random() - 0.5) * 0.3

  const f = 1 + intensity * (drift + ripple + dip + flash + jitter)
  return Math.max(0.4, Math.min(1.5, f))
}

/**
 * Calculate gate weave offset.
 * Combines multiple frequencies for organic movement.
 */
export function calculateWeave(
  timestamp: number,
  intensity: number
): { x: number; y: number } {
  if (intensity <= 0) return { x: 0, y: 0 }

  const t = timestamp * 0.001

  const x =
    (Math.sin(t * 3.7) * 0.3 +
      Math.sin(t * 7.1) * 0.15 +
      Math.sin(t * 13.3) * 0.05) *
    intensity

  const y =
    (Math.sin(t * 4.3) * 0.4 +
      Math.sin(t * 9.7) * 0.2 +
      Math.sin(t * 11.1) * 0.08) *
    intensity

  return { x, y }
}
