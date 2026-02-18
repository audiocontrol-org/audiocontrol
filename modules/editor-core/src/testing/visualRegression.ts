export interface VisualViewport {
  width: number;
  height: number;
}

export interface VisualPageFixture {
  id: string;
  path: string;
  readySelector: string;
  waitMs?: number;
}

export interface VisualEditorFixture {
  editorId: string;
  pages: VisualPageFixture[];
}

export const DEFAULT_VISUAL_VIEWPORT: VisualViewport = {
  width: 1366,
  height: 768,
};

export function appendMockMidiQuery(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}midi=mock`;
}

export function buildVisualRoute(path: string, useMockMidi = true): string {
  if (!useMockMidi) return path;
  return appendMockMidiQuery(path);
}
