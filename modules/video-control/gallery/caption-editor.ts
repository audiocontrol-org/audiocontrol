/**
 * Caption table editor for the detail view.
 * Handles CRUD operations on caption rows and serialization to YAML.
 */
import { parseCaptionsYaml } from './captions.js';

interface CaptionRow {
  id: string;
  type: string;
  inTc: string;
  outTc: string;
  text: string;
  position: string;
}

interface DemoRef {
  name: string;
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

function cleanupCaptionOverlay(): void {
  if (captionCleanup) {
    captionCleanup();
    captionCleanup = null;
  }
}

function buildCaptionTable(
  rows: CaptionRow[],
  detail: DemoRef,
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
    empty.textContent = 'No captions available. Click "+ Add Caption" to create one.';
    section.appendChild(empty);
  }

  const table = document.createElement('table');
  table.className = 'detail-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th class="col-type">Type</th>
    <th class="col-in">In</th>
    <th class="col-out">Out</th>
    <th class="col-text">Text</th>
    <th class="col-actions"></th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  const buildRow = (row: CaptionRow, index: number): HTMLTableRowElement => {
    const tr = document.createElement('tr');

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

    const tdIn = document.createElement('td');
    const inputIn = document.createElement('input');
    inputIn.type = 'text';
    inputIn.value = row.inTc;
    inputIn.addEventListener('input', () => { row.inTc = inputIn.value; });
    tdIn.appendChild(inputIn);
    tr.appendChild(tdIn);

    const tdOut = document.createElement('td');
    const inputOut = document.createElement('input');
    inputOut.type = 'text';
    inputOut.value = row.outTc;
    inputOut.addEventListener('input', () => { row.outTc = inputOut.value; });
    tdOut.appendChild(inputOut);
    tr.appendChild(tdOut);

    const tdText = document.createElement('td');
    const inputText = document.createElement('input');
    inputText.type = 'text';
    inputText.value = row.text;
    inputText.addEventListener('input', () => { row.text = inputText.value; });
    tdText.appendChild(inputText);
    tr.appendChild(tdText);

    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    Object.assign(delBtn.style, {
      background: 'none', border: 'none', color: '#ef4444',
      cursor: 'pointer', fontSize: '16px', padding: '2px 6px',
    });
    delBtn.title = 'Delete caption';
    delBtn.addEventListener('click', () => {
      rows.splice(index, 1);
      rebuildTableBody();
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    return tr;
  };

  const rebuildTableBody = (): void => {
    tbody.innerHTML = '';
    rows.forEach((row, i) => tbody.appendChild(buildRow(row, i)));
  };

  rebuildTableBody();
  table.appendChild(tbody);
  section.appendChild(table);

  // Add caption button
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add Caption';
  Object.assign(addBtn.style, {
    marginTop: '8px', padding: '4px 12px', backgroundColor: '#374151',
    color: '#d1d5db', border: '1px solid #4b5563', borderRadius: '4px',
    cursor: 'pointer', fontSize: '12px',
  });
  addBtn.addEventListener('click', () => {
    const lastRow = rows[rows.length - 1];
    const newIn = lastRow ? lastRow.outTc : '0:00.000';
    rows.push({
      id: `caption-${rows.length}`,
      type: 'step',
      inTc: newIn,
      outTc: newIn,
      text: '',
      position: 'bottom-center',
    });
    rebuildTableBody();
  });
  section.appendChild(addBtn);

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
      applyCaptionOverlay(videoWrap, video, updatedYaml);
    }
  });

  return section;
}

export type { CaptionRow };
export { buildCaptionTable, applyCaptionOverlay, cleanupCaptionOverlay, showSaved };
