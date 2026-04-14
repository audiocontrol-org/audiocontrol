import { execFile } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Convert WebM to MP4 using h264 codec.
 */
export async function convertToMp4(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p',
    '-y',
    outputPath,
  ]);
}

/**
 * Convert WebM to GIF using palette-based conversion for quality.
 * Max 15fps to keep file size reasonable.
 */
export async function convertToGif(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const paletteFilter = 'fps=15,scale=640:-1:flags=lanczos';
  const palettePath = outputPath.replace(/\.gif$/, '-palette.png');

  // Pass 1: Generate palette
  await execFileAsync('ffmpeg', [
    '-i',
    inputPath,
    '-vf',
    `${paletteFilter},palettegen`,
    '-y',
    palettePath,
  ]);

  // Pass 2: Use palette to generate GIF
  await execFileAsync('ffmpeg', [
    '-i',
    inputPath,
    '-i',
    palettePath,
    '-lavfi',
    `${paletteFilter} [x]; [x][1:v] paletteuse`,
    '-y',
    outputPath,
  ]);

  // Clean up palette file
  await unlink(palettePath);
}
