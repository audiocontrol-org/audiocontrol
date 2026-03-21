/**
 * Browser environment wiring for the standalone loop editor dev harness.
 *
 * Provides real browser implementations of the workflow environment
 * capabilities needed by the loop editor. Library connections are
 * managed by the useLibraryConnection hook in editor-core.
 */

import {
  createBrowserAudioPlayback,
  createBrowserFileIO,
} from '@audiocontrol/editor-core';
import type { WorkflowEnvironment } from '@audiocontrol/editor-core';

export interface DevEnvironment {
  workflow: WorkflowEnvironment;
}

export function createDevEnvironment(): DevEnvironment {
  return {
    workflow: {
      fileIO: createBrowserFileIO(),
      audio: createBrowserAudioPlayback(),
    },
  };
}
