export interface Scratch {
  x: number
  width: number
  opacity: number
  life: number
  wobble: number
  bright: boolean
}

/**
 * Create a new scratch at a random position.
 */
export function createScratch(width: number): Scratch {
  return {
    x: Math.random() * width,
    width: 0.5 + Math.random() * 1.5,
    opacity: 0.3 + Math.random() * 0.7,
    life: 2 + Math.floor(Math.random() * 8),
    wobble: (Math.random() - 0.5) * 2,
    bright: Math.random() > 0.5,
  }
}

/**
 * Update and draw film scratches.
 * Returns updated scratches array.
 */
export function drawScratches(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scratches: Scratch[],
  intensity: number
): Scratch[] {
  ctx.clearRect(0, 0, width, height)

  // Age out old scratches
  const updated = scratches.filter((s) => s.life-- > 0)

  // Occasionally add new scratches
  if (Math.random() < 0.08 * intensity) {
    updated.push(createScratch(width))
  }

  // Draw scratches as vertical lines
  updated.forEach((s) => {
    ctx.beginPath()
    const alpha = s.opacity * (s.life / 10)

    if (s.bright) {
      ctx.strokeStyle = `rgba(255, 250, 240, ${alpha})`
    } else {
      ctx.strokeStyle = `rgba(20, 15, 10, ${alpha})`
    }

    ctx.lineWidth = s.width

    // Slightly wobbly vertical line
    ctx.moveTo(s.x, 0)
    for (let y = 0; y < height; y += 20) {
      ctx.lineTo(s.x + Math.sin(y * 0.01) * s.wobble, y)
    }
    ctx.stroke()
  })

  return updated
}
