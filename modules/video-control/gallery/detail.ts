import { parseCaptionsYaml, CaptionEntry } from './captions.js';

interface FileInfo {
  name: string;
  size: number;
}

interface DemoDetail {
  name: string;
  mp4Url: string | null;
  gifUrl: string | null;
  hasCaptions: boolean;
  hasCaptionedMp4: boolean;
  hasVoScript: boolean;
  durationMs: number;
  files: FileInfo[];
  captionsYaml: string | null;
  voScript: string | null;
}

interface CaptionRow {
  id: string;
  type: string;
  inTc: string;
  outTc: string;
  text: string;
  position: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '--:--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function fetchDetail(name: string): Promise<DemoDetail> {
  const res = await fetch(`/api/demo?name=${encodeURIComponent(name)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch detail for ${name}: ${res.status}`);
  }
  return await res.json() as DemoDetail;
}

function parseCaptionRows(yaml: string): CaptionRow[] {
  const rows: CaptionRow[] = [];
  const pat = /- id:\s*"([^"]+)"\s*\n\s+type:\s*(\S+)\s*\n\s+text:\s*"([^"]+)"\s*\n\s+in:\s*"([^"]+)"\s*\n\s+out:\s*"([^"]+)"\s*\n\s+position:\s*(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = pat.exec(yaml)) !== null) {
    rows.push({ id: m[1], type: m[2], inTc: m[4], outTc: m[5], text: m[3], position: m[6] });
  }
  return rows;
}

function serializeCaptionsYaml(yaml: string, rows: CaptionRow[]): string {
  const idx = yaml.indexOf('overlays:');
  const header = idx >= 0 ? yaml.substring(0, idx) : yaml + '\n';
  return header + 'overlays:\n' + rows.map((r) =>
    `  - id: "${r.id}"\n    type: ${r.type}\n    text: "${r.text}"\n    in: "${r.inTc}"\n    out: "${r.outTc}"\n    position: ${r.position}\n`,
  ).join('');
}

function showSaved(parent: HTMLElement): void {
  parent.querySelector('.detail-saved')?.remove();
  const s = document.createElement('span');
  s.className = 'detail-saved';
  s.textContent = 'Saved!';
  parent.appendChild(s);
  setTimeout(() => s.classList.add('fade-out'), 1500);
  setTimeout(() => s.remove(), 2000);
}

let captionCleanup: (() => void) | null = null;

function applyCaptionOverlay(wrap: HTMLElement, video: HTMLVideoElement, yaml: string | null): void {
  if (captionCleanup) { captionCleanup(); captionCleanup = null; }
  wrap.querySelector('.caption-overlay')?.remove();
  if (!yaml) return;
  const entries = parseCaptionsYaml(yaml);
  if (entries.length === 0) return;

  const el = document.createElement('div');
  el.className = 'caption-overlay';
  wrap.appendChild(el);

  let rafId = 0;
  const tick = (): void => {
    const t = video.currentTime;
    const active = entries.find((c) => t >= c.inSec && t < c.outSec);
    el.textContent = active ? active.text : '';
    el.style.display = active ? 'block' : 'none';
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  captionCleanup = () => cancelAnimationFrame(rafId);
}

function buildCaptionTable(
  rows: CaptionRow[],
  detail: DemoDetail,
  videoWrap: HTMLElement,
  video: HTMLVideoElement,
  originalYaml: string,
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const headerDiv = document.createElement('div');
  headerDiv.className = 'detail-section-header';

  const title = document.createElement('span');
  title.className = 'detail-section-title';
  title.textContent = 'Captions';
  headerDiv.appendChild(title);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'detail-save-btn';
  saveBtn.textContent = 'Save';
  headerDiv.appendChild(saveBtn);
  section.appendChild(headerDiv);

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#6b7280';
    empty.style.fontSize = '0.8rem';
    empty.textContent = 'No captions available';
    section.appendChild(empty);
    return section;
  }

  const table = document.createElement('table');
  table.className = 'detail-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th class="col-type">Type</th>
    <th class="col-in">In</th>
    <th class="col-out">Out</th>
    <th class="col-text">Text</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');

    // Type dropdown
    const tdType = document.createElement('td');
    const select = document.createElement('select');
    for (const opt of ['title', 'lower-third', 'callout']) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === row.type) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => { row.type = select.value; });
    tdType.appendChild(select);
    tr.appendChild(tdType);

    // In timecode
    const tdIn = document.createElement('td');
    const inputIn = document.createElement('input');
    inputIn.type = 'text';
    inputIn.value = row.inTc;
    inputIn.addEventListener('input', () => { row.inTc = inputIn.value; });
    tdIn.appendChild(inputIn);
    tr.appendChild(tdIn);

    // Out timecode
    const tdOut = document.createElement('td');
    const inputOut = document.createElement('input');
    inputOut.type = 'text';
    inputOut.value = row.outTc;
    inputOut.addEventListener('input', () => { row.outTc = inputOut.value; });
    tdOut.appendChild(inputOut);
    tr.appendChild(tdOut);

    // Text
    const tdText = document.createElement('td');
    const inputText = document.createElement('input');
    inputText.type = 'text';
    inputText.value = row.text;
    inputText.addEventListener('input', () => { row.text = inputText.value; });
    tdText.appendChild(inputText);
    tr.appendChild(tdText);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  section.appendChild(table);

  // Save handler
  saveBtn.addEventListener('click', async () => {
    const updatedYaml = serializeCaptionsYaml(originalYaml, rows);
    const res = await fetch('/api/save-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: detail.name, content: updatedYaml }),
    });
    if (res.ok) {
      showSaved(headerDiv);
      // Refresh caption overlay on the video
      applyCaptionOverlay(videoWrap, video, updatedYaml);
    }
  });

  return section;
}

function buildVoScriptEditor(detail: DemoDetail): HTMLElement {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const headerDiv = document.createElement('div');
  headerDiv.className = 'detail-section-header';

  const title = document.createElement('span');
  title.className = 'detail-section-title';
  title.textContent = 'VO Script';
  headerDiv.appendChild(title);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'detail-save-btn';
  saveBtn.textContent = 'Save';
  headerDiv.appendChild(saveBtn);
  section.appendChild(headerDiv);

  const textarea = document.createElement('textarea');
  textarea.className = 'detail-textarea';
  textarea.value = detail.voScript ?? '';
  section.appendChild(textarea);

  if (!detail.voScript) {
    textarea.placeholder = 'No VO script available';
  }

  saveBtn.addEventListener('click', async () => {
    const res = await fetch('/api/save-vo-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: detail.name, content: textarea.value }),
    });
    if (res.ok) {
      showSaved(headerDiv);
    }
  });

  return section;
}

function buildDetailView(detail: DemoDetail): HTMLElement {
  const root = document.createElement('div');
  root.className = 'detail-view';

  // Header
  const header = document.createElement('div');
  header.className = 'detail-header';

  const backLink = document.createElement('a');
  backLink.className = 'detail-back';
  backLink.href = '#/';
  backLink.textContent = '\u2190 Back to Gallery';
  header.appendChild(backLink);

  const name = document.createElement('span');
  name.className = 'detail-name';
  name.textContent = detail.name;
  header.appendChild(name);

  root.appendChild(header);

  // Video player
  const videoWrap = document.createElement('div');
  videoWrap.className = 'detail-video-wrap';

  let video: HTMLVideoElement | null = null;
  if (detail.mp4Url) {
    video = document.createElement('video');
    video.className = 'detail-video';
    video.src = detail.mp4Url;
    video.controls = true;
    videoWrap.appendChild(video);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'detail-video';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.color = '#6b7280';
    placeholder.textContent = 'No video available';
    videoWrap.appendChild(placeholder);
  }

  root.appendChild(videoWrap);

  // Apply caption overlay to video
  if (video && detail.captionsYaml) {
    applyCaptionOverlay(videoWrap, video, detail.captionsYaml);
  }

  // Metadata
  const meta = document.createElement('div');
  meta.className = 'detail-metadata';
  meta.innerHTML = `<span>${detail.name}</span>`
    + `<span>${formatDuration(detail.durationMs)}</span>`
    + `<span>${detail.files.length} files</span>`;
  root.appendChild(meta);

  // Files
  if (detail.files.length > 0) {
    const filesDiv = document.createElement('div');
    filesDiv.className = 'detail-files';
    for (const f of detail.files) {
      const link = document.createElement('a');
      link.href = '#';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        fetch('/api/open-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: detail.name, file: f.name }),
        });
      });
      link.textContent = f.name;

      const size = document.createElement('span');
      size.className = 'file-size';
      size.textContent = `(${formatBytes(f.size)})`;

      const wrapper = document.createElement('span');
      wrapper.appendChild(link);
      wrapper.appendChild(size);
      filesDiv.appendChild(wrapper);
    }
    root.appendChild(filesDiv);
  }

  // Caption table
  const captionRows = detail.captionsYaml ? parseCaptionRows(detail.captionsYaml) : [];
  const videoForCaptions = video ?? document.createElement('video');
  root.appendChild(buildCaptionTable(captionRows, detail, videoWrap, videoForCaptions, detail.captionsYaml ?? ''));

  // VO Script editor
  root.appendChild(buildVoScriptEditor(detail));

  return root;
}

function mountDetailView(scenarioName: string, container: HTMLElement): void {
  // Avoid re-mounting the same scenario
  if (container.dataset.scenario === scenarioName && container.children.length > 0) {
    return;
  }

  container.innerHTML = '';
  container.dataset.scenario = scenarioName;

  // Show loading state
  const loading = document.createElement('div');
  loading.className = 'detail-view';
  loading.style.color = '#9ca3af';
  loading.textContent = 'Loading...';
  container.appendChild(loading);

  fetchDetail(scenarioName)
    .then((detail) => {
      container.innerHTML = '';
      container.appendChild(buildDetailView(detail));
    })
    .catch((err: Error) => {
      container.innerHTML = '';
      const errDiv = document.createElement('div');
      errDiv.className = 'detail-view';
      errDiv.style.color = '#f87171';
      errDiv.textContent = `Failed to load: ${err.message}`;
      container.appendChild(errDiv);
    });
}

function unmountDetailView(container: HTMLElement): void {
  if (captionCleanup) {
    captionCleanup();
    captionCleanup = null;
  }
  container.innerHTML = '';
  container.dataset.scenario = '';
}

export { mountDetailView, unmountDetailView };
