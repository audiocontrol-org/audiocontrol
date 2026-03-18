/**
 * Browser environment wiring for the standalone loop editor dev harness.
 *
 * Provides real browser implementations of the workflow environment
 * capabilities needed by the loop editor.
 */

import {
  createBrowserAudioPlayback,
  createBrowserFileIO,
} from '@audiocontrol/editor-core';
import type { WorkflowEnvironment } from '@audiocontrol/editor-core';

export function createDevEnvironment(): WorkflowEnvironment {
  return {
    fileIO: createBrowserFileIO(),
    audio: createBrowserAudioPlayback(),
  };
}
