import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contractOf,
  parseControllerMap,
  parseSurfaceLayout,
  parseSurfaceProfile,
  type ParseResult,
  type SurfaceLayout,
  type SurfaceProfile,
} from './index.js';

const MAPS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'maps');
const DAW_DIR = join(MAPS_ROOT, 'novation-launch-control-xl-3', 'daw');

function yamlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return yamlFiles(path);
    return /\.ya?ml$/.test(entry.name) ? [path] : [];
  });
}

function read(name: string): string {
  return readFileSync(join(DAW_DIR, name), 'utf8');
}

function unwrap<T>(result: ParseResult<T>, what: string): T {
  if (!result.ok) throw new Error(`${what} did not parse: ${result.errors.join('; ')}`);
  return result.value;
}

function surface(): SurfaceProfile {
  return unwrap(parseSurfaceProfile(read('surface.yaml')), 'surface.yaml');
}

function layout(): SurfaceLayout {
  return unwrap(parseSurfaceLayout(read('layout.yaml'), surface()), 'layout.yaml');
}

describe('contract 2 maps', () => {
  it('every contract 2 YAML under maps/ is one of the three files and parses', () => {
    const contract2 = yamlFiles(MAPS_ROOT).filter((f) => contractOf(readFileSync(f, 'utf8')) === 2);
    expect(contract2.map((f) => f.slice(MAPS_ROOT.length + 1)).sort()).toEqual([
      'novation-launch-control-xl-3/daw/layout.yaml',
      'novation-launch-control-xl-3/daw/surface.yaml',
      'novation-launch-control-xl-3/daw/ua-api-vision.yaml',
    ]);
  });

  it('surface.yaml has 52 controls with the documented addresses', () => {
    const s = surface();
    expect(s.surface).toBe('lcxl3-daw');
    expect(s.ports).toEqual({ input: 'LCXL3 1 DAW Out', output: 'LCXL3 1 DAW In' });
    const byId = new Map(s.controls.map((c) => [c.id, c]));
    expect(s.controls).toHaveLength(52);
    expect(s.controls.filter((c) => c.kind === 'encoder')).toHaveLength(24);
    expect(s.controls.filter((c) => c.kind === 'fader')).toHaveLength(8);
    expect(s.controls.filter((c) => c.kind === 'button')).toHaveLength(20);
    expect(byId.get('encoder_1_1')?.address).toEqual({ channel: 16, cc: 13 });
    expect(byId.get('encoder_3_8')?.address).toEqual({ channel: 16, cc: 36 });
    expect(byId.get('fader_1')?.address).toEqual({ channel: 16, cc: 5 });
    expect(byId.get('fader_8')?.address).toEqual({ channel: 16, cc: 12 });
    expect(byId.get('button_top_1')?.address).toEqual({ channel: 1, cc: 37 });
    expect(byId.get('button_bottom_8')?.address).toEqual({ channel: 1, cc: 52 });
    expect(byId.get('button_side')?.address).toEqual({ channel: 1, cc: 104 });
    expect(byId.get('play')?.address).toEqual({ channel: 1, cc: 116 });
    expect(byId.get('record')?.address).toEqual({ channel: 1, cc: 118 });
    expect(byId.get('shift')?.address).toEqual({ channel: 7, cc: 63 });
    expect(s.controls.filter((c) => c.follows === true).map((c) => c.kind)).toEqual(Array(24).fill('encoder'));
    expect(s.protocol.mode?.ready).toEqual([1, 2]);
  });

  it('layout.yaml binds page.next and the transport roles', () => {
    const l = layout();
    const roles = l.bindings.map((b) => b.role);
    expect(roles).toContain('page.next');
    expect(roles).toContain('page.previous');
    expect(l.feedback).toContainEqual({ role: 'transport.play', active: 33, inactive: 39 });
    expect(l.feedback).toContainEqual({ role: 'transport.record', active: 5, inactive: 7 });
  });

  it('ua-api-vision.yaml has the Channel and 560 EQ pages', () => {
    const map = unwrap(parseControllerMap(read('ua-api-vision.yaml'), surface(), layout()), 'ua-api-vision.yaml');
    expect(map.plugin.luna_plugin_ids).toEqual(['uaudio_api_vision_ext']);
    expect(map.pages.map((p) => p.name)).toEqual(['Channel', '560 EQ']);
    expect(map.metadata.description).toContain('560');
    expect(map.pages[0]?.assignments).toHaveLength(20);
    expect(map.pages[1]?.assignments).toHaveLength(13);
  });
});
