/**
 * Pure canvas drawing routine for the loop-editor split-pane view.
 *
 * Extracted from `LoopEditor.tsx` to keep that file under the per-file
 * length cap. The routine is a no-op when there are no samples to draw,
 * so the consumer can call it unconditionally inside an effect.
 *
 * Colors are passed as literal strings because canvas APIs can't read
 * CSS variables. The token equivalents are documented in
 * `LoopEditor.tsx` next to the color constants.
 */

import type { LoopCandidate } from '@audiocontrol/sampler-library';

export interface DrawWaveformOptions {
  readonly canvas: HTMLCanvasElement;
  readonly samples: Int16Array;
  readonly windowSamples: number;
  readonly startSample: number;
  readonly direction: 'left' | 'right';
  readonly endPoint: number;
  readonly loopPoint: number;
  readonly candidates: LoopCandidate[];
  readonly selectedCandidateIndex?: number;
  readonly colors: {
    waveform: string;
    bgLeft: string;
    bgRight: string;
    center: string;
    marker: string;
    candidate: string;
    selectedCandidate: string;
  };
}

export function drawWaveform({
  canvas,
  samples,
  windowSamples,
  startSample,
  direction,
  endPoint,
  loopPoint,
  candidates,
  selectedCandidateIndex,
  colors,
}: DrawWaveformOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || samples.length === 0) return;

  const width = canvas.width;
  const canvasHeight = canvas.height;
  const midY = canvasHeight / 2;

  ctx.fillStyle = direction === 'left' ? colors.bgLeft : colors.bgRight;
  ctx.fillRect(0, 0, width, canvasHeight);

  ctx.strokeStyle = colors.center;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  const samplesPerPixel = windowSamples / width;
  let sampleStart: number;
  let sampleEnd: number;

  if (direction === 'left') {
    sampleEnd = startSample;
    sampleStart = sampleEnd - windowSamples;
  } else {
    sampleStart = startSample;
    sampleEnd = sampleStart + windowSamples;
  }

  sampleStart = Math.max(0, sampleStart);
  sampleEnd = Math.min(samples.length, sampleEnd);

  if (candidates.length > 0) {
    candidates.forEach((candidate, index) => {
      const candidatePoint = direction === 'left' ? candidate.loopEnd : candidate.loopStart;
      const isSelected = index === selectedCandidateIndex;

      let xPos: number | null = null;
      if (candidatePoint >= sampleStart && candidatePoint <= sampleEnd) {
        if (direction === 'left') {
          xPos = ((candidatePoint - (startSample - windowSamples)) / windowSamples) * width;
        } else {
          xPos = ((candidatePoint - startSample) / windowSamples) * width;
        }
      }

      if (xPos !== null) {
        ctx.strokeStyle = isSelected ? colors.selectedCandidate : colors.candidate;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isSelected ? colors.selectedCandidate : colors.candidate;
        ctx.font = '9px monospace';
        ctx.fillText(`${index + 1}`, xPos + 2, canvasHeight - 4);
      }
    });
  }

  ctx.beginPath();
  ctx.strokeStyle = colors.waveform;
  ctx.lineWidth = 1;

  let firstPoint = true;
  for (let x = 0; x < width; x++) {
    let sampleIndex: number;
    if (direction === 'left') {
      sampleIndex = Math.floor(sampleEnd - windowSamples + x * samplesPerPixel);
    } else {
      sampleIndex = Math.floor(sampleStart + x * samplesPerPixel);
    }

    if (sampleIndex < 0 || sampleIndex >= samples.length) continue;

    const pixelSampleStart = sampleIndex;
    const pixelSampleEnd = Math.min(samples.length - 1, Math.floor(sampleIndex + samplesPerPixel));

    let minVal = samples[pixelSampleStart];
    let maxVal = samples[pixelSampleStart];
    for (let s = pixelSampleStart; s <= pixelSampleEnd; s++) {
      if (samples[s] < minVal) minVal = samples[s];
      if (samples[s] > maxVal) maxVal = samples[s];
    }

    const yMin = midY - (maxVal / 32768) * (midY - 2);
    const yMax = midY - (minVal / 32768) * (midY - 2);

    if (firstPoint) {
      ctx.moveTo(x, yMin);
      firstPoint = false;
    }
    ctx.lineTo(x, yMin);
    ctx.lineTo(x, yMax);
  }
  ctx.stroke();

  ctx.fillStyle = colors.marker;
  ctx.font = '10px monospace';
  const label = direction === 'left' ? `End: ${endPoint}` : `Loop: ${loopPoint}`;
  const labelX = direction === 'left' ? width - 60 : 4;
  ctx.fillText(label, labelX, 12);
}
