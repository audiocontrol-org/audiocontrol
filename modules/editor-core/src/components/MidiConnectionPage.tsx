import { useState } from 'react';
import type { MidiPortInfo } from '@audiocontrol/midi-core';
import { MidiPortSelector } from '@/components/MidiPortSelector';
import { TransportSelector } from '@/components/TransportSelector';
import { getActiveTransportMode, clearTransportConfig } from '@/transports/runtimeTransport';

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
  reconnect: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Auto-detect via SysEx Identity Request. Returns the matching
   *  input/output pair, or null if no device replied (probably
   *  because EXC SysEx isn't enabled on the device). */
  probe?: (options?: { onProbe?: (portName: string) => void }) => Promise<{ inputId: string; outputId: string; inputName: string; outputName: string } | null>;
}

export interface MidiConnectionPageProps {
  config: MidiConnectionPageConfig;
  store: MidiConnectionPageStore;
  deviceIdRange: { min: number; max: number };
  onContinue: () => void;
}

const TRANSPORT_LABELS: Record<string, string> = {
  web: 'Web MIDI API',
  http: 'HTTP MIDI Server',
  mock: 'Mock MIDI',
};

export function MidiConnectionPage({
  config,
  store,
  deviceIdRange,
  onContinue,
}: MidiConnectionPageProps): JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const displayOffset = config.deviceIdDisplayOffset ?? 0;
  const minDisplay = deviceIdRange.min + displayOffset;
  const maxDisplay = deviceIdRange.max + displayOffset;
  const displayDeviceId = store.deviceId + displayOffset;
  const isConnected = store.status === 'connected';
  const canConnect = Boolean(store.selectedInputId && store.selectedOutputId) && !isConnected;

  const transportMode = getActiveTransportMode();
  const transportLabel = TRANSPORT_LABELS[transportMode] ?? transportMode;

  if (!store.isSupported && store.browserInfo.requiresSecureContext) {
    return (
      <div className="ac-container-md ac-stack-lg">
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
          <p className="ac-mt-3">
            Alternatively, connect using an alternative MIDI transport:
          </p>
          <div className="ac-mt-3">
            <TransportSelector disabled={false} webMidiUnsupported={!store.isSupported} />
          </div>
        </section>
      </div>
    );
  }

  if (!store.isSupported) {
    return (
      <div className="ac-container-md ac-stack-lg">
        <section className="ac-card">
          <h2 className="ac-title-lg">Connect to {config.deviceName}</h2>
          <p>
            The Web MIDI API is not available in {store.browserInfo.browser}.
          </p>
          <p className="ac-text-muted">{store.browserInfo.notes}</p>
          <p className="ac-mt-3">
            You can connect using an alternative MIDI transport:
          </p>
          <div className="ac-mt-3">
            <TransportSelector disabled={false} webMidiUnsupported={!store.isSupported} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="ac-container-md ac-stack-lg">
      <section className="ac-card">
        <h2 className="ac-title-lg">Connect to {config.deviceName}</h2>

        <p className="ac-text-muted ac-text-sm">
          Transport: {transportLabel}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="ac-link ac-ml-2"
          >
            {showAdvanced ? 'Hide' : 'Change'}
          </button>
        </p>

        {showAdvanced && (
          <div className="ac-mt-3">
            <TransportSelector disabled={isConnected} webMidiUnsupported={!store.isSupported} />
          </div>
        )}

        {!store.sysExEnabled && store.inputs.length > 0 && (
          <p className="ac-text-warn ac-mt-2">
            SysEx access was denied. Allow SysEx permission for full device communication.
          </p>
        )}

        {store.error ? (
          <>
            <p className="ac-text-error ac-mt-2">{store.error}</p>
            {transportMode !== 'web' && (
              <div className="ac-mt-3">
                <button
                  type="button"
                  onClick={() => {
                    clearTransportConfig();
                    window.location.reload();
                  }}
                  className="ac-toolbar-btn"
                >
                  Reset Transport
                </button>
                <div className="ac-mt-3">
                  <TransportSelector disabled={isConnected} webMidiUnsupported={!store.isSupported} />
                </div>
              </div>
            )}
          </>
        ) : null}

        {transportMode === 'web' && (
          <div className="ac-grid-2 ac-mt-3">
            <MidiPortSelector
              label={config.inputLabel}
              ports={store.inputs}
              value={store.selectedInputId}
              onChange={store.setSelectedInputId}
              disabled={store.status === 'connected' || store.status === 'connecting'}
              testId="midi-input-select"
            />
            <MidiPortSelector
              label={config.outputLabel}
              ports={store.outputs}
              value={store.selectedOutputId}
              onChange={store.setSelectedOutputId}
              disabled={store.status === 'connected' || store.status === 'connecting'}
              testId="midi-output-select"
            />
          </div>
        )}

        <div className="ac-row ac-mt-4">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={() => void store.disconnect()}
                className="ac-toolbar-btn"
                data-testid="disconnect-button"
              >
                Disconnect
              </button>
              <button
                type="button"
                onClick={onContinue}
                className="ac-toolbar-btn ac-toolbar-btn--primary"
              >
                {config.continueLabel}
              </button>
            </>
          ) : (
            transportMode === 'web' ? (
              <>
                <button
                  type="button"
                  onClick={() => void store.connect()}
                  disabled={!canConnect || store.status === 'connecting'}
                  className="ac-toolbar-btn ac-toolbar-btn--primary"
                  data-testid="connect-button"
                >
                  {store.status === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
                <button
                  type="button"
                  onClick={() => void store.refresh()}
                  className="ac-toolbar-btn"
                >
                  Refresh Ports
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void store.reconnect()}
                className="ac-toolbar-btn ac-toolbar-btn--primary"
              >
                Reconnect
              </button>
            )
          )}
        </div>
      </section>

      <section className="ac-card">
        <h3 className="ac-title-md">{config.deviceIdLabel}</h3>
        <p className="ac-text-muted">{config.deviceIdHelpText}</p>
        <div className="ac-row">
          <input
            className="ac-input ac-input-center ac-input-sm"
            type="number"
            min={minDisplay}
            max={maxDisplay}
            value={displayDeviceId}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10) || minDisplay;
              store.setDeviceId(parsed - displayOffset);
            }}
            disabled={store.status === 'connected'}
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
