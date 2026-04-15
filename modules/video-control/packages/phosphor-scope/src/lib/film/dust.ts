export type DustType = 'speck' | 'hair' | 'blob'

export interface DustParticle {
  type: DustType
  x: number
  y: number
  size: number
  angle: number
  length: number
  curve: number
  opacity: number
  life: number
}

/**
 * Create a new dust particle at a random position.
 */
export function createDustParticle(width: number, height: number): DustParticle {
  const types: DustType[] = ['speck', 'speck', 'speck', 'hair', 'blob']
  const type = types[Math.floor(Math.random() * types.length)]

  return {
    type,
    x: Math.random() * width,
    y: Math.random() * height,
    size: type === 'speck' ? 1 + Math.random() * 2 : 2 + Math.random() * 3,
    angle: Math.random() * Math.PI,
    length: 15 + Math.random() * 30,
    curve: (Math.random() - 0.5) * 0.1,
    opacity: 0.1 + Math.random() * 0.2,
    life: 60 + Math.floor(Math.random() * 200),
  }
}

/**
 * Update and draw dust particles.
 * Returns updated particles array.
 */
export function drawDust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: DustParticle[],
  intensity: number
): DustParticle[] {
  ctx.clearRect(0, 0, width, height)

  // Age out and replace particles
  const updated = particles.filter((p) => p.life-- > 0)

  const targetCount = 3 + Math.floor(intensity * 5)
  while (updated.length < targetCount) {
    updated.push(createDustParticle(width, height))
  }

  updated.forEach((p) => {
    ctx.save()

    if (p.type === 'speck') {
      ctx.beginPath()
      ctx.fillStyle = `rgba(20, 15, 10, ${p.opacity})`
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.type === 'hair') {
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.beginPath()
      ctx.strokeStyle = `rgba(30, 25, 15, ${p.opacity})`
      ctx.lineWidth = 0.5 + Math.random() * 0.5

      // Curved hair path
      ctx.moveTo(0, 0)
      for (let i = 1; i <= 10; i++) {
        const t = i / 10
        const cx = p.length * t
        const cy = Math.sin(t * Math.PI) * p.length * p.curve
        ctx.lineTo(cx, cy)
      }
      ctx.stroke()
    } else if (p.type === 'blob') {
      ctx.beginPath()
      ctx.fillStyle = `rgba(15, 10, 5, ${p.opacity})`
      // Irregular blob shape
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, Math.random(), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  })

  return updated
}
