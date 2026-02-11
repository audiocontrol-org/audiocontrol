import { useState, useEffect } from 'react';
import {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  openMidiPorts,
  createD110Client,
} from '@/core/midi';
import type { MidiPortInfo, D110MidiIO, D110ClientInterface } from '@/core/midi';

export function HomePage() {
  const [isSupported, setIsSupported] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{ supported: boolean; browser: string; notes: string } | null>(null);
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [deviceId, setDeviceId] = useState(17); // Default device ID (0x10 + 1)
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_adapter, setAdapter] = useState<D110MidiIO | null>(null);
  const [client, setClient] = useState<D110ClientInterface | null>(null);
  const [cleanup, setCleanup] = useState<(() => Promise<void>) | null>(null);

  // Check Web MIDI support on mount
  useEffect(() => {
    const supported = isWebMidiSupported();
    setIsSupported(supported);
    setBrowserInfo(getBrowserCompatibility());

    if (supported) {
      initializeMidi();
    }
  }, []);

  async function initializeMidi() {
    try {
      const access = await requestMidiAccess();
      setInputs(access.inputs);
      setOutputs(access.outputs);

      // Auto-select first ports if available
      if (access.inputs.length > 0 && !selectedInput) {
        setSelectedInput(access.inputs[0].id);
      }
      if (access.outputs.length > 0 && !selectedOutput) {
        setSelectedOutput(access.outputs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access MIDI');
    }
  }

  async function handleConnect() {
    if (!selectedInput || !selectedOutput) {
      setError('Please select both input and output ports');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await openMidiPorts(selectedInput, selectedOutput);
      setAdapter(result.adapter);
      setCleanup(() => result.cleanup);

      const d110Client = createD110Client(result.adapter, { deviceId: deviceId - 1 }); // Convert to 0-indexed
      setClient(d110Client);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (cleanup) {
      await cleanup();
    }
    setAdapter(null);
    setClient(client);
    setCleanup(null);
    setIsConnected(false);
  }

  async function handleTestConnection() {
    if (!client) return;

    setError(null);
    try {
      const systemParams = await client.requestSystemParams();
      alert(`Connected! Reverb Mode: ${systemParams.reverbMode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to communicate with D-110');
    }
  }

  // Browser not supported
  if (!isSupported) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h1 className="text-2xl font-bold text-d110-highlight mb-4">Web MIDI Not Supported</h1>
          <p className="text-d110-muted mb-4">
            Your browser does not support the Web MIDI API, which is required for this editor.
          </p>
          {browserInfo && (
            <div className="bg-d110-surface rounded-md p-4">
              <p className="font-medium">Browser: {browserInfo.browser}</p>
              <p className="text-d110-muted mt-1">{browserInfo.notes}</p>
            </div>
          )}
          <div className="mt-4">
            <p className="text-d110-muted">Please use one of these browsers:</p>
            <ul className="list-disc list-inside mt-2 text-d110-text">
              <li>Google Chrome</li>
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
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-d110-highlight">Roland D-110 Editor</h1>
        <p className="text-d110-muted mt-2">
          Connect to your D-110 to start editing tones and patches
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-md p-4">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Connection card */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">MIDI Connection</h2>

        {!isConnected ? (
          <div className="space-y-4">
            {/* Input port select */}
            <div>
              <label className="label">MIDI Input</label>
              <select
                value={selectedInput}
                onChange={(e) => setSelectedInput(e.target.value)}
                className="input w-full"
                disabled={isConnecting}
              >
                <option value="">Select input port...</option>
                {inputs.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Output port select */}
            <div>
              <label className="label">MIDI Output</label>
              <select
                value={selectedOutput}
                onChange={(e) => setSelectedOutput(e.target.value)}
                className="input w-full"
                disabled={isConnecting}
              >
                <option value="">Select output port...</option>
                {outputs.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Device ID */}
            <div>
              <label className="label">Device ID (17-32)</label>
              <input
                type="number"
                min={17}
                max={32}
                value={deviceId}
                onChange={(e) => setDeviceId(parseInt(e.target.value, 10))}
                className="input w-24"
                disabled={isConnecting}
              />
              <p className="text-xs text-d110-muted mt-1">
                Default is 17. Check your D-110's device ID setting.
              </p>
            </div>

            {/* Connect button */}
            <div className="flex gap-2">
              <button
                onClick={handleConnect}
                disabled={isConnecting || !selectedInput || !selectedOutput}
                className="btn btn-primary"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
              <button
                onClick={initializeMidi}
                className="btn btn-secondary"
                disabled={isConnecting}
              >
                Refresh Ports
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected status */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-green-400 font-medium">Connected</span>
            </div>

            {/* Connection info */}
            <div className="bg-d110-surface rounded-md p-3 text-sm">
              <p>
                <span className="text-d110-muted">Input:</span>{' '}
                {inputs.find((p) => p.id === selectedInput)?.name}
              </p>
              <p>
                <span className="text-d110-muted">Output:</span>{' '}
                {outputs.find((p) => p.id === selectedOutput)?.name}
              </p>
              <p>
                <span className="text-d110-muted">Device ID:</span> {deviceId}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={handleTestConnection} className="btn btn-primary">
                Test Connection
              </button>
              <button onClick={handleDisconnect} className="btn btn-secondary">
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">About</h2>
        <p className="text-d110-muted text-sm">
          This editor allows you to edit tones and patches on your Roland D-110 synthesizer
          in real-time. Connect your D-110 via MIDI to get started.
        </p>
        <p className="text-d110-muted text-sm mt-2">
          Make sure your D-110 is set to receive SysEx messages and the device ID matches
          the setting on your synthesizer.
        </p>
      </div>
    </div>
  );
}
