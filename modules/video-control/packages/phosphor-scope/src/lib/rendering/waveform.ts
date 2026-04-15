import type { RGB } from './colors'
import { getRGBA, getBrightRGB } from './colors'

interface WaveformParams {
  gain: number
  density: number
  beamWidth: number
}

export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: RGB,
  alpha: number,
  timeDomainData: Uint8Array,
  params: WaveformParams
): void {
  const len = timeDomainData.length
  const step = Math.max(1, Math.floor(1 / params.density))
  const midY = height / 2

  // Main beam
  ctx.beginPath()
  ctx.strokeStyle = getRGBA(color, alpha)
  ctx.lineWidth = params.beamWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (let i = 0; i < len; i += step) {
    const x = (i / len) * width
    const sample = ((timeDomainData[i] - 128) / 128) * params.gain
    const y = midY - sample * (height * 0.4)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // Beam hotspot (brighter center)
  ctx.beginPath()
  ctx.strokeStyle = getRGBA(getBrightRGB(color), alpha * 0.5)
  ctx.lineWidth = params.beamWidth * 0.4

  for (let i = 0; i < len; i += step) {
    const x = (i / len) * width
    const sample = ((timeDomainData[i] - 128) / 128) * params.gain
    const y = midY - sample * (height * 0.4)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}
