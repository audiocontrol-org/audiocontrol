import type { Page } from 'playwright';
import type { Caption, ScenarioMetadata } from '../src/types.js';

export const metadata: ScenarioMetadata = {
  name: 's3k-zone-editor',
  description:
    'Visual demo of the Akai S3000XL keygroup zone editor with interactive drag interactions',
  mode: 'harness',
  outputTier: 'silent',
};

export const captions: Caption[] = [
  {
    text: 'The S3000XL editor includes a visual keygroup zone mapper for assigning samples across the keyboard.',
    timestampMs: 0,
    durationMs: 6000,
    type: 'title',
  },
  {
    text: 'The zone overview shows all keygroups in the current program. Each colored rectangle represents a keygroup\'s range on the keyboard.',
    timestampMs: 6000,
    durationMs: 7000,
    type: 'step',
  },
  {
    text: 'Clicking a keygroup selects it for editing. The selected zone is highlighted in blue.',
    timestampMs: 13000,
    durationMs: 5000,
    type: 'step',
  },
  {
    text: 'The key range editor appears below, showing a draggable bar for the selected keygroup\'s note range.',
    timestampMs: 18000,
    durationMs: 6000,
    type: 'step',
  },
  {
    text: 'Dragging the right handle extends the upper boundary. The zone overview updates in real time as the range changes.',
    timestampMs: 24000,
    durationMs: 7000,
    type: 'step',
  },
  {
    text: 'The left handle adjusts the lower boundary the same way.',
    timestampMs: 31000,
    durationMs: 5300,
    type: 'step',
  },
  {
    text: 'Selecting a different keygroup switches the range editor to show that keygroup\'s boundaries.',
    timestampMs: 36300,
    durationMs: 6000,
    type: 'step',
  },
  {
    text: 'Each keygroup\'s range can be adjusted independently.',
    timestampMs: 42300,
    durationMs: 5300,
    type: 'step',
  },
  {
    text: 'Zones can be positioned precisely to create splits, layers, and velocity-switched programs.',
    timestampMs: 47600,
    durationMs: 5000,
    type: 'callout',
  },
];

interface Keygroup {
  lowNote: number;
  highNote: number;
  lowVel: number;
  highVel: number;
  sample: string;
  hue: number;
}

const KEYGROUPS: ReadonlyArray<Keygroup> = [
  { lowNote: 36, highNote: 59, lowVel: 0, highVel: 127, sample: 'Piano_Low', hue: 0 },
  { lowNote: 60, highNote: 83, lowVel: 0, highVel: 127, sample: 'Piano_Mid', hue: 90 },
  { lowNote: 84, highNote: 107, lowVel: 0, highVel: 127, sample: 'Piano_High', hue: 180 },
  { lowNote: 108, highNote: 127, lowVel: 0, highVel: 127, sample: 'Piano_Bright', hue: 270 },
];

async function smoothDrag(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number,
  stepDelayMs: number,
): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t,
    );
    await page.waitForTimeout(stepDelayMs);
  }
  await page.mouse.up();
}

async function getNoteXOnBar(
  page: Page,
  note: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate((n: number) => {
    const bar = document.getElementById('range-bar');
    if (!bar) throw new Error('range-bar element not found');
    const rect = bar.getBoundingClientRect();
    return { x: rect.left + (n / 127) * rect.width, y: rect.top + rect.height / 2 };
  }, note);
}

export const run = async (page: Page): Promise<void> => {
  // Step 1: Title card (6s)
  // VO: "The S3000XL editor includes a visual keygroup zone mapper
  //      for assigning samples across the keyboard."
  await page.evaluate(() => {
    const body = document.body;
    Object.assign(body.style, {
      margin: '0', backgroundColor: '#111827',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff', minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', paddingTop: '40px',
    });
    const section = document.createElement('div');
    section.id = 'title-section';
    Object.assign(section.style, { textAlign: 'center', marginBottom: '32px' });

    const title = document.createElement('h1');
    title.textContent = 'Akai S3000XL Editor';
    Object.assign(title.style, { color: '#ffffff', fontSize: '1.5rem', margin: '0 0 8px 0' });

    const subtitle = document.createElement('h2');
    subtitle.textContent = 'Keygroup Zone Mapping';
    Object.assign(subtitle.style, {
      color: '#9ca3af', fontSize: '1rem', margin: '0', fontWeight: '400',
    });
    section.appendChild(title);
    section.appendChild(subtitle);
    body.appendChild(section);
  });
  await page.waitForTimeout(6000);

  // Step 2: Build ZoneOverview (7s)
  // VO: "The zone overview shows all keygroups in the current program.
  //      Each colored rectangle represents a keygroup's range on the keyboard."
  await page.evaluate((keygroups: ReadonlyArray<Keygroup>) => {
    const OW = 600, OH = 240, LA = 36;
    const VW = OW - LA, VH = OH - 20;
    const MIN_N = 36, NOTE_R = 127 - MIN_N;

    const ctr = document.createElement('div');
    ctr.id = 'zone-overview';
    Object.assign(ctr.style, {
      width: `${OW}px`, height: `${OH}px`, position: 'relative',
      background: 'rgba(17,24,39,0.7)', border: '1px solid #374151',
      borderRadius: '6px', margin: '0 auto', overflow: 'hidden',
    });

    // Velocity labels
    [['127', 0], ['64', 0.5], ['0', 1]].forEach(([label, pos]) => {
      const el = document.createElement('div');
      el.textContent = String(label);
      Object.assign(el.style, {
        position: 'absolute', left: '2px',
        top: `${Number(pos) * VH - 6}px`, fontSize: '10px', color: '#6b7280',
      });
      ctr.appendChild(el);
    });

    // Note labels and vertical grid lines
    const octaves: Array<[string, number]> = [
      ['C2', 36], ['C3', 48], ['C4', 60], ['C5', 72], ['C6', 84], ['C7', 96], ['C8', 108],
    ];
    octaves.forEach(([label, midi]) => {
      const x = LA + ((midi - MIN_N) / NOTE_R) * VW;
      const el = document.createElement('div');
      el.textContent = label;
      Object.assign(el.style, {
        position: 'absolute', left: `${x - 8}px`, bottom: '2px',
        fontSize: '10px', color: '#6b7280',
      });
      ctr.appendChild(el);
      const line = document.createElement('div');
      Object.assign(line.style, {
        position: 'absolute', left: `${x}px`, top: '0',
        width: '1px', height: `${VH}px`, backgroundColor: 'rgba(75,85,99,0.3)',
      });
      ctr.appendChild(line);
    });

    // Horizontal midline
    const mid = document.createElement('div');
    Object.assign(mid.style, {
      position: 'absolute', left: `${LA}px`, top: `${VH * 0.5}px`,
      width: `${VW}px`, height: '1px', backgroundColor: 'rgba(75,85,99,0.3)',
    });
    ctr.appendChild(mid);

    // Keygroup zone rectangles
    keygroups.forEach((kg, i) => {
      const x = LA + ((kg.lowNote - MIN_N) / NOTE_R) * VW;
      const w = ((kg.highNote - kg.lowNote) / NOTE_R) * VW;
      const y = ((127 - kg.highVel) / 128) * VH;
      const h = ((kg.highVel - kg.lowVel + 1) / 128) * VH;

      const zone = document.createElement('div');
      zone.setAttribute('data-kg', String(i));
      Object.assign(zone.style, {
        position: 'absolute', left: `${x}px`, top: `${y}px`,
        width: `${w}px`, height: `${h}px`,
        backgroundColor: `hsla(${kg.hue}, 55%, 55%, 0.35)`,
        border: `1px solid hsl(${kg.hue}, 65%, 70%)`,
        borderRadius: '3px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
      });
      const label = document.createElement('span');
      label.textContent = kg.sample;
      Object.assign(label.style, { color: '#ffffff', fontSize: '11px', pointerEvents: 'none' });
      zone.appendChild(label);

      zone.addEventListener('click', () => {
        document.querySelectorAll<HTMLDivElement>('[data-kg]').forEach((el) => {
          const idx = Number(el.getAttribute('data-kg'));
          const kd = keygroups[idx];
          Object.assign(el.style, {
            border: `1px solid hsl(${kd.hue}, 65%, 70%)`,
            boxShadow: 'none', zIndex: '1',
          });
        });
        Object.assign(zone.style, {
          border: '2px solid #93c5fd',
          boxShadow: '0 0 8px rgba(147, 197, 253, 0.4)', zIndex: '10',
        });
      });
      ctr.appendChild(zone);
    });
    document.body.appendChild(ctr);
  }, [...KEYGROUPS]);
  await page.waitForTimeout(7000);

  // Step 3: Select keygroup 2 (5s)
  // VO: "Clicking a keygroup selects it for editing.
  //      The selected zone is highlighted in blue."
  await page.locator('[data-kg="1"]').click();
  await page.waitForTimeout(5000);

  // Step 4: Show KeyRangeEditor with drag support (6s)
  // VO: "The key range editor appears below, showing a draggable bar
  //      for the selected keygroup's note range."
  await page.evaluate((kg: Keygroup) => {
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const nn = (midi: number): string => `${NOTES[midi % 12]}${Math.floor(midi / 12) - 2}`;

    const wrap = document.createElement('div');
    wrap.id = 'range-editor';
    Object.assign(wrap.style, { width: '600px', margin: '24px auto 0' });

    const rangeText = document.createElement('div');
    rangeText.id = 'range-text';
    rangeText.textContent = `${nn(kg.lowNote)} — ${nn(kg.highNote)}`;
    Object.assign(rangeText.style, {
      textAlign: 'center', marginBottom: '8px', fontSize: '14px', color: '#d1d5db',
    });

    const bar = document.createElement('div');
    bar.id = 'range-bar';
    Object.assign(bar.style, {
      position: 'relative', width: '100%', height: '32px',
      backgroundColor: '#111827', border: '1px solid #4b5563',
      borderRadius: '4px', overflow: 'visible', boxSizing: 'border-box',
    });

    const fill = document.createElement('div');
    fill.id = 'range-fill';
    Object.assign(fill.style, {
      position: 'absolute', top: '0', height: '100%',
      backgroundColor: 'rgba(29, 78, 216, 0.6)', borderRadius: '3px',
      left: `${(kg.lowNote / 127) * 100}%`,
      width: `${((kg.highNote - kg.lowNote) / 127) * 100}%`,
    });

    const makeHandle = (side: 'low' | 'high'): HTMLDivElement => {
      const h = document.createElement('div');
      h.setAttribute('data-handle', side);
      Object.assign(h.style, {
        position: 'absolute', top: '0', width: '8px', height: '100%',
        backgroundColor: '#3b82f6', cursor: 'ew-resize', zIndex: '5',
        borderRadius: '2px', transform: 'translateX(-4px)',
        left: side === 'low' ? '0' : '100%',
      });
      return h;
    };
    const lowH = makeHandle('low');
    const highH = makeHandle('high');
    fill.appendChild(lowH);
    fill.appendChild(highH);
    bar.appendChild(fill);

    const labels = document.createElement('div');
    Object.assign(labels.style, {
      display: 'flex', justifyContent: 'space-between',
      marginTop: '4px', fontSize: '10px', color: '#6b7280',
    });
    ['C0','C1','C2','C3','C4','C5','C6','C7','C8'].forEach((lbl) => {
      const s = document.createElement('span');
      s.textContent = lbl;
      labels.appendChild(s);
    });

    wrap.appendChild(rangeText);
    wrap.appendChild(bar);
    wrap.appendChild(labels);
    document.body.appendChild(wrap);

    // Hidden state element to share drag state across evaluate calls
    const stateEl = document.createElement('input');
    stateEl.type = 'hidden';
    stateEl.id = 'zone-editor-state';
    const initialState = {
      currentLow: kg.lowNote, currentHigh: kg.highNote, selectedKg: 1,
    };
    stateEl.value = JSON.stringify(initialState);
    document.body.appendChild(stateEl);

    // Drag mechanics
    const LA = 36, MIN_N = 36, NOTE_R = 127 - MIN_N;
    let dragHandle: 'low' | 'high' | null = null;

    const readState = (): { currentLow: number; currentHigh: number; selectedKg: number } =>
      JSON.parse(stateEl.value);
    const writeState = (s: { currentLow: number; currentHigh: number; selectedKg: number }): void => {
      stateEl.value = JSON.stringify(s);
    };

    const updateVisuals = (): void => {
      const s = readState();
      const rt = document.getElementById('range-text');
      const fl = document.getElementById('range-fill');
      if (!rt || !fl) return;
      rt.textContent = `${nn(s.currentLow)} — ${nn(s.currentHigh)}`;
      fl.style.left = `${(s.currentLow / 127) * 100}%`;
      fl.style.width = `${((s.currentHigh - s.currentLow) / 127) * 100}%`;
      const zoneEl = document.querySelector<HTMLDivElement>(
        `[data-kg="${s.selectedKg}"]`,
      );
      if (zoneEl) {
        const vizW = 600 - LA;
        zoneEl.style.left = `${LA + ((s.currentLow - MIN_N) / NOTE_R) * vizW}px`;
        zoneEl.style.width = `${((s.currentHigh - s.currentLow) / NOTE_R) * vizW}px`;
      }
    };

    lowH.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      dragHandle = 'low';
    });
    highH.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      dragHandle = 'high';
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (dragHandle === null) return;
      const barRect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - barRect.left) / barRect.width));
      const note = Math.round(ratio * 127);
      const s = readState();
      if (dragHandle === 'low') {
        s.currentLow = Math.min(note, s.currentHigh - 1);
      } else {
        s.currentHigh = Math.max(note, s.currentLow + 1);
      }
      writeState(s);
      updateVisuals();
    });
    document.addEventListener('mouseup', () => { dragHandle = null; });
  }, KEYGROUPS[1]);
  await page.waitForTimeout(6000);

  // Step 5: Drag right handle to extend range (7s: ~2s drag + 5s post)
  // VO: "Dragging the right handle extends the upper boundary.
  //      The zone overview updates in real time as the range changes."
  const rightStart = await getNoteXOnBar(page, 83);
  const rightEnd = await getNoteXOnBar(page, 95);
  await smoothDrag(page, rightStart.x, rightStart.y, rightEnd.x, rightEnd.y, 20, 100);
  await page.waitForTimeout(5000);

  // Step 6: Drag left handle (5s: ~1.8s drag + 3.2s post)
  // VO: "The left handle adjusts the lower boundary the same way."
  const leftStart = await getNoteXOnBar(page, 60);
  const leftEnd = await getNoteXOnBar(page, 48);
  await smoothDrag(page, leftStart.x, leftStart.y, leftEnd.x, leftEnd.y, 18, 100);
  await page.waitForTimeout(3500);

  // Step 7: Click keygroup 3, update range editor (6s)
  // VO: "Selecting a different keygroup switches the range editor
  //      to show that keygroup's boundaries."
  await page.locator('[data-kg="2"]').click();
  await page.evaluate((kg: Keygroup) => {
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const nn = (midi: number): string => `${NOTES[midi % 12]}${Math.floor(midi / 12) - 2}`;
    const stateEl = document.getElementById('zone-editor-state');
    if (!(stateEl instanceof HTMLInputElement)) throw new Error('State element not found');
    const s = JSON.parse(stateEl.value);
    s.currentLow = kg.lowNote;
    s.currentHigh = kg.highNote;
    s.selectedKg = 2;
    stateEl.value = JSON.stringify(s);
    const rt = document.getElementById('range-text');
    const fl = document.getElementById('range-fill');
    if (rt) rt.textContent = `${nn(kg.lowNote)} — ${nn(kg.highNote)}`;
    if (fl) {
      fl.style.left = `${(kg.lowNote / 127) * 100}%`;
      fl.style.width = `${((kg.highNote - kg.lowNote) / 127) * 100}%`;
    }
  }, KEYGROUPS[2]);
  await page.waitForTimeout(6000);

  // Step 8: Drag KG 3's right handle (5s: ~1.8s drag + 3.2s post)
  // VO: "Each keygroup's range can be adjusted independently."
  const kg3RightStart = await getNoteXOnBar(page, 107);
  const kg3RightEnd = await getNoteXOnBar(page, 115);
  await smoothDrag(page, kg3RightStart.x, kg3RightStart.y, kg3RightEnd.x, kg3RightEnd.y, 18, 100);
  await page.waitForTimeout(3500);

  // Step 9: Hold final state (5s)
  // VO: "Zones can be positioned precisely to create splits, layers,
  //      and velocity-switched programs."
  await page.waitForTimeout(5000);
};
