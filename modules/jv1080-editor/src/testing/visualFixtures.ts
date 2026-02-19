import type { VisualEditorFixture } from '@audiocontrol/editor-core';
import { buildVisualRoute } from '@audiocontrol/editor-core';

export const jv1080VisualFixture: VisualEditorFixture = {
  editorId: 'jv1080',
  pages: [
    {
      id: 'connect',
      path: buildVisualRoute('/roland/jv1080/editor/'),
      readySelector: 'h2:has-text("Connect to JV-1080")',
    },
    {
      id: 'editor',
      path: buildVisualRoute('/roland/jv1080/editor/editor'),
      readySelector: 'h1:has-text("JV-1080 Editor"), h2:has-text("System")',
    },
  ],
};
