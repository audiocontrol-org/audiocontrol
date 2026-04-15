import type { RGB } from './colors'
import { getRGBA, getBrightRGB } from './colors'

interface SpectrumParams {
  gain: number
  density: number
  beamWidth: number
}

export function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: RGB,
  alpha: number,
  frequencyData: Uint8Array,
  params: SpectrumParams
): void {
  const len = frequencyData.length
  const logMin = Math.log(1)
  const logMax = Math.log(len)
  const barCount = Math.floor(width * params.density * 0.5)

  // Main beam
  ctx.lineWidth = params.beamWidth
  ctx.strokeStyle = getRGBA(color, alpha)
  ctx.beginPath()

  for (let i = 0; i < barCount; i++) {
    const logIndex = logMin + (i / barCount) * (logMax - logMin)
    const freqIndex = Math.min(Math.floor(Math.exp(logIndex)), len - 1)
    const value = frequencyData[freqIndex] / 255
    const boosted = Math.pow(value, 0.7) * params.gain
    const x = (i / barCount) * width
    const barH = boosted * height * 0.85
    const y = height - barH
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // Beam hotspot
  ctx.beginPath()
  ctx.strokeStyle = getRGBA(getBrightRGB(color), alpha * 0.4)
  ctx.lineWidth = params.beamWidth * 0.3

  for (let i = 0; i < barCount; i++) {
    const logIndex = logMin + (i / barCount) * (logMax - logMin)
    const freqIndex = Math.min(Math.floor(Math.exp(logIndex)), len - 1)
    const value = frequencyData[freqIndex] / 255
    const boosted = Math.pow(value, 0.7) * params.gain
    const x = (i / barCount) * width
    const barH = boosted * height * 0.85
    const y = height - barH
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
}
