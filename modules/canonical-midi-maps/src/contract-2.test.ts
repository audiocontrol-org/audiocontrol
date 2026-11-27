import { describe, it, expect } from 'vitest';
import { stringify } from 'yaml';
import {
  contractOf,
  parseControllerMap,
  parseSurfaceLayout,
  parseSurfaceProfile,
  type ControllerMap,
  type SurfaceLayout,
  type SurfaceProfile,
} from './index.js';

type Doc = Record<string, unknown>;

function profileDoc(): Doc {
  return {
    contract: 2,
    surface: 'lcxl3-daw',
    kind: 'surface',
    device: { manufacturer: 'Acme', model: 'Pad 3' },
    ports: { input: 'Acme In', output: 'Acme Out' },
    controls: [
      { id: 'encoder_1_1', kind: 'encoder', address: { channel: 1, cc: 13 } },
      { id: 'fader_1', kind: 'fader', address: { channel: 1, cc: 77 }, follows: true },
      { id: 'button_side', kind: 'button', address: { channel: 1, cc: 100 } },
      { id: 'button_shift', kind: 'button', address: { channel: 1, cc: 101 } },
      { id: 'button_focus', kind: 'button', address: { channel: 1, cc: 102 } },
    ],
    protocol: {
      claim: [{ sysex: 'F0 00 20 {channel} F7' }, { cc: { channel: 16, number: 10, value: 127 } }],
      release: [{ sysex: 'F0 00 21 F7' }],
      mode: {
        address: { channel: 1, cc: 9 },
        ready: [127],
        suspended: [{ values: [0], reason: 'surface left the mode' }],
      },
      follow: { cc: { channel: '{channel}', number: '{cc}', value: '{value}' } },
      label: [{ sysex: 'F0 00 22 {cc} {text} F7' }],
      announce: [{ sysex: 'F0 00 23 {text} F7' }],
      indicate: { message: { cc: { channel: '{channel}', number: '{cc}', value: '{state}' } }, off: 0 },
    },
  };
}

function layoutDoc(): Doc {
  return {
    contract: 2,
    version: '1.0.0',
    surface: 'lcxl3-daw',
    kind: 'layout',
    bindings: [
      { role: 'page.next', press: { control: 'button_side' } },
      { role: 'page.prev', press: { control: 'button_side', with: 'button_shift' } },
    ],
    feedback: [{ role: 'page.next', active: 127, inactive: 0 }],
  };
}

function mapDoc(): Doc {
  return {
    contract: 2,
    version: '1.0.0',
    surface: 'lcxl3-daw',
    metadata: { name: 'Test map' },
    plugin: { manufacturer: 'Acme', name: 'Synth', luna_plugin_ids: ['acme.synth'] },
    pages: [
      {
        name: 'One',
        assignments: [{ control: 'encoder_1_1', parameter: { id: 'p1', name: 'Cutoff' } }],
      },
      {
        name: 'Two',
        assignments: [
          { control: 'fader_1', parameter: { id: 'p2', name: 'Level' } },
          { control: 'encoder_1_1', parameter: { id: 'p3', name: 'Res' } },
          { control: 'button_focus', parameter: { id: 'p4', name: 'Bypass' }, mode: 'toggle' },
        ],
      },
    ],
  };
}

function profile(doc: Doc = profileDoc()): SurfaceProfile {
  const r = parseSurfaceProfile(stringify(doc));
  if (!r.ok) throw new Error(`fixture profile invalid: ${r.errors.join('; ')}`);
  return r.value;
}

function layout(surface: SurfaceProfile, doc: Doc = layoutDoc()): SurfaceLayout {
  const r = parseSurfaceLayout(stringify(doc), surface);
  if (!r.ok) throw new Error(`fixture layout invalid: ${r.errors.join('; ')}`);
  return r.value;
}

function expectErrors(result: { ok: boolean; errors?: string[] }, expected: string): void {
  expect(result.ok).toBe(false);
  expect(result.errors).toContain(expected);
}

function withProtocol(patch: Doc): Doc {
  const doc = profileDoc();
  const protocol = doc.protocol;
  if (typeof protocol !== 'object' || protocol === null) throw new Error('fixture protocol missing');
  doc.protocol = { ...protocol, ...patch };
  return doc;
}

describe('parseSurfaceProfile', () => {
  it('accepts a valid profile', () => {
    const p = profile();
    expect(p.controls).toHaveLength(5);
    expect(p.ports.input).toBe('Acme In');
  });

  it('rejects an unknown placeholder', () => {
    const r = parseSurfaceProfile(stringify(withProtocol({ label: [{ sysex: 'F0 {foo} F7' }] })));
    expectErrors(r.ok ? { ok: true } : r, 'protocol.label[0].sysex: unknown placeholder {foo}');
  });

  it('rejects a sysex token that is neither a hex pair nor a placeholder', () => {
    const r = parseSurfaceProfile(stringify(withProtocol({ announce: [{ sysex: 'F0 ZZ F7' }] })));
    expectErrors(
      r.ok ? { ok: true } : r,
      'protocol.announce[0].sysex: "ZZ" is neither a hex pair nor a placeholder',
    );
  });

  it('rejects a placeholder that cannot be filled, such as {text} as a cc value', () => {
    const r = parseSurfaceProfile(
      stringify(withProtocol({ follow: { cc: { channel: 1, number: 2, value: '{text}' } } })),
    );
    expect(r.ok).toBe(false);
  });

  it('rejects two controls with one address', () => {
    const doc = profileDoc();
    const controls = doc.controls;
    if (!Array.isArray(controls)) throw new Error('fixture controls missing');
    controls.push({ id: 'dup', kind: 'button', address: { channel: 1, cc: 13 } });
    const r = parseSurfaceProfile(stringify(doc));
    expectErrors(
      r.ok ? { ok: true } : r,
      'controls[5].address: channel 1 cc 13 is already the address of control "encoder_1_1"',
    );
  });

  it('rejects follow without a follow message', () => {
    const doc = profileDoc();
    const protocol = doc.protocol;
    if (typeof protocol !== 'object' || protocol === null) throw new Error('fixture protocol missing');
    doc.protocol = Object.fromEntries(Object.entries(protocol).filter(([key]) => key !== 'follow'));
    const r = parseSurfaceProfile(stringify(doc));
    expectErrors(
      r.ok ? { ok: true } : r,
      'controls[1].follows: control "fader_1" follows but protocol.follow is not defined',
    );
  });

  it('rejects contract 3', () => {
    const r = parseSurfaceProfile(stringify({ ...profileDoc(), contract: 3 }));
    expectErrors(r.ok ? { ok: true } : r, 'contract 3 is not supported (supported: 2)');
  });
});

describe('parseSurfaceLayout', () => {
  it('rejects a binding that is not a button', () => {
    const s = profile();
    const doc = layoutDoc();
    doc.bindings = [{ role: 'x', press: { control: 'fader_1' } }];
    doc.feedback = [];
    const r = parseSurfaceLayout(stringify(doc), s);
    expectErrors(r.ok ? { ok: true } : r, 'bindings[0].press.control: "fader_1" is not a button');
  });

  it('rejects a "with" control that is not a button', () => {
    const s = profile();
    const doc = layoutDoc();
    doc.bindings = [{ role: 'x', press: { control: 'button_side', with: 'encoder_1_1' } }];
    doc.feedback = [];
    const r = parseSurfaceLayout(stringify(doc), s);
    expectErrors(r.ok ? { ok: true } : r, 'bindings[0].press.with: "encoder_1_1" is not a button');
  });

  it('rejects two bindings that are the same press', () => {
    const s = profile();
    const doc = layoutDoc();
    doc.bindings = [
      { role: 'a', press: { control: 'button_side', with: 'button_shift' } },
      { role: 'b', press: { control: 'button_side', with: 'button_shift' } },
    ];
    doc.feedback = [];
    const r = parseSurfaceLayout(stringify(doc), s);
    expectErrors(r.ok ? { ok: true } : r, 'bindings[1].press: same press as bindings[0] (role "a")');
  });

  it('rejects feedback for a role with no binding', () => {
    const s = profile();
    const doc = layoutDoc();
    doc.feedback = [{ role: 'ghost', active: 1, inactive: 0 }];
    const r = parseSurfaceLayout(stringify(doc), s);
    expectErrors(r.ok ? { ok: true } : r, 'feedback[0].role: "ghost" has no binding');
  });

  it('rejects a layout for another surface', () => {
    const s = profile();
    const r = parseSurfaceLayout(stringify({ ...layoutDoc(), surface: 'other' }), s);
    expectErrors(r.ok ? { ok: true } : r, 'surface: "other" does not match surface "lcxl3-daw"');
  });
});

describe('parseControllerMap', () => {
  const s = profile();
  const l = layout(s);

  function mapWith(patch: (doc: Doc) => void): ReturnType<typeof parseControllerMap> {
    const doc = mapDoc();
    patch(doc);
    return parseControllerMap(stringify(doc), s, l);
  }

  function pages(doc: Doc): Array<{ assignments: unknown[] }> {
    const p = doc.pages;
    if (!Array.isArray(p)) throw new Error('fixture pages missing');
    return p;
  }

  it('rejects a control id the surface does not define', () => {
    const r = mapWith((d) => {
      pages(d)[0].assignments[0] = { control: 'encoder_9_9', parameter: { id: 'p', name: 'P' } };
    });
    expectErrors(
      r.ok ? { ok: true } : r,
      'pages[0].assignments[0].control: "encoder_9_9" is not a control of surface "lcxl3-daw"',
    );
  });

  it('rejects a page assignment to a control the layout binds', () => {
    const r = mapWith((d) => {
      pages(d)[1].assignments.push({ control: 'button_side', parameter: { id: 'p', name: 'P' } });
    });
    expectErrors(
      r.ok ? { ok: true } : r,
      'pages[1].assignments[3].control: "button_side" is bound by the layout (page.next, page.prev)',
    );
  });

  it('rejects a page assignment to a control the layout uses as "with"', () => {
    const r = mapWith((d) => {
      pages(d)[0].assignments.push({ control: 'button_shift', parameter: { id: 'p', name: 'P' } });
    });
    expectErrors(
      r.ok ? { ok: true } : r,
      'pages[0].assignments[1].control: "button_shift" is bound by the layout (page.prev)',
    );
  });

  it('names a single role in the bound error', () => {
    const single = layout(s, { ...layoutDoc(), bindings: [{ role: 'page.next', press: { control: 'button_side' } }] });
    const doc = mapDoc();
    pages(doc)[1].assignments.push({ control: 'button_side', parameter: { id: 'p', name: 'P' } });
    const r = parseControllerMap(stringify(doc), s, single);
    expectErrors(
      r.ok ? { ok: true } : r,
      'pages[1].assignments[3].control: "button_side" is bound by the layout (page.next)',
    );
  });

  it('rejects two assignments to one control on a page', () => {
    const r = mapWith((d) => {
      pages(d)[0].assignments.push({ control: 'encoder_1_1', parameter: { id: 'q', name: 'Q' } });
    });
    expectErrors(
      r.ok ? { ok: true } : r,
      'pages[0].assignments[1].control: "encoder_1_1" is already assigned on this page',
    );
  });

  it('rejects mode on a non-button assignment', () => {
    const r = mapWith((d) => {
      pages(d)[0].assignments[0] = {
        control: 'encoder_1_1',
        parameter: { id: 'p', name: 'P' },
        mode: 'toggle',
      };
    });
    expectErrors(
      r.ok ? { ok: true } : r,
      'pages[0].assignments[0].mode: mode is only valid on a button ("encoder_1_1" is an encoder)',
    );
  });

  it('rejects an empty luna_plugin_ids', () => {
    const r = mapWith((d) => {
      d.plugin = { manufacturer: 'Acme', name: 'Synth', luna_plugin_ids: [] };
    });
    expectErrors(r.ok ? { ok: true } : r, 'plugin.luna_plugin_ids: at least one plugin id is required');
  });

  it('rejects contract 3', () => {
    const r = mapWith((d) => {
      d.contract = 3;
    });
    expectErrors(r.ok ? { ok: true } : r, 'contract 3 is not supported (supported: 2)');
  });

  it('accepts a two-page map', () => {
    const r = parseControllerMap(stringify(mapDoc()), s, l);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const map: ControllerMap = r.value;
    expect(map.pages[1].assignments[0].parameter.id).toBe('p2');
  });
});

describe('contractOf', () => {
  it('returns the top-level contract or undefined', () => {
    expect(contractOf(stringify(mapDoc()))).toBe(2);
    expect(contractOf('version: 1.0.0\nmetadata:\n  name: x\n')).toBeUndefined();
    expect(contractOf(stringify({ ...mapDoc(), contract: 3 }))).toBe(3);
  });
});
