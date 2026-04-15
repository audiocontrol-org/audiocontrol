export interface CaptionEntry {
  text: string;
  inSec: number;
  outSec: number;
}

export type ViewMode = 'clean' | 'overlay' | 'burned';

interface DemoLike {
  name: string;
  mp4Url: string;
  hasCaptions: boolean;
  hasCaptionedMp4: boolean;
}

function parseTimecode(tc: string): number {
  const colonIdx = tc.indexOf(':');
  if (colonIdx === -1) return parseFloat(tc);
  const minutes = parseInt(tc.substring(0, colonIdx), 10);
  const rest = tc.substring(colonIdx + 1);
  const dotIdx = rest.indexOf('.');
  if (dotIdx === -1) return minutes * 60 + parseInt(rest, 10);
  const seconds = parseInt(rest.substring(0, dotIdx), 10);
  const millis = parseInt(rest.substring(dotIdx + 1), 10);
  return minutes * 60 + seconds + millis / 1000;
}

export function parseCaptionsYaml(yaml: string): CaptionEntry[] {
  const entries: CaptionEntry[] = [];
  const lines = yaml.split('\n');
  let currentText: string | null = null;
  let currentIn = 0;
  let currentOut = 0;

  for (const line of lines) {
    const textMatch = line.match(/^\s+text:\s*"(.+)"\s*$/);
    if (textMatch) {
      currentText = textMatch[1];
      continue;
    }
    const inMatch = line.match(/^\s+in:\s*"(.+)"\s*$/);
    if (inMatch) {
      currentIn = parseTimecode(inMatch[1]);
      continue;
    }
    const outMatch = line.match(/^\s+out:\s*"(.+)"\s*$/);
    if (outMatch) {
      currentOut = parseTimecode(outMatch[1]);
      if (currentText !== null) {
        entries.push({ text: currentText, inSec: currentIn, outSec: currentOut });
        currentText = null;
      }
    }
  }
  return entries;
}

export async function fetchCaptions(demoName: string): Promise<CaptionEntry[]> {
  const res = await fetch(`/videos/${demoName}/captions.yaml`);
  if (!res.ok) return [];
  const yaml = await res.text();
  return parseCaptionsYaml(yaml);
}

function createCaptionOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'caption-overlay';
  return overlay;
}

function startCaptionSync(
  video: HTMLVideoElement,
  overlay: HTMLElement,
  captions: CaptionEntry[],
): () => void {
  let rafId = 0;

  function tick(): void {
    const t = video.currentTime;
    const active = captions.find((c) => t >= c.inSec && t < c.outSec);
    if (active) {
      overlay.textContent = active.text;
      overlay.style.display = 'block';
    } else {
      overlay.style.display = 'none';
    }
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

interface ThumbWithCleanup extends HTMLElement {
  _captionCleanup?: () => void;
}

function clearOverlay(thumb: ThumbWithCleanup): void {
  const existingOverlay = thumb.querySelector('.caption-overlay');
  existingOverlay?.remove();
  if (thumb._captionCleanup) {
    thumb._captionCleanup();
    thumb._captionCleanup = undefined;
  }
}

function attachOverlay(thumb: ThumbWithCleanup, video: HTMLVideoElement, captions: CaptionEntry[]): void {
  const overlay = createCaptionOverlay();
  thumb.appendChild(overlay);
  thumb._captionCleanup = startCaptionSync(video, overlay, captions);
}

export function applyViewMode(
  mode: ViewMode,
  demo: DemoLike,
  thumb: HTMLElement,
  captions: CaptionEntry[],
): void {
  const video = thumb.querySelector('video');
  if (!video) return;

  const currentTime = video.currentTime;
  const wasPaused = video.paused;

  clearOverlay(thumb as ThumbWithCleanup);

  if (mode === 'burned') {
    video.src = `/videos/${demo.name}/video-captioned.mp4`;
    video.currentTime = currentTime;
    if (!wasPaused) video.play();
  } else {
    if (video.src.includes('video-captioned.mp4')) {
      video.src = demo.mp4Url;
      video.currentTime = currentTime;
      if (!wasPaused) video.play();
    }
    if (mode === 'overlay' && captions.length > 0) {
      attachOverlay(thumb as ThumbWithCleanup, video, captions);
    }
  }
}

export function createViewToggle(
  demo: DemoLike,
  thumb: HTMLElement,
  captions: CaptionEntry[],
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'view-toggle-bar';

  const modes: { label: string; mode: ViewMode; available: boolean }[] = [
    { label: 'Clean', mode: 'clean', available: true },
    { label: 'Overlay', mode: 'overlay', available: demo.hasCaptions && captions.length > 0 },
    { label: 'Burned', mode: 'burned', available: demo.hasCaptionedMp4 },
  ];

  const availableModes = modes.filter((m) => m.available);
  if (availableModes.length <= 1) return bar;

  const defaultMode: ViewMode = demo.hasCaptions && captions.length > 0 ? 'overlay' : 'clean';

  for (const m of availableModes) {
    const btn = document.createElement('button');
    btn.className = 'view-toggle-btn';
    btn.textContent = m.label;
    btn.dataset.mode = m.mode;
    if (m.mode === defaultMode) btn.classList.add('active');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      bar.querySelectorAll('.view-toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyViewMode(m.mode, demo, thumb, captions);
    });

    bar.appendChild(btn);
  }

  return bar;
}

export function setupCaptionsForVideo(
  demo: DemoLike,
  card: HTMLElement,
  thumb: HTMLElement,
  video: HTMLVideoElement,
): void {
  if (!demo.hasCaptions && !demo.hasCaptionedMp4) return;

  const captionsPromise = demo.hasCaptions
    ? fetchCaptions(demo.name)
    : Promise.resolve([]);

  captionsPromise.then((captions) => {
    // Insert view toggle bar before the thumb
    const existingToggle = card.querySelector('.view-toggle-bar');
    existingToggle?.remove();
    const toggleBar = createViewToggle(demo, thumb, captions);
    if (toggleBar.childElementCount > 0) {
      card.insertBefore(toggleBar, thumb);
    }

    // Default to overlay mode if captions available
    if (captions.length > 0) {
      attachOverlay(thumb as ThumbWithCleanup, video, captions);
    }
  });
}
