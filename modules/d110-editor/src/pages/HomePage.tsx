/**
 * D-110 Editor Home Page - MIDI Connection Setup
 *
 * Dedicated connection page matching S-330 editor layout.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMidiStore } from '@/stores';
import { MidiPortSelector, ScannerStatus } from '@/components/midi';
import { cn } from '@/lib/utils';

// localStorage keys (must match midiStore)
const STORAGE_KEY_INPUT = 'd110-midi-input';
const STORAGE_KEY_OUTPUT = 'd110-midi-output';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const {
    isSupported,
    browserInfo,
    inputs,
    outputs,
    sysExEnabled,
    status,
    error,
    refresh,
    connect,
    disconnect,
    selectedInputId: storeInputId,
    selectedOutputId: storeOutputId,
    // Scanner state
    scanStatus,
    scanProgress,
    foundDevices,
    scanError,
    startScan,
    cancelScan,
    selectFoundDevice,
    dismissScanResults,
  } = useMidiStore();

  // Local state for port selection - initialized from localStorage
  const [selectedInputId, setSelectedInputId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_INPUT);
    } catch {
      return null;
    }
  });
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OUTPUT);
    } catch {
      return null;
    }
  });

  // Sync local state with store state when connected
  useEffect(() => {
    if (status === 'connected' && storeInputId && storeOutputId) {
      setSelectedInputId(storeInputId);
      setSelectedOutputId(storeOutputId);
    }
  }, [status, storeInputId, storeOutputId]);

  const handleConnect = (): void => {
    if (selectedInputId && selectedOutputId) {
      void connect(selectedInputId, selectedOutputId);
    }
  };

  const handleDisconnect = (): void => {
    void disconnect();
    setSelectedInputId(null);
    setSelectedOutputId(null);
  };

  const handleContinue = (): void => {
    navigate('/tones');
  };

  const isConnected = status === 'connected';

  // Show browser compatibility warning
  if (!isSupported) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-xl font-bold text-d110-highlight mb-4">
            Browser Not Supported
          </h2>
          <p className="text-d110-text mb-4">
            The Web MIDI API is not available in {browserInfo.browser}.
          </p>
          <p className="text-d110-muted mb-4">{browserInfo.notes}</p>
          <div className="bg-d110-surface p-4 rounded-md">
            <h3 className="font-medium text-d110-text mb-2">Supported Browsers:</h3>
            <ul className="list-disc list-inside text-d110-muted space-y-1">
              <li>Google Chrome (recommended)</li>
              <li>Microsoft Edge</li>
              <li>Opera</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Scanner Status */}
      <ScannerStatus
        status={scanStatus}
        progress={scanProgress}
        foundDevices={foundDevices}
        error={scanError}
        onCancel={cancelScan}
        onSelectDevice={(device) => void selectFoundDevice(device)}
        onDismiss={dismissScanResults}
      />

      {/* Connection Card */}
      <div className="card">
        <h2 className="text-xl font-bold text-d110-text mb-4">
          Connect to D-110
        </h2>

        {/* SysEx Warning */}
        {!sysExEnabled && inputs.length > 0 && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-md p-3 mb-4">
            <p className="text-yellow-200 text-sm">
              SysEx access was denied. Please allow SysEx permission when prompted
              to enable full device communication.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-md p-3 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Port Selection */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <MidiPortSelector
            label="MIDI Input (from D-110)"
            ports={inputs}
            value={selectedInputId}
            onChange={setSelectedInputId}
            disabled={status === 'connected' || status === 'connecting'}
          />
          <MidiPortSelector
            label="MIDI Output (to D-110)"
            ports={outputs}
            value={selectedOutputId}
            onChange={setSelectedOutputId}
            disabled={status === 'connected' || status === 'connecting'}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isConnected ? (
            <>
              <button onClick={handleDisconnect} className="btn btn-secondary">
                Disconnect
              </button>
              <button onClick={handleContinue} className="btn btn-primary">
                Continue to Tones
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleConnect}
                disabled={!selectedInputId || !selectedOutputId || status === 'connecting'}
                className={cn(
                  'btn btn-primary',
                  (!selectedInputId || !selectedOutputId) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {status === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
              <button
                onClick={() => void startScan()}
                disabled={scanStatus === 'scanning'}
                className="btn btn-secondary"
              >
                {scanStatus === 'scanning' ? 'Scanning...' : 'Scan for Devices'}
              </button>
              <button onClick={() => void refresh()} className="btn btn-secondary">
                Refresh Ports
              </button>
            </>
          )}
        </div>
      </div>

      {/* Device ID Selection */}
      <div className="card">
        <h3 className="font-medium text-d110-text mb-3">Device ID</h3>
        <p className="text-sm text-d110-muted mb-3">
          Enter the Device ID configured on your D-110 (MIDI → Rx CH → DevNo).
          The D-110 uses device IDs 17-32.
        </p>
        <DeviceIdSelector />
      </div>

      {/* Help Card */}
      <div className="card">
        <h3 className="font-medium text-d110-text mb-3">Connection Help</h3>
        <ul className="text-sm text-d110-muted space-y-2">
          <li>
            <strong className="text-d110-text">MIDI Interface:</strong> Connect your D-110
            to your computer via a MIDI interface (USB-MIDI adapter, audio interface, etc.)
          </li>
          <li>
            <strong className="text-d110-text">Port Names:</strong> Look for port names
            containing "D-110", "Roland", or your MIDI interface name
          </li>
          <li>
            <strong className="text-d110-text">SysEx:</strong> This editor uses System
            Exclusive messages. Ensure your MIDI interface supports SysEx.
          </li>
          <li>
            <strong className="text-d110-text">Device ID:</strong> Must match the setting
            on your D-110 (MIDI → Rx CH → DevNo). Default is 17.
          </li>
        </ul>
      </div>
    </div>
  );
}

function DeviceIdSelector(): JSX.Element {
  const { deviceId, setDeviceId } = useMidiStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = parseInt(e.target.value, 10);
    if (newValue >= 17 && newValue <= 32) {
      setDeviceId(newValue);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <input
        type="number"
        min={17}
        max={32}
        value={deviceId}
        onChange={handleChange}
        className="input w-20 text-center"
      />
      <span className="text-sm text-d110-muted">
        (17-32, as shown on D-110)
      </span>
    </div>
  );
}
