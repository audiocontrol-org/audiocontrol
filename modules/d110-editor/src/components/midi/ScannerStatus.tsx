/**
 * Scanner status component
 *
 * Shows the status of D-110 device scanning with appropriate UI for each state.
 */

import type { D110ScanResult, ScanStatus } from '@/core/midi/types';
import { cn } from '@/lib/utils';

interface ScannerStatusProps {
  status: ScanStatus;
  progress: string;
  foundDevices: D110ScanResult[];
  error: string | null;
  onCancel: () => void;
  onSelectDevice: (device: D110ScanResult) => void;
  onDismiss: () => void;
}

export function ScannerStatus({
  status,
  progress,
  foundDevices,
  error,
  onCancel,
  onSelectDevice,
  onDismiss,
}: ScannerStatusProps): JSX.Element | null {
  // Don't render anything in idle state
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="card mb-6">
      {status === 'scanning' && (
        <ScanningView progress={progress} onCancel={onCancel} />
      )}
      {status === 'found' && foundDevices.length > 0 && (
        <DevicesFoundView
          devices={foundDevices}
          onSelectDevice={onSelectDevice}
          onDismiss={onDismiss}
        />
      )}
      {status === 'not_found' && (
        <NotFoundView onDismiss={onDismiss} />
      )}
      {status === 'error' && (
        <ErrorView error={error} onDismiss={onDismiss} />
      )}
    </div>
  );
}

interface ScanningViewProps {
  progress: string;
  onCancel: () => void;
}

function ScanningView({ progress, onCancel }: ScanningViewProps): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Spinner />
        <div>
          <p className="text-d110-text font-medium">Scanning for D-110...</p>
          <p className="text-d110-muted text-sm">{progress}</p>
        </div>
      </div>
      <button onClick={onCancel} className="btn btn-secondary text-sm">
        Cancel
      </button>
    </div>
  );
}

interface DevicesFoundViewProps {
  devices: D110ScanResult[];
  onSelectDevice: (device: D110ScanResult) => void;
  onDismiss: () => void;
}

function DevicesFoundView({
  devices,
  onSelectDevice,
  onDismiss,
}: DevicesFoundViewProps): JSX.Element {
  const title = devices.length === 1 ? 'D-110 Found!' : `${devices.length} D-110 Devices Found`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <SuccessIcon />
        <div>
          <p className="text-green-400 font-medium">{title}</p>
          <p className="text-d110-muted text-sm">
            Click to connect
          </p>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {devices.map((device) => (
          <button
            key={`${device.outputPortId}-${device.deviceId}`}
            onClick={() => onSelectDevice(device)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-md',
              'bg-d110-surface border border-d110-border',
              'hover:border-d110-accent transition-colors',
              'text-left'
            )}
          >
            <div>
              <p className="text-d110-text font-medium">
                {device.outputPortName}
              </p>
              <p className="text-d110-muted text-sm">
                Device ID {device.userDeviceId}
              </p>
            </div>
            <span className="text-d110-accent text-sm">Connect</span>
          </button>
        ))}
      </div>
      <button onClick={onDismiss} className="btn btn-secondary text-sm">
        Cancel
      </button>
    </div>
  );
}

interface NotFoundViewProps {
  onDismiss: () => void;
}

function NotFoundView({ onDismiss }: NotFoundViewProps): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <WarningIcon />
        <div>
          <p className="text-yellow-400 font-medium">No D-110 Found</p>
          <p className="text-d110-muted text-sm">
            Check your MIDI connections and try again, or select ports manually below
          </p>
        </div>
      </div>
      <button onClick={onDismiss} className="btn btn-secondary text-sm">
        Dismiss
      </button>
    </div>
  );
}

interface ErrorViewProps {
  error: string | null;
  onDismiss: () => void;
}

function ErrorView({ error, onDismiss }: ErrorViewProps): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ErrorIcon />
        <div>
          <p className="text-red-400 font-medium">Scan Error</p>
          <p className="text-d110-muted text-sm">{error ?? 'Unknown error'}</p>
        </div>
      </div>
      <button onClick={onDismiss} className="btn btn-secondary text-sm">
        Dismiss
      </button>
    </div>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      className="animate-spin h-5 w-5 text-d110-accent"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function SuccessIcon(): JSX.Element {
  return (
    <svg
      className="h-5 w-5 text-green-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon(): JSX.Element {
  return (
    <svg
      className="h-5 w-5 text-yellow-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon(): JSX.Element {
  return (
    <svg
      className="h-5 w-5 text-red-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
}
