interface DemoInfo {
  name: string;
  mp4Url: string;
  gifUrl: string | null;
  hasCaptions: boolean;
  hasVoScript: boolean;
  durationMs: number;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '--:--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createCard(demo: DemoInfo): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

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
    placeholder.textContent = 'No preview';
    thumb.appendChild(placeholder);
  }

  // Click to play
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
  });

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

  // Links row
  const links = document.createElement('div');
  links.className = 'card-links';

  if (demo.hasCaptions) {
    const a = document.createElement('a');
    a.href = `/videos/${demo.name}/captions.yaml`;
    a.target = '_blank';
    a.textContent = 'Captions';
    links.appendChild(a);
  }

  if (demo.hasVoScript) {
    const a = document.createElement('a');
    a.href = `/videos/${demo.name}/vo-script.txt`;
    a.target = '_blank';
    a.textContent = 'VO Script';
    links.appendChild(a);
  }

  if (links.childElementCount > 0) {
    info.appendChild(links);
  }

  card.appendChild(info);
  return card;
}

function renderGrid(demos: DemoInfo[]): void {
  const grid = document.getElementById('grid');
  if (!grid) return;

  if (demos.length === 0) {
    grid.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML =
      'No demo videos found.<br>' +
      '<code>make demo-scenario SCENARIO=&lt;name&gt;</code> to generate one.';
    grid.appendChild(empty);
    return;
  }

  grid.innerHTML = '';
  for (const demo of demos) {
    grid.appendChild(createCard(demo));
  }
}

let lastJson = '';

async function fetchAndRender(): Promise<void> {
  try {
    const res = await fetch('/api/demos');
    const json = await res.text();
    if (json !== lastJson) {
      lastJson = json;
      const demos: DemoInfo[] = JSON.parse(json);
      renderGrid(demos);
    }
  } catch (err) {
    console.error('Failed to fetch demos:', err);
  }
}

// Initial load
fetchAndRender();

// Poll every 5 seconds
setInterval(fetchAndRender, 5000);
