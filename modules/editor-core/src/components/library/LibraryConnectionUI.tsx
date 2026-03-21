/**
 * LibraryConnectionUI — backend selector and connection status display.
 *
 * Shows available backends (Local Folder / Google Drive) when disconnected,
 * and connection status with change/disconnect when connected.
 */

import React from 'react';
import type { LibraryBackend } from '../../hooks/useLibraryConnection';

// =========================================================================
// Types
// =========================================================================

export interface LibraryConnectionUIProps {
  /** Currently active backend. */
  activeBackend: LibraryBackend;
  /** Whether a library root is available. */
  isConnected: boolean;
  /** Whether FSAA is available in the browser. */
  hasLocalFS: boolean;
  /** Whether Google Drive credentials are configured. */
  hasGoogleDrive: boolean;
  /** Connect to a backend. */
  onConnect: (backend: 'local' | 'google-drive') => void;
  /** Disconnect from the current backend. */
  onDisconnect: () => void;
  /** Optional CSS class. */
  className?: string;
}

// =========================================================================
// Component
// =========================================================================

const BACKEND_LABELS: Record<string, string> = {
  local: 'Local Folder',
  'google-drive': 'Google Drive',
};

export function LibraryConnectionUI({
  activeBackend,
  isConnected,
  hasLocalFS,
  hasGoogleDrive,
  onConnect,
  onDisconnect,
  className,
}: LibraryConnectionUIProps): JSX.Element {
  if (isConnected) {
    return (
      <div className={`ac-library-connection ${className ?? ''}`}>
        <span className="ac-library-connection-status">
          <span className="ac-library-connection-dot" />
          {BACKEND_LABELS[activeBackend] ?? activeBackend}
        </span>
        <button
          className="ac-library-connection-btn"
          onClick={onDisconnect}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className={`ac-library-connection ${className ?? ''}`}>
      {hasLocalFS && (
        <button
          className="ac-library-connection-btn"
          onClick={() => onConnect('local')}
        >
          Local Folder
        </button>
      )}
      {hasGoogleDrive && (
        <button
          className="ac-library-connection-btn"
          onClick={() => onConnect('google-drive')}
        >
          Google Drive
        </button>
      )}
      {!hasLocalFS && !hasGoogleDrive && (
        <span className="ac-library-connection-none">
          No storage backends available
        </span>
      )}
    </div>
  );
}
