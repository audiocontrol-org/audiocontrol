import type { MidiPortInfo } from '@audiocontrol/shared-midi';
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
      <div className="ac-container-md">
        <section className="ac-card">
          <h2 className="ac-title-lg">{config.secureContextTitle ?? 'Secure Connection Required'}</h2>
          <p>The Web MIDI API requires a secure context (HTTPS or localhost).</p>
          <ul className="ac-help-list">
            {(config.secureContextHelpItems ?? [
              'Access the app through localhost or 127.0.0.1.',
              'Or deploy over HTTPS.',
            ]).map((item) => (
              <li key={item}>
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
      <div className="ac-container-md">
        <section className="ac-card">
          <h2 className="ac-title-lg">Browser Not Supported</h2>
          <p>
            The Web MIDI API is not available in {store.browserInfo.browser}.
          </p>
          <p className="ac-text-muted">{store.browserInfo.notes}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="ac-container-md ac-stack-lg">
      <section className="ac-card">
        <h2 className="ac-title-lg">Connect to {config.deviceName}</h2>

        {!store.sysExEnabled && store.inputs.length > 0 && (
          <p className="ac-text-warn">
            SysEx access was denied. Allow SysEx permission for full device communication.
          </p>
        )}

        {store.error ? <p className="ac-text-error">{store.error}</p> : null}

        <div className="ac-grid-2" style={{ marginTop: 12 }}>
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

        <div className="ac-row" style={{ marginTop: 16 }}>
          {isConnected ? (
            <>
              <button type="button" onClick={() => void store.disconnect()} className="ac-btn">
                Disconnect
              </button>
              <button type="button" onClick={onContinue} className="ac-btn">
                {config.continueLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void store.connect()}
                disabled={!canConnect || store.status === 'connecting'}
                className="ac-btn"
              >
                {store.status === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
              <button type="button" onClick={() => void store.refresh()} className="ac-btn">
                Refresh Ports
              </button>
            </>
          )}
        </div>
      </section>

      <section className="ac-card">
        <h3 className="ac-title-md">{config.deviceIdLabel}</h3>
        <p className="ac-text-muted">{config.deviceIdHelpText}</p>
        <div className="ac-row">
          <input
            className="ac-input"
            type="number"
            min={minDisplay}
            max={maxDisplay}
            value={displayDeviceId}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10) || minDisplay;
              store.setDeviceId(parsed - displayOffset);
            }}
            disabled={store.status === 'connected'}
            style={{ width: 90 }}
          />
          <span className="ac-text-muted">
            ({minDisplay}-{maxDisplay})
          </span>
        </div>
      </section>

      <section className="ac-card">
        <h3 className="ac-title-md">Connection Help</h3>
        <ul className="ac-help-list">
          {config.helpItems.map((item) => (
            <li key={item}>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
