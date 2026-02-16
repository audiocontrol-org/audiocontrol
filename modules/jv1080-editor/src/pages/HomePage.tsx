import { useEffect } from 'react';
import { MidiPortSelector } from '@/components/midi/MidiPortSelector';
import { useMidiStore } from '@/stores/midiStore';

export function HomePage(): JSX.Element {
  const {
    isSupported,
    browserInfo,
    inputs,
    outputs,
    status,
    error,
    selectedInputId,
    selectedOutputId,
    deviceId,
    initialize,
    connect,
    disconnect,
    refresh,
    setSelectedInputId,
    setSelectedOutputId,
    setDeviceId,
  } = useMidiStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const canConnect = Boolean(selectedInputId && selectedOutputId) && status !== 'connected';

  return (
    <section className="panel">
      <h2>MIDI Connection</h2>
      <p>
        Browser: <strong>{browserInfo.browser}</strong> | Web MIDI: <strong>{isSupported ? 'supported' : 'unsupported'}</strong>
      </p>
      <p className={`status ${status === 'connected' ? 'connected' : ''}`}>Status: {status}</p>
      {error ? <p className="error">{error}</p> : null}

      <div className="row">
        <MidiPortSelector
          label="MIDI Input"
          ports={inputs}
          value={selectedInputId}
          onChange={setSelectedInputId}
          disabled={!isSupported || status === 'connected'}
        />
        <MidiPortSelector
          label="MIDI Output"
          ports={outputs}
          value={selectedOutputId}
          onChange={setSelectedOutputId}
          disabled={!isSupported || status === 'connected'}
        />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="col" style={{ maxWidth: 220 }}>
          <label htmlFor="device-id">JV-1080 Device ID (0-127)</label>
          <input
            id="device-id"
            type="number"
            min={0}
            max={127}
            value={deviceId}
            onChange={(e) => setDeviceId(Number.parseInt(e.target.value, 10) || 0)}
            disabled={status === 'connected'}
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" onClick={() => void refresh()} disabled={!isSupported}>
          Refresh Ports
        </button>
        <button type="button" onClick={() => void connect()} disabled={!canConnect}>
          Connect
        </button>
        <button type="button" onClick={() => void disconnect()} disabled={status !== 'connected'}>
          Disconnect
        </button>
      </div>
    </section>
  );
}
