import type { VisualEditorFixture } from '@audiocontrol/editor-core';
import { buildVisualRoute } from '@audiocontrol/editor-core';

export const s330VisualFixture: VisualEditorFixture = {
  editorId: 's330',
  pages: [
    {
      id: 'connect',
      path: buildVisualRoute('/roland/s330/editor/'),
      readySelector: 'h2:has-text("Connect to S-330")',
    },
    {
      id: 'play',
      path: buildVisualRoute('/roland/s330/editor/play'),
      readySelector: 'h2:has-text("Play")',
    },
    {
      id: 'patches',
      path: buildVisualRoute('/roland/s330/editor/patches'),
      readySelector: 'h2:has-text("Patches")',
    },
    {
      id: 'tones',
      path: buildVisualRoute('/roland/s330/editor/tones'),
      readySelector: 'h2:has-text("Tones")',
    },
  ],
};
