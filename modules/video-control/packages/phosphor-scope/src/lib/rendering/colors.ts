import type { PhosphorColor } from '@audiocontrol/video-core'

export interface RGB {
  r: number
  g: number
  b: number
}

export const PHOSPHOR_COLORS: Record<PhosphorColor, RGB> = {
  green: { r: 57, g: 255, b: 20 },
  amber: { r: 255, g: 191, b: 0 },
  blue: { r: 0, g: 212, b: 255 },
  white: { r: 220, g: 220, b: 220 },
}

export function getRGBA(color: RGB, alpha: number): string {
  return `rgba(${color.r},${color.g},${color.b},${alpha})`
}

export function getBrightRGB(color: RGB): RGB {
  return {
    r: Math.min(255, color.r + 100),
    g: Math.min(255, color.g + 100),
    b: Math.min(255, color.b + 100),
  }
}
