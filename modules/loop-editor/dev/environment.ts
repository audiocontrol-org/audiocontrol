/**
 * Browser environment wiring for the standalone loop editor dev harness.
 *
 * Provides real browser implementations of the workflow environment
 * capabilities needed by the loop editor, plus library connections
 * for loading/saving samples. Supports FSAA (local filesystem) and
 * Google Drive (cloud, works on iPadOS).
 */

import {
  createBrowserAudioPlayback,
  createBrowserFileIO,
} from '@audiocontrol/editor-core';
import type { WorkflowEnvironment } from '@audiocontrol/editor-core';
import { BrowserLibraryConnection } from '@audiocontrol/sampler-library/browser';
import type { LibraryConnection } from '@audiocontrol/sampler-library/browser';
import { GoogleDriveLibraryConnection } from '@audiocontrol/sampler-library/google-drive';

export interface DevEnvironment {
  workflow: WorkflowEnvironment;
  fsaaLibrary: LibraryConnection;
  googleDrive: GoogleDriveLibraryConnection | null;
}

function createGoogleDrive(): GoogleDriveLibraryConnection | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new GoogleDriveLibraryConnection({ clientId, clientSecret });
}

export function createDevEnvironment(): DevEnvironment {
  return {
    workflow: {
      fileIO: createBrowserFileIO(),
      audio: createBrowserAudioPlayback(),
    },
    fsaaLibrary: new BrowserLibraryConnection({
      pickerId: 'loop-editor-library',
    }),
    googleDrive: createGoogleDrive(),
  };
}
