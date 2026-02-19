import { describe, expect, it } from 'vitest';
import { appendMockMidiQuery, buildVisualRoute } from './visualRegression';

describe('visualRegression helpers', () => {
  it('appends midi mock query for paths without query params', () => {
    expect(appendMockMidiQuery('/roland/s330/editor/')).toBe('/roland/s330/editor/?midi=mock');
  });

  it('appends midi mock query for paths with existing query params', () => {
    expect(appendMockMidiQuery('/roland/s330/editor/play?foo=bar')).toBe('/roland/s330/editor/play?foo=bar&midi=mock');
  });

  it('buildVisualRoute can skip mock query', () => {
    expect(buildVisualRoute('/roland/s330/editor/', false)).toBe('/roland/s330/editor/');
  });
});
