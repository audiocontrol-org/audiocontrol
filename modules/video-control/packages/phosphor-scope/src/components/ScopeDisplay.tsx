import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudioStore, useScopeStore } from '@/stores'
import { useAnimationFrame } from '@/hooks'
import {
  PHOSPHOR_COLORS,
  drawWaveform,
  drawLissajous,
  drawSpectrum,
} from '@/lib/rendering'
import { FilmEffects } from './FilmEffects'

export function ScopeDisplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const { engine, isLoaded, isPlaying } = useAudioStore()
  const {
    mode,
    color,
    persistence,
    glowIntensity,
    beamWidth,
    bloomRadius,
    gain,
    density,
    scanlineAlpha,
    noiseAmount,
    flickerAmount,
  } = useScopeStore()

  // Resize canvas to match container
  useEffect(() => {
    const resizeCanvas = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      const glowCanvas = glowCanvasRef.current
      if (!container || !canvas || !glowCanvas) return

      const { width, height } = container.getBoundingClientRect()
      const size = Math.min(width, height) - 40 // Padding

      canvas.width = size
      canvas.height = size
      glowCanvas.width = size
      glowCanvas.height = size
      setCanvasSize({ width: size, height: size })
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // Animation frame callback
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    const glowCanvas = glowCanvasRef.current
    if (!canvas || !glowCanvas) return

    const ctx = canvas.getContext('2d')
    const glowCtx = glowCanvas.getContext('2d')
    if (!ctx || !glowCtx) return

    const W = canvas.width
    const H = canvas.height
    const phosphorColor = PHOSPHOR_COLORS[color]

    // Persistence fade on glow canvas
    glowCtx.globalCompositeOperation = 'source-over'
    glowCtx.fillStyle = `rgba(0, 0, 0, ${1 - persistence})`
    glowCtx.fillRect(0, 0, W, H)

    // Get analysis data if playing
    if (isPlaying) {
      const analysisData = engine.getAnalysisData()
      if (analysisData) {
        glowCtx.globalCompositeOperation = 'lighter'

        // Calculate alpha with flicker
        const flicker = 1 - Math.random() * flickerAmount
        const alpha = Math.min(1, 0.9 * flicker)

        const renderParams = { gain, density, beamWidth }

        if (mode === 'waveform') {
          drawWaveform(
            glowCtx,
            W,
            H,
            phosphorColor,
            alpha,
            analysisData.timeDomainLeft,
            renderParams
          )
        } else if (mode === 'lissajous') {
          drawLissajous(
            glowCtx,
            W,
            H,
            phosphorColor,
            alpha,
            analysisData.timeDomainLeft,
            analysisData.timeDomainRight,
            renderParams
          )
        } else if (mode === 'spectrum') {
          drawSpectrum(
            glowCtx,
            W,
            H,
            phosphorColor,
            alpha,
            analysisData.frequencyData,
            renderParams
          )
        }
      }
    }

    // Clear main canvas and draw CRT effects
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    // Apply bloom/glow effect
    if (bloomRadius > 0) {
      ctx.filter = `blur(${bloomRadius}px)`
      ctx.globalAlpha = glowIntensity * 0.3
      ctx.drawImage(glowCanvas, 0, 0)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
    }

    // Draw the sharp trace on top
    ctx.drawImage(glowCanvas, 0, 0)

    // Scanlines
    if (scanlineAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${scanlineAlpha})`
      for (let y = 0; y < H; y += 2) {
        ctx.fillRect(0, y, W, 1)
      }
    }

    // Noise
    if (noiseAmount > 0) {
      const imageData = ctx.getImageData(0, 0, W, H)
      const data = imageData.data
      const noiseScale = noiseAmount * 50

      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * noiseScale
        data[i] = Math.max(0, Math.min(255, data[i] + noise))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
      }

      ctx.putImageData(imageData, 0, 0)
    }
  }, [
    engine,
    isPlaying,
    mode,
    color,
    persistence,
    glowIntensity,
    beamWidth,
    bloomRadius,
    gain,
    density,
    scanlineAlpha,
    noiseAmount,
    flickerAmount,
  ])

  useAnimationFrame(animate)

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-black relative overflow-hidden"
    >
      {!isLoaded ? (
        <div className="text-center">
          <div className="text-6xl opacity-20 mb-4">📻</div>
          <p className="font-mono text-sm text-gray-600">
            Drag and drop an audio file here
          </p>
          <p className="mt-2 font-mono text-xs text-gray-700">
            Supports MP3, WAV, FLAC
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Glow canvas (accumulation buffer) - hidden */}
          <canvas
            ref={glowCanvasRef}
            className="absolute inset-0 opacity-0 pointer-events-none"
          />
          {/* Main display canvas */}
          <canvas
            ref={canvasRef}
            className="rounded-full border-4 border-gray-800 shadow-2xl"
            style={{
              boxShadow: `0 0 60px rgba(${PHOSPHOR_COLORS[color].r}, ${PHOSPHOR_COLORS[color].g}, ${PHOSPHOR_COLORS[color].b}, 0.3)`,
            }}
          />
          {/* Film effects overlay */}
          {canvasSize.width > 0 && (
            <FilmEffects width={canvasSize.width} height={canvasSize.height} />
          )}
        </div>
      )}
    </div>
  )
}
