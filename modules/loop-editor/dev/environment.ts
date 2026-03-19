/**
 * Browser environment wiring for the standalone loop editor dev harness.
 *
 * Provides real browser implementations of the workflow environment
 * capabilities needed by the loop editor, plus a library connection
 * for loading/saving samples.
 */

import {
  createBrowserAudioPlayback,
  createBrowserFileIO,
} from '@audiocontrol/editor-core';
import type { WorkflowEnvironment } from '@audiocontrol/editor-core';
import { BrowserLibraryConnection } from '@audiocontrol/sampler-library/browser';
import type { LibraryConnection } from '@audiocontrol/sampler-library/browser';

export interface DevEnvironment {
  workflow: WorkflowEnvironment;
  library: LibraryConnection;
}

export function createDevEnvironment(): DevEnvironment {
  return {
    workflow: {
      fileIO: createBrowserFileIO(),
      audio: createBrowserAudioPlayback(),
    },
    library: new BrowserLibraryConnection({
      pickerId: 'loop-editor-library',
    }),
  };
}
