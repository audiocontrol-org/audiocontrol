import type { RGB } from './colors'
import { getRGBA, getBrightRGB } from './colors'

interface LissajousParams {
  gain: number
  density: number
  beamWidth: number
}

export function drawLissajous(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: RGB,
  alpha: number,
  leftChannel: Uint8Array,
  rightChannel: Uint8Array,
  params: LissajousParams
): void {
  const len = Math.min(leftChannel.length, rightChannel.length)
  const step = Math.max(1, Math.floor(1 / params.density))
  const cx = width / 2
  const cy = height / 2
  const scale = Math.min(width, height) * 0.4

  // Main beam
  ctx.beginPath()
  ctx.strokeStyle = getRGBA(color, alpha)
  ctx.lineWidth = params.beamWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (let i = 0; i < len; i += step) {
    const leftSample = ((leftChannel[i] - 128) / 128) * params.gain
    const rightSample = ((rightChannel[i] - 128) / 128) * params.gain
    const x = cx + leftSample * scale
    const y = cy - rightSample * scale
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // Beam hotspot
  ctx.beginPath()
  ctx.strokeStyle = getRGBA(getBrightRGB(color), alpha * 0.5)
  ctx.lineWidth = params.beamWidth * 0.3

  for (let i = 0; i < len; i += step) {
    const leftSample = ((leftChannel[i] - 128) / 128) * params.gain
    const rightSample = ((rightChannel[i] - 128) / 128) * params.gain
    const x = cx + leftSample * scale
    const y = cy - rightSample * scale
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}
