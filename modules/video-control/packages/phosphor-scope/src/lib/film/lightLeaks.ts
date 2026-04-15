/**
 * Calculate light leak parameters.
 * Light leaks happen sporadically with warm orange/amber colors.
 */
export function calculateLightLeak(
  timestamp: number,
  intensity: number
): {
  visible: boolean
  opacity: number
  hue: number
  x: number
  y: number
} {
  if (intensity <= 0) {
    return { visible: false, opacity: 0, hue: 0, x: 50, y: 30 }
  }

  const t = timestamp * 0.001

  // Light leaks happen sporadically
  const leakCycle = Math.sin(t * 0.3) * Math.sin(t * 0.7)
  const leakIntensity = Math.max(0, leakCycle) * intensity

  if (leakIntensity <= 0.05) {
    return { visible: false, opacity: 0, hue: 0, x: 50, y: 30 }
  }

  // Warm orange/amber leak from edge
  const hue = 20 + Math.sin(t * 0.5) * 15
  const x = 50 + Math.sin(t * 0.4) * 40
  const y = 30 + Math.sin(t * 0.6) * 20

  return {
    visible: true,
    opacity: leakIntensity * 0.3,
    hue,
    x,
    y,
  }
}

/**
 * Draw light leak gradient on canvas.
 */
export function drawLightLeak(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestamp: number,
  intensity: number
): void {
  const leak = calculateLightLeak(timestamp, intensity)

  if (!leak.visible) {
    ctx.clearRect(0, 0, width, height)
    return
  }

  const t = timestamp * 0.001
  const lx = width * (leak.x / 100)
  const ly = height * (leak.y / 100)

  // Convert hue to approximate RGB (warm tones)
  const leakR = 255
  const leakG = Math.floor(120 + Math.sin(t * 0.5) * 40)
  const leakB = 30

  const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, width * 0.5)
  grad.addColorStop(0, `rgba(${leakR},${leakG},${leakB},${leak.opacity * 0.5})`)
  grad.addColorStop(1, 'transparent')

  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
}
