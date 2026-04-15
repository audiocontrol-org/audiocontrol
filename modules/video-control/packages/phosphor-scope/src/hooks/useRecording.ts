import { useRef, useCallback, useEffect } from 'react'
import { VideoRecorder } from '@audiocontrol/video-core'
import { useAudioStore, useRecordingStore, useScopeStore, useFilmStore } from '@/stores'
import {
  PHOSPHOR_COLORS,
  drawWaveform,
  drawLissajous,
  drawSpectrum,
} from '@/lib/rendering'
import {
  drawFilmGrain,
  drawScratches,
  drawDust,
  drawLightLeak,
  calculateFlicker,
  calculateWeave,
} from '@/lib/film'
import type { Scratch, DustParticle } from '@/lib/film'

export function useRecording() {
  const recorderRef = useRef<VideoRecorder | null>(null)
  const animationRef = useRef<number | null>(null)
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scratchesRef = useRef<Scratch[]>([])
  const dustRef = useRef<DustParticle[]>([])

  const { engine, isLoaded } = useAudioStore()
  const { format, setIsRecording, setElapsedTime, reset } = useRecordingStore()
  const scope = useScopeStore()
  const film = useFilmStore()

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = new VideoRecorder()

    recorderRef.current.on('complete', ({ blob, filename }) => {
      VideoRecorder.downloadBlob(blob, filename)
      reset()
    })

    recorderRef.current.on('timeupdate', ({ elapsedTime }) => {
      setElapsedTime(elapsedTime)
    })

    recorderRef.current.on('error', (error) => {
      console.error('Recording error:', error)
      reset()
    })

    // Create glow canvas for persistence effect
    glowCanvasRef.current = document.createElement('canvas')

    return () => {
      recorderRef.current?.dispose()
    }
  }, [reset, setElapsedTime])

  // Update format when it changes
  useEffect(() => {
    if (recorderRef.current && !recorderRef.current.isRecording) {
      recorderRef.current.setFormat(format)
    }
  }, [format])

  // Draw a frame to the recording canvas
  const drawRecordingFrame = useCallback(
    (timestamp: number) => {
      const recorder = recorderRef.current
      const glowCanvas = glowCanvasRef.current
      if (!recorder || !glowCanvas) return

      const ctx = recorder.getRecordingContext()
      const W = recorder.getRecordingCanvas().width
      const H = recorder.getRecordingCanvas().height

      // Ensure glow canvas matches
      if (glowCanvas.width !== W || glowCanvas.height !== H) {
        glowCanvas.width = W
        glowCanvas.height = H
      }

      const glowCtx = glowCanvas.getContext('2d')
      if (!glowCtx) return

      const phosphorColor = PHOSPHOR_COLORS[scope.color]

      // Calculate weave offset
      const weaveOffset = calculateWeave(timestamp, film.weave)

      // Apply weave transform
      ctx.save()
      ctx.translate(weaveOffset.x, weaveOffset.y)

      // Persistence fade on glow canvas
      glowCtx.globalCompositeOperation = 'source-over'
      glowCtx.fillStyle = `rgba(0, 0, 0, ${1 - scope.persistence})`
      glowCtx.fillRect(0, 0, W, H)

      // Get analysis data
      const analysisData = engine.getAnalysisData()
      if (analysisData) {
        glowCtx.globalCompositeOperation = 'lighter'

        const flicker = 1 - Math.random() * scope.flickerAmount
        const alpha = Math.min(1, 0.9 * flicker)
        const renderParams = {
          gain: scope.gain,
          density: scope.density,
          beamWidth: scope.beamWidth,
        }

        if (scope.mode === 'waveform') {
          drawWaveform(glowCtx, W, H, phosphorColor, alpha, analysisData.timeDomainLeft, renderParams)
        } else if (scope.mode === 'lissajous') {
          drawLissajous(glowCtx, W, H, phosphorColor, alpha, analysisData.timeDomainLeft, analysisData.timeDomainRight, renderParams)
        } else if (scope.mode === 'spectrum') {
          drawSpectrum(glowCtx, W, H, phosphorColor, alpha, analysisData.frequencyData, renderParams)
        }
      }

      // Clear main canvas
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Apply bloom/glow
      if (scope.bloomRadius > 0) {
        ctx.filter = `blur(${scope.bloomRadius}px)`
        ctx.globalAlpha = scope.glowIntensity * 0.3
        ctx.drawImage(glowCanvas, 0, 0)
        ctx.filter = 'none'
        ctx.globalAlpha = 1
      }

      // Draw sharp trace
      ctx.drawImage(glowCanvas, 0, 0)

      // Scanlines
      if (scope.scanlineAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${scope.scanlineAlpha})`
        for (let y = 0; y < H; y += 2) {
          ctx.fillRect(0, y, W, 1)
        }
      }

      // CRT noise
      if (scope.noiseAmount > 0) {
        const imageData = ctx.getImageData(0, 0, W, H)
        const data = imageData.data
        const noiseScale = scope.noiseAmount * 50
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * noiseScale
          data[i] = Math.max(0, Math.min(255, data[i] + noise))
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
        }
        ctx.putImageData(imageData, 0, 0)
      }

      ctx.restore()

      // Film effects (applied on top)
      // Film grain
      if (film.grain > 0) {
        const grainCanvas = document.createElement('canvas')
        grainCanvas.width = W
        grainCanvas.height = H
        const grainCtx = grainCanvas.getContext('2d')
        if (grainCtx) {
          drawFilmGrain(grainCtx, W, H)
          ctx.globalAlpha = film.grain * 0.4
          ctx.globalCompositeOperation = 'overlay'
          ctx.drawImage(grainCanvas, 0, 0)
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
        }
      }

      // Scratches
      if (film.scratches > 0) {
        const scratchCanvas = document.createElement('canvas')
        scratchCanvas.width = W
        scratchCanvas.height = H
        const scratchCtx = scratchCanvas.getContext('2d')
        if (scratchCtx) {
          scratchesRef.current = drawScratches(scratchCtx, W, H, scratchesRef.current, film.scratches)
          ctx.globalAlpha = film.scratches
          ctx.drawImage(scratchCanvas, 0, 0)
          ctx.globalAlpha = 1
        }
      }

      // Dust
      if (film.dust > 0) {
        const dustCanvas = document.createElement('canvas')
        dustCanvas.width = W
        dustCanvas.height = H
        const dustCtx = dustCanvas.getContext('2d')
        if (dustCtx) {
          dustRef.current = drawDust(dustCtx, W, H, dustRef.current, film.dust)
          ctx.globalAlpha = film.dust
          ctx.drawImage(dustCanvas, 0, 0)
          ctx.globalAlpha = 1
        }
      }

      // Light leaks
      if (film.lightLeaks > 0) {
        const leakCanvas = document.createElement('canvas')
        leakCanvas.width = W
        leakCanvas.height = H
        const leakCtx = leakCanvas.getContext('2d')
        if (leakCtx) {
          drawLightLeak(leakCtx, W, H, timestamp, film.lightLeaks)
          ctx.drawImage(leakCanvas, 0, 0)
        }
      }

      // Vignette
      const vigGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7)
      vigGrad.addColorStop(0, 'transparent')
      vigGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)')
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = vigGrad
      ctx.fillRect(0, 0, W, H)

      // Brightness flicker
      const flickerBrightness = calculateFlicker(timestamp, film.flicker)
      if (flickerBrightness < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - flickerBrightness})`
        ctx.fillRect(0, 0, W, H)
      } else if (flickerBrightness > 1) {
        ctx.fillStyle = `rgba(255,255,255,${(flickerBrightness - 1) * 0.3})`
        ctx.fillRect(0, 0, W, H)
      }

      // Color fade (sepia effect)
      if (film.colorFade > 0) {
        const imageData = ctx.getImageData(0, 0, W, H)
        const data = imageData.data
        const sepiaAmount = film.colorFade

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Sepia transformation
          const newR = Math.min(255, r * (1 - sepiaAmount) + (r * 0.393 + g * 0.769 + b * 0.189) * sepiaAmount)
          const newG = Math.min(255, g * (1 - sepiaAmount) + (r * 0.349 + g * 0.686 + b * 0.168) * sepiaAmount)
          const newB = Math.min(255, b * (1 - sepiaAmount) + (r * 0.272 + g * 0.534 + b * 0.131) * sepiaAmount)

          data[i] = newR
          data[i + 1] = newG
          data[i + 2] = newB
        }

        ctx.putImageData(imageData, 0, 0)
      }
    },
    [engine, scope, film]
  )

  // Recording animation loop
  const recordingLoop = useCallback(
    (timestamp: number) => {
      if (!recorderRef.current?.isRecording) return

      drawRecordingFrame(timestamp)
      animationRef.current = requestAnimationFrame(recordingLoop)
    },
    [drawRecordingFrame]
  )

  // Start recording
  const startRecording = useCallback(() => {
    if (!isLoaded || !recorderRef.current) return

    // Reset film effect state
    scratchesRef.current = []
    dustRef.current = []

    // Create audio stream from engine
    const audioDestination = engine.createMediaStreamDestination()
    const audioStream = audioDestination?.stream

    // Start recorder
    recorderRef.current.start(audioStream ?? undefined)
    setIsRecording(true)

    // Start playback if not already playing
    engine.stop()

    // Create source that also routes to the audio destination for recording
    const audioContext = engine.getAudioContext()
    const audioBuffer = engine.getAudioBuffer()
    if (audioContext && audioBuffer && audioDestination) {
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.connect(audioDestination)

      source.onended = () => {
        stopRecording()
      }

      source.start(0)
    }

    // Start recording animation loop
    animationRef.current = requestAnimationFrame(recordingLoop)
  }, [isLoaded, engine, setIsRecording, recordingLoop])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    recorderRef.current?.stop()
    engine.stop()
    setIsRecording(false)
  }, [engine, setIsRecording])

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (recorderRef.current?.isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [startRecording, stopRecording])

  return {
    startRecording,
    stopRecording,
    toggleRecording,
    isRecording: recorderRef.current?.isRecording ?? false,
  }
}
