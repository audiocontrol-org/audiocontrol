import { setupCaptionsForVideo } from './captions.js';

async function postApi(endpoint: string, body: Record<string, string>): Promise<void> {
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface DemoInfo {
  name: string;
  mp4Url: string;
  gifUrl: string | null;
  hasCaptions: boolean;
  hasCaptionedMp4: boolean;
  hasVoScript: boolean;
  durationMs: number;
}

interface ScenarioInfo { name: string; description: string; mode: string; outputTier: string; file: string }

interface StepInfo {
  step: string;
  status: 'pending' | 'running' | 'done';
  startedAt: number | null;
  completedAt: number | null;
  elapsedMs: number | null;
}

interface GenerateStatusIdle { status: 'idle' }
interface GenerateStatusGenerating {
  status: 'generating';
  scenario: string;
  currentStep: string;
  steps: StepInfo[];
  elapsedMs: number;
  estimatedRemainingMs: number | null;
}
interface GenerateStatusComplete { status: 'complete'; scenario: string; elapsedMs: number }
interface GenerateStatusError { status: 'error'; scenario: string; error: string; elapsedMs: number }
type GenerateStatus = GenerateStatusIdle | GenerateStatusGenerating | GenerateStatusComplete | GenerateStatusError;

const STEP_LABELS: Record<string, string> = {
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

function humanizeStep(step: string): string {
  return STEP_LABELS[step] ?? step.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatElapsedCompact(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderProgressPanel(status: GenerateStatusGenerating): string {
  const stepRows = status.steps.map((s) => {
    const label = humanizeStep(s.step);
    const cls = `progress-step progress-step-${s.status}`;
    let icon = '<span class="progress-step-icon"></span>';
    if (s.status === 'done') icon = '<span class="progress-step-icon">\u2713</span>';
    if (s.status === 'running') icon = '<span class="progress-step-icon">\u25CF</span>';

    const elapsed = s.status === 'done' && s.elapsedMs !== null
      ? `<span class="progress-step-elapsed">${(s.elapsedMs / 1000).toFixed(1)}s</span>`
      : s.status === 'running'
        ? `<span class="progress-step-elapsed">\u2026</span>`
        : '';

    return `<div class="${cls}">${icon}<span class="progress-step-label">${label}</span>${elapsed}</div>`;
  }).join('');

  const elapsedStr = formatElapsedCompact(status.elapsedMs);
  const etaStr = status.estimatedRemainingMs !== null
    ? `~${formatElapsedCompact(status.estimatedRemainingMs)}`
    : '--:--';

  return `<div class="progress-panel">${stepRows}</div>`
    + `<div class="progress-footer">Elapsed: ${elapsedStr}  |  ETA: ${etaStr}</div>`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '--:--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function ensureOverlay(card: HTMLElement): HTMLElement {
  let overlay = card.querySelector('.card-generating-overlay') as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'card-generating-overlay';
    card.querySelector('.card-thumb')?.appendChild(overlay);
  }
  return overlay;
}

function setCardGenerating(card: HTMLElement, generating: boolean): void {
  if (generating) {
    ensureOverlay(card);
    card.classList.add('generating');
  } else {
    const overlay = card.querySelector('.card-generating-overlay') as HTMLElement | null;
    overlay?.remove();
    card.classList.remove('generating');
  }
}

function updateCardProgress(card: HTMLElement, status: GenerateStatusGenerating): void {
  card.classList.add('generating');
  const overlay = ensureOverlay(card);
  overlay.innerHTML = renderProgressPanel(status);
}

function setCardError(card: HTMLElement, message: string): void {
  const info = card.querySelector('.card-info');
  if (!info) return;
  const errEl = document.createElement('div');
  errEl.className = 'card-error';
  errEl.textContent = message;
  info.appendChild(errEl);
  setTimeout(() => errEl.remove(), 5000);
}

async function pollUntilDone(card: HTMLElement | null): Promise<GenerateStatus> {
  while (true) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch('/api/generate/status');
    const status: GenerateStatus = await res.json();
    if (status.status === 'generating' && card) {
      updateCardProgress(card, status);
    }
    if (status.status !== 'generating') return status;
  }
}

async function generateScenario(
  scenarioName: string,
  tier: string,
  card: HTMLElement | null,
): Promise<GenerateStatus> {
  if (card) setCardGenerating(card, true);

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: scenarioName, tier }),
  });

  if (res.status === 409) {
    const body = await res.json() as { error?: string };
    if (card) {
      setCardGenerating(card, false);
      setCardError(card, 'Another generation in progress');
    }
    return { status: 'error', scenario: scenarioName, error: body.error ?? 'Conflict', elapsedMs: 0 };
  }

  const result = await pollUntilDone(card);

  if (card) {
    setCardGenerating(card, false);
    if (result.status === 'error') {
      setCardError(card, result.error);
    }
  }

  return result;
}

function createRegenButton(scenarioName: string, hasVideo: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn-regen';
  btn.textContent = hasVideo ? '\u21BB' : 'Generate';
  btn.title = hasVideo ? 'Regenerate video' : 'Generate video';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const card = btn.closest('.card') as HTMLElement | null;
    generateScenario(scenarioName, 'scripted', card);
  });
  return btn;
}

function createCard(demo: DemoInfo, scenarioName: string | null): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.scenario = scenarioName ?? demo.name;

  const hasVideo = demo.durationMs > 0;

  // Thumbnail area
  const thumb = document.createElement('div');
  thumb.className = 'card-thumb';

  if (demo.gifUrl) {
    const img = document.createElement('img');
    img.src = demo.gifUrl;
    img.alt = `${demo.name} preview`;
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder';
    placeholder.textContent = hasVideo ? 'No preview' : 'Not yet generated';
    thumb.appendChild(placeholder);
  }

  // Click to play (only if video exists)
  if (hasVideo) {
    thumb.addEventListener('click', () => {
      const existing = thumb.querySelector('video');
      if (existing) return;

      thumb.innerHTML = '';
      const video = document.createElement('video');
      video.src = demo.mp4Url;
      video.controls = true;
      video.autoplay = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'contain';
      video.style.backgroundColor = '#000';
      thumb.appendChild(video);

      // Load captions and set up overlay + toggle
      setupCaptionsForVideo(demo, card, thumb, video);
    });
  }

  card.appendChild(thumb);

  // Info area
  const info = document.createElement('div');
  info.className = 'card-info';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = demo.name;
  info.appendChild(title);

  const duration = document.createElement('span');
  duration.className = 'card-duration';
  duration.textContent = formatDuration(demo.durationMs);
  info.appendChild(duration);

  info.appendChild(createRegenButton(scenarioName ?? demo.name, hasVideo));

  // Links row
  const links = document.createElement('div');
  links.className = 'card-links';

  if (hasVideo) {
    const mp4Link = document.createElement('a');
    mp4Link.href = '#';
    mp4Link.textContent = 'MP4';
    mp4Link.addEventListener('click', (e) => {
      e.preventDefault();
      postApi('/api/open-file', { scenario: demo.name, file: 'video.mp4' });
    });
    links.appendChild(mp4Link);
  }

  if (demo.gifUrl) {
    const gifLink = document.createElement('a');
    gifLink.href = '#';
    gifLink.textContent = 'GIF';
    gifLink.addEventListener('click', (e) => {
      e.preventDefault();
      postApi('/api/open-file', { scenario: demo.name, file: 'video.gif' });
    });
    links.appendChild(gifLink);
  }

  if (demo.hasCaptions) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'Captions';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      postApi('/api/open-file', { scenario: demo.name, file: 'captions.yaml' });
    });
    links.appendChild(a);
  }

  if (demo.hasVoScript) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'VO Script';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      postApi('/api/open-file', { scenario: demo.name, file: 'vo-script.txt' });
    });
    links.appendChild(a);
  }

  // Show in Finder link
  const finderLink = document.createElement('a');
  finderLink.href = '#';
  finderLink.className = 'card-link-finder';
  finderLink.textContent = 'Show in Finder';
  finderLink.addEventListener('click', (e) => {
    e.preventDefault();
    postApi('/api/open-folder', { scenario: demo.name });
  });
  links.appendChild(finderLink);

  info.appendChild(links);

  card.appendChild(info);
  return card;
}

interface CardEntry { demo: DemoInfo; scenarioName: string | null }

function mergeCards(demos: DemoInfo[], scenarios: ScenarioInfo[]): CardEntry[] {
  const demoNames = new Set(demos.map((d) => d.name));
  const entries: CardEntry[] = demos.map((demo) => ({ demo, scenarioName: demo.name }));
  for (const s of scenarios) {
    if (!demoNames.has(s.name)) {
      entries.push({
        demo: { name: s.name, mp4Url: '', gifUrl: null, hasCaptions: false, hasCaptionedMp4: false, hasVoScript: false, durationMs: 0 },
        scenarioName: s.name,
      });
    }
  }
  return entries.sort((a, b) => a.demo.name.localeCompare(b.demo.name));
}

function renderGrid(demos: DemoInfo[], scenarios: ScenarioInfo[]): void {
  const grid = document.getElementById('grid');
  if (!grid) return;

  const merged = mergeCards(demos, scenarios);

  if (merged.length === 0) {
    grid.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML =
      'No demo videos or scenarios found.<br>' +
      '<code>make demo-scenario SCENARIO=&lt;name&gt;</code> to generate one.';
    grid.appendChild(empty);
    return;
  }

  grid.innerHTML = '';
  for (const { demo, scenarioName } of merged) {
    grid.appendChild(createCard(demo, scenarioName));
  }
}

// Header controls
function setupHeader(scenarios: ScenarioInfo[]): void {
  const btn = document.getElementById('generate-all-btn');
  const progress = document.getElementById('generate-all-progress');
  if (!btn || !progress) return;

  btn.addEventListener('click', async () => {
    btn.setAttribute('disabled', 'true');
    progress.style.display = 'inline';

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      progress.textContent = `Generating ${i + 1}/${scenarios.length}: ${scenario.name}...`;
      const card = document.querySelector(`[data-scenario="${scenario.name}"]`) as HTMLElement | null;
      const result = await generateScenario(scenario.name, 'scripted', card);
      if (result.status === 'error') {
        progress.textContent = `Failed: ${scenario.name} -- continuing...`;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    progress.textContent = 'Done';
    btn.removeAttribute('disabled');
    setTimeout(() => {
      progress.style.display = 'none';
    }, 2000);
  });
}

let lastJson = '';
let cachedScenarios: ScenarioInfo[] = [];

async function fetchScenarios(): Promise<ScenarioInfo[]> {
  const res = await fetch('/api/scenarios');
  return await res.json();
}

async function fetchAndRender(): Promise<void> {
  try {
    const res = await fetch('/api/demos');
    const json = await res.text();
    if (json !== lastJson) {
      lastJson = json;
      const demos: DemoInfo[] = JSON.parse(json);
      renderGrid(demos, cachedScenarios);
    }
  } catch (err) {
    console.error('Failed to fetch demos:', err);
  }
}

// Initial load
fetchScenarios()
  .then((scenarios) => {
    cachedScenarios = scenarios;
    setupHeader(scenarios);
    return fetchAndRender();
  })
  .catch((err) => console.error('Failed to fetch scenarios:', err));

// Poll every 5 seconds
setInterval(fetchAndRender, 5000);
