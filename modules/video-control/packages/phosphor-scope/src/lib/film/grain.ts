/**
 * Draw film grain effect on canvas.
 * Uses coarse 2px blocks for authentic film look.
 */
export function drawFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  const blockSize = 2

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      // Centered around mid-gray for overlay blending
      const v = Math.floor(Math.random() * 80 + 88)

      for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * 4
          data[idx] = v
          data[idx + 1] = v
          data[idx + 2] = v
          data[idx + 3] = 255
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}
