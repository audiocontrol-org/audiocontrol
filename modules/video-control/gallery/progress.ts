/**
 * Shared progress rendering for gallery cards and detail view.
 */

export interface StepInfo {
  step: string;
  status: 'pending' | 'running' | 'done';
  startedAt: number | null;
  completedAt: number | null;
  elapsedMs: number | null;
}

export const STEP_LABELS: Record<string, string> = {
  'launching-browser': 'Launching browser',
  'recording-scenario': 'Recording scenario',
  'finalizing-video': 'Finalizing video',
  'converting-mp4': 'Converting MP4',
  'converting-gif': 'Converting GIF',
  'generating-captions': 'Generating captions',
  'generating-vo-script': 'Generating VO script',
  'burning-captions': 'Burning captions',
  'complete': 'Complete',
};

export const humanizeStep = (step: string): string =>
  STEP_LABELS[step] ?? step.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const formatElapsedCompact = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function renderProgressPanel(
  steps: ReadonlyArray<StepInfo>,
  elapsedMs: number,
  estimatedRemainingMs: number | null,
): string {
  const rows = steps.map((s) => {
    const icon = s.status === 'done'
      ? '<span style="color:#4ade80">✓</span>'
      : s.status === 'running'
        ? '<span class="progress-step-icon" style="color:#60a5fa">●</span>'
        : '<span style="color:#4b5563">○</span>';
    const label = humanizeStep(s.step);
    const time = s.status === 'done' && s.elapsedMs !== null
      ? `<span style="color:#6b7280;font-size:12px;font-family:monospace">${(s.elapsedMs / 1000).toFixed(1)}s</span>`
      : s.status === 'running'
        ? '<span style="color:#6b7280;font-size:12px">...</span>'
        : '';
    const opacity = s.status === 'pending' ? 'opacity:0.4' : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;${opacity}">${icon} <span>${label}</span> <span style="margin-left:auto">${time}</span></div>`;
  }).join('');

  const eta = estimatedRemainingMs !== null
    ? `~${formatElapsedCompact(estimatedRemainingMs)}`
    : '--:--';
  const footer = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #374151;font-size:12px;color:#6b7280;text-align:center;font-family:monospace">Elapsed: ${formatElapsedCompact(elapsedMs)}  |  ETA: ${eta}</div>`;

  return rows + footer;
}
