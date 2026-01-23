/**
 * Home page - MIDI connection setup
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiPortSelector } from '@/components/midi/MidiPortSelector';
import { useMidiStore } from '@/stores/midiStore';
import { cn } from '@/lib/utils';

// localStorage keys (must match midiStore)
const STORAGE_KEY_INPUT = 's330-midi-input';
const STORAGE_KEY_OUTPUT = 's330-midi-output';

export function HomePage() {
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

  const handleConnect = async () => {
    if (selectedInputId && selectedOutputId) {
      await connect(selectedInputId, selectedOutputId);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setSelectedInputId(null);
    setSelectedOutputId(null);
  };

  const handleContinue = () => {
    navigate('/patches');
  };

  // Show browser compatibility warning
  if (!isSupported) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-xl font-bold text-s330-highlight mb-4">
            Browser Not Supported
          </h2>
          <p className="text-s330-text mb-4">
            The Web MIDI API is not available in {browserInfo.browser}.
          </p>
          <p className="text-s330-muted mb-4">{browserInfo.notes}</p>
          <div className="bg-s330-bg p-4 rounded-md">
            <h3 className="font-medium text-s330-text mb-2">Supported Browsers:</h3>
            <ul className="list-disc list-inside text-s330-muted space-y-1">
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
      {/* Connection Card */}
      <div className="card">
        <h2 className="text-xl font-bold text-s330-text mb-4">
          Connect to S-330
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
            label="MIDI Input (from S-330)"
            ports={inputs}
            value={selectedInputId}
            onChange={setSelectedInputId}
            disabled={status === 'connected' || status === 'connecting'}
          />
          <MidiPortSelector
            label="MIDI Output (to S-330)"
            ports={outputs}
            value={selectedOutputId}
            onChange={setSelectedOutputId}
            disabled={status === 'connected' || status === 'connecting'}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {status === 'connected' ? (
            <>
              <button onClick={handleDisconnect} className="btn btn-secondary">
                Disconnect
              </button>
              <button onClick={handleContinue} className="btn btn-primary">
                Continue to Patches
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
              <button onClick={refresh} className="btn btn-secondary">
                Refresh Ports
              </button>
            </>
          )}
        </div>
      </div>

      {/* Device ID Selection */}
      <div className="card">
        <h3 className="font-medium text-s330-text mb-3">Device ID</h3>
        <p className="text-sm text-s330-muted mb-3">
          Enter the Device ID shown on your S-330 screen (MIDI → Device ID).
          The S-330 displays 1-17, which maps to protocol values 0-16.
        </p>
        <DeviceIdSelector />
      </div>

      {/* Help Card */}
      <div className="card">
        <h3 className="font-medium text-s330-text mb-3">Connection Help</h3>
        <ul className="text-sm text-s330-muted space-y-2">
          <li>
            <strong className="text-s330-text">MIDI Interface:</strong> Connect your S-330
            to your computer via a MIDI interface (USB-MIDI adapter, audio interface, etc.)
          </li>
          <li>
            <strong className="text-s330-text">Port Names:</strong> Look for port names
            containing "S-330", "Roland", or your MIDI interface name
          </li>
          <li>
            <strong className="text-s330-text">SysEx:</strong> This editor uses System
            Exclusive messages. Ensure your MIDI interface supports SysEx.
          </li>
          <li>
            <strong className="text-s330-text">Device ID:</strong> Must match the setting
            on your S-330 (System → Device ID)
          </li>
        </ul>
      </div>
    </div>
  );
}

function DeviceIdSelector() {
  const { deviceId, setDeviceId } = useMidiStore();

  // Display value is 1-based (what user sees on S-330 screen)
  // Protocol value is 0-based (what we store internally)
  const displayValue = deviceId + 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDisplayValue = parseInt(e.target.value, 10);
    if (newDisplayValue >= 1 && newDisplayValue <= 17) {
      // Convert display value (1-17) to protocol value (0-16)
      setDeviceId(newDisplayValue - 1);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <input
        type="number"
        min={1}
        max={17}
        value={displayValue}
        onChange={handleChange}
        className="input w-20 text-center"
      />
      <span className="text-sm text-s330-muted">
        (1-17, as shown on S-330)
      </span>
    </div>
  );
}
