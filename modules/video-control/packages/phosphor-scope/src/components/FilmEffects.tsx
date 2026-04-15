import { useRef, useEffect, useCallback } from 'react'
import { useFilmStore } from '@/stores'
import { useAnimationFrame } from '@/hooks'
import {
  drawFilmGrain,
  drawScratches,
  drawDust,
  drawLightLeak,
  calculateFlicker,
  calculateWeave,
} from '@/lib/film'
import type { Scratch, DustParticle } from '@/lib/film'

interface FilmEffectsProps {
  width: number
  height: number
}

export function FilmEffects({ width, height }: FilmEffectsProps) {
  const grainCanvasRef = useRef<HTMLCanvasElement>(null)
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null)
  const dustCanvasRef = useRef<HTMLCanvasElement>(null)
  const leakCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Persistent state for scratches and dust
  const scratchesRef = useRef<Scratch[]>([])
  const dustRef = useRef<DustParticle[]>([])
  const timestampRef = useRef<number>(0)

  const { grain, weave, flicker, scratches, lightLeaks, dust, colorFade } =
    useFilmStore()

  // Resize canvases when dimensions change
  useEffect(() => {
    const canvases = [
      grainCanvasRef.current,
      scratchCanvasRef.current,
      dustCanvasRef.current,
      leakCanvasRef.current,
    ]

    canvases.forEach((canvas) => {
      if (canvas) {
        canvas.width = width
        canvas.height = height
      }
    })
  }, [width, height])

  // Animation frame callback
  const animate = useCallback(
    (deltaTime: number) => {
      timestampRef.current += deltaTime

      const grainCanvas = grainCanvasRef.current
      const scratchCanvas = scratchCanvasRef.current
      const dustCanvas = dustCanvasRef.current
      const leakCanvas = leakCanvasRef.current
      const container = containerRef.current

      if (!grainCanvas || !scratchCanvas || !dustCanvas || !leakCanvas || !container) {
        return
      }

      const grainCtx = grainCanvas.getContext('2d')
      const scratchCtx = scratchCanvas.getContext('2d')
      const dustCtx = dustCanvas.getContext('2d')
      const leakCtx = leakCanvas.getContext('2d')

      if (!grainCtx || !scratchCtx || !dustCtx || !leakCtx) return

      const timestamp = timestampRef.current

      // Gate weave - apply transform to container
      if (weave > 0) {
        const weaveOffset = calculateWeave(timestamp, weave)
        container.style.transform = `translate(${weaveOffset.x}px, ${weaveOffset.y}px)`
      } else {
        container.style.transform = 'none'
      }

      // Brightness flicker
      if (flicker > 0) {
        const brightness = calculateFlicker(timestamp, flicker)
        container.style.filter = `brightness(${brightness})`
      } else {
        container.style.filter = 'none'
      }

      // Film grain
      if (grain > 0) {
        grainCanvas.style.opacity = String(grain * 0.6)
        drawFilmGrain(grainCtx, width, height)
      } else {
        grainCanvas.style.opacity = '0'
      }

      // Scratches
      if (scratches > 0) {
        scratchCanvas.style.opacity = String(scratches)
        scratchesRef.current = drawScratches(
          scratchCtx,
          width,
          height,
          scratchesRef.current,
          scratches
        )
      } else {
        scratchCanvas.style.opacity = '0'
      }

      // Dust
      if (dust > 0) {
        dustCanvas.style.opacity = String(dust)
        dustRef.current = drawDust(
          dustCtx,
          width,
          height,
          dustRef.current,
          dust
        )
      } else {
        dustCanvas.style.opacity = '0'
      }

      // Light leaks
      if (lightLeaks > 0) {
        drawLightLeak(leakCtx, width, height, timestamp, lightLeaks)
      } else {
        leakCtx.clearRect(0, 0, width, height)
      }
    },
    [grain, weave, flicker, scratches, lightLeaks, dust, width, height]
  )

  useAnimationFrame(animate)

  // Calculate color fade filter
  const colorFadeFilter =
    colorFade > 0
      ? `sepia(${colorFade * 60}%) saturate(${1 - colorFade * 0.5}) brightness(${1 + colorFade * 0.1})`
      : 'none'

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ filter: colorFadeFilter }}
    >
      {/* Film grain overlay */}
      <canvas
        ref={grainCanvasRef}
        className="absolute inset-0"
        style={{ mixBlendMode: 'overlay' }}
      />

      {/* Scratches overlay */}
      <canvas ref={scratchCanvasRef} className="absolute inset-0" />

      {/* Dust overlay */}
      <canvas ref={dustCanvasRef} className="absolute inset-0" />

      {/* Light leaks overlay */}
      <canvas ref={leakCanvasRef} className="absolute inset-0" />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  )
}
