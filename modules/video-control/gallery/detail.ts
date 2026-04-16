import { renderProgressPanel } from './progress.js';
import { buildCaptionTable, applyCaptionOverlay, cleanupCaptionOverlay, showSaved } from './caption-editor.js';
import type { CaptionRow } from './caption-editor.js';

interface FileInfo {
  name: string;
  size: number;
}

interface DemoDetail {
  name: string;
  generated: boolean;
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

function buildNotGeneratedView(detail: DemoDetail, root: HTMLElement): void {
  const notice = document.createElement('div');
  Object.assign(notice.style, {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#9ca3af',
  });

  const msg = document.createElement('p');
  msg.textContent = `No video has been generated for "${detail.name}" yet.`;
  msg.style.marginBottom = '16px';
  notice.appendChild(msg);

  const genBtn = document.createElement('button');
  genBtn.textContent = 'Generate Now';
  Object.assign(genBtn.style, {
    padding: '8px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  });

  const progressDiv = document.createElement('div');
  progressDiv.className = 'progress-panel';
  progressDiv.style.display = 'none';
  progressDiv.style.maxWidth = '400px';
  progressDiv.style.margin = '16px auto 0';
  progressDiv.style.textAlign = 'left';

  genBtn.addEventListener('click', () => {
    genBtn.disabled = true;
    genBtn.style.display = 'none';
    msg.textContent = `Generating "${detail.name}"...`;
    progressDiv.style.display = 'block';

    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: detail.name, tier: 'scripted' }),
    }).then(() => {
      const poll = setInterval(() => {
        fetch('/api/generate/status')
          .then((r) => r.json())
          .then((s: {
            status: string;
            steps?: Array<{ step: string; status: string; elapsedMs: number | null }>;
            elapsedMs?: number;
            estimatedRemainingMs?: number | null;
          }) => {
            if (s.status === 'generating' && s.steps) {
              progressDiv.innerHTML = renderProgressPanel(
                s.steps,
                s.elapsedMs ?? 0,
                s.estimatedRemainingMs ?? null,
              );
            }
            if (s.status === 'complete' || s.status === 'error' || s.status === 'idle') {
              clearInterval(poll);
              const container = root.parentElement;
              if (container) {
                container.innerHTML = '';
                container.dataset.scenario = '';
                location.hash = `#/detail/${detail.name}`;
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            }
          });
      }, 1000);
    });
  });

  notice.appendChild(genBtn);
  notice.appendChild(progressDiv);
  root.appendChild(notice);
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

  if (!detail.generated) {
    buildNotGeneratedView(detail, root);
    return root;
  }

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
  if (container.dataset.scenario === scenarioName && container.children.length > 0) {
    return;
  }

  container.innerHTML = '';
  container.dataset.scenario = scenarioName;

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
  cleanupCaptionOverlay();
  container.innerHTML = '';
  container.dataset.scenario = '';
}

export { mountDetailView, unmountDetailView };
