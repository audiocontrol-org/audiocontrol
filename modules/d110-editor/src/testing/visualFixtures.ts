import type { VisualEditorFixture } from '@audiocontrol/editor-core';
import { buildVisualRoute } from '@audiocontrol/editor-core';

export const d110VisualFixture: VisualEditorFixture = {
  editorId: 'd110',
  pages: [
    {
      id: 'connect',
      path: buildVisualRoute('/roland/d110/editor/'),
      readySelector: 'h2:has-text("Connect to D-110")',
    },
    {
      id: 'tones',
      path: buildVisualRoute('/roland/d110/editor/tones'),
      readySelector: 'h1:has-text("Tone Editor"), h2:has-text("Tones")',
    },
    {
      id: 'patches',
      path: buildVisualRoute('/roland/d110/editor/patches'),
      readySelector: 'h1:has-text("Patch Editor"), h2:has-text("Patches")',
    },
  ],
};
