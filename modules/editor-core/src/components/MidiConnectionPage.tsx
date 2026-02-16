import type { MidiPortInfo } from '@audiocontrol/shared-midi';
import type { CSSProperties } from 'react';
import { MidiPortSelector } from './MidiPortSelector';

export interface MidiConnectionPageConfig {
  deviceName: string;
  inputLabel: string;
  outputLabel: string;
  deviceIdLabel: string;
  deviceIdHelpText: string;
  continueLabel: string;
  helpItems: string[];
  secureContextTitle?: string;
  secureContextHelpItems?: string[];
  deviceIdDisplayOffset?: number;
}

export interface MidiConnectionPageStore {
  isSupported: boolean;
  browserInfo: { browser: string; notes: string; requiresSecureContext?: boolean };
  sysExEnabled?: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  selectedInputId: string | null;
  selectedOutputId: string | null;
  deviceId: number;
  setSelectedInputId: (id: string) => void;
  setSelectedOutputId: (id: string) => void;
  setDeviceId: (id: number) => void;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export interface MidiConnectionPageProps {
  config: MidiConnectionPageConfig;
  store: MidiConnectionPageStore;
  deviceIdRange: { min: number; max: number };
  onContinue: () => void;
}

export function MidiConnectionPage({
  config,
  store,
  deviceIdRange,
  onContinue,
}: MidiConnectionPageProps): JSX.Element {
  const displayOffset = config.deviceIdDisplayOffset ?? 0;
  const minDisplay = deviceIdRange.min + displayOffset;
  const maxDisplay = deviceIdRange.max + displayOffset;
  const displayDeviceId = store.deviceId + displayOffset;
  const isConnected = store.status === 'connected';
  const canConnect = Boolean(store.selectedInputId && store.selectedOutputId) && !isConnected;

  if (!store.isSupported && store.browserInfo.requiresSecureContext) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <section style={sectionStyle}>
          <h2 style={titleStyle}>{config.secureContextTitle ?? 'Secure Connection Required'}</h2>
          <p>The Web MIDI API requires a secure context (HTTPS or localhost).</p>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#9ca3af' }}>
            {(config.secureContextHelpItems ?? [
              'Access the app through localhost or 127.0.0.1.',
              'Or deploy over HTTPS.',
            ]).map((item) => (
              <li key={item} style={{ marginBottom: 6 }}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  if (!store.isSupported) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <section style={sectionStyle}>
          <h2 style={titleStyle}>Browser Not Supported</h2>
          <p>
            The Web MIDI API is not available in {store.browserInfo.browser}.
          </p>
          <p style={{ color: '#9ca3af' }}>{store.browserInfo.notes}</p>
        </section>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gap: 16 }}>
      <section style={sectionStyle}>
        <h2 style={titleStyle}>Connect to {config.deviceName}</h2>

        {!store.sysExEnabled && store.inputs.length > 0 && (
          <p style={{ color: '#facc15' }}>
            SysEx access was denied. Allow SysEx permission for full device communication.
          </p>
        )}

        {store.error ? <p style={{ color: '#fca5a5' }}>{store.error}</p> : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <MidiPortSelector
            label={config.inputLabel}
            ports={store.inputs}
            value={store.selectedInputId}
            onChange={store.setSelectedInputId}
            disabled={store.status === 'connected' || store.status === 'connecting'}
          />
          <MidiPortSelector
            label={config.outputLabel}
            ports={store.outputs}
            value={store.selectedOutputId}
            onChange={store.setSelectedOutputId}
            disabled={store.status === 'connected' || store.status === 'connecting'}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
          {isConnected ? (
            <>
              <button type="button" onClick={() => void store.disconnect()} style={buttonStyle}>
                Disconnect
              </button>
              <button type="button" onClick={onContinue} style={buttonStyle}>
                {config.continueLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void store.connect()}
                disabled={!canConnect || store.status === 'connecting'}
                style={buttonStyle}
              >
                {store.status === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
              <button type="button" onClick={() => void store.refresh()} style={buttonStyle}>
                Refresh Ports
              </button>
            </>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>{config.deviceIdLabel}</h3>
        <p style={{ color: '#9ca3af' }}>{config.deviceIdHelpText}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="number"
            min={minDisplay}
            max={maxDisplay}
            value={displayDeviceId}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10) || minDisplay;
              store.setDeviceId(parsed - displayOffset);
            }}
            disabled={store.status === 'connected'}
            style={inputStyle}
          />
          <span style={{ color: '#9ca3af' }}>
            ({minDisplay}-{maxDisplay})
          </span>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Connection Help</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#9ca3af' }}>
          {config.helpItems.map((item) => (
            <li key={item} style={{ marginBottom: 6 }}>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  background: 'rgba(17, 24, 39, 0.8)',
  border: '1px solid #374151',
  borderRadius: 12,
  padding: 16,
};

const titleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
};

const buttonStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid #4b5563',
  background: '#1f2937',
  color: '#e5e7eb',
  padding: '10px 12px',
  cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid #4b5563',
  background: '#111827',
  color: '#e5e7eb',
  padding: '10px 12px',
  width: 90,
  textAlign: 'center',
};
