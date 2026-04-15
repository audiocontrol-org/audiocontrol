import { execFile } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { Caption } from '@/types.js';

const execFileAsync = promisify(execFile);

/**
 * Get video duration in milliseconds using ffprobe.
 */
export async function getVideoDurationMs(videoPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'quiet',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    videoPath,
  ]);
  const seconds = parseFloat(stdout.trim());
  if (isNaN(seconds)) {
    throw new Error(
      `Failed to parse video duration from ffprobe output: "${stdout.trim()}"`,
    );
  }
  return Math.round(seconds * 1000);
}

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

/**
 * Format milliseconds to ASS timestamp format: H:MM:SS.cc (centiseconds).
 */
const formatAssTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

/**
 * Generate ASS subtitle file content from captions.
 */
const generateAssContent = (captions: ReadonlyArray<Caption>): string => {
  const lines: string[] = [];

  // Script Info section
  lines.push('[Script Info]');
  lines.push('ScriptType: v4.00+');
  lines.push('PlayResX: 1280');
  lines.push('PlayResY: 720');
  lines.push('');

  // Styles section
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  lines.push('Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,3,2,0,2,10,10,30,1');
  lines.push('');

  // Events section
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  for (const caption of captions) {
    const start = formatAssTimestamp(caption.timestampMs);
    const end = formatAssTimestamp(caption.timestampMs + caption.durationMs);
    lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${caption.text}`);
  }

  return lines.join('\n') + '\n';
};

/**
 * Burn captions into an MP4 as permanent subtitle overlays using ffmpeg's ASS filter.
 * Generates a temporary .ass file, renders subtitles into the video, then cleans up.
 */
export async function burnCaptions(
  inputMp4: string,
  outputMp4: string,
  captions: ReadonlyArray<Caption>,
): Promise<void> {
  const assContent = generateAssContent(captions);
  const assPath = join(tmpdir(), `captions-${Date.now()}.ass`);

  await writeFile(assPath, assContent, 'utf-8');

  try {
    await execFileAsync('ffmpeg', [
      '-i',
      inputMp4,
      '-vf',
      `ass=${assPath}`,
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'medium',
      '-pix_fmt',
      'yuv420p',
      '-y',
      outputMp4,
    ]);
  } finally {
    await unlink(assPath);
  }
}
