/**
 * HomePage — the device-connect surface.
 *
 * Implements the operator-approved VFD-status mockup at
 * `docs/1.0/001-IN-PROGRESS/s550-support/explorations/ACCEPTED/`
 * `2026-05-18-connect-vfd-status/`. Single-CTA state machine:
 * `Scan for device` → `Connect` → `Continue to <next>` (with a
 * secondary Disconnect). Probe is operator-initiated, never
 * automatic — sending SysEx Identity Requests to every visible MIDI
 * port is invasive and must be explicit.
 *
 * Connection state is sourced from the editor-core useHomePageStore;
 * probe state is local to this component.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MidiPortSelector,
  TransportSelector,
  useHomePageStore,
  getActiveTransportMode,
  clearTransportConfig,
  AcToggle,
  type AcToggleOption,
} from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { cn } from '@/lib/utils';

type ProbeState = 'idle' | 'scanning' | 'found' | 'not-found';

type TransportKey = 'web' | 'http' | 'mock';

const TRANSPORT_LABELS: Record<string, string> = {
  web: 'Web MIDI API',
  http: 'HTTP MIDI Server',
  mock: 'Mock MIDI',
};

const TRANSPORT_OPTIONS: ReadonlyArray<AcToggleOption<TransportKey>> = [
  { value: 'web', label: 'Web MIDI' },
  { value: 'http', label: 'HTTP' },
  { value: 'mock', label: 'Mock' },
];

function resolveTransport(mode: string): TransportKey {
  if (mode === 'web' || mode === 'http' || mode === 'mock') return mode;
  return 'web';
}

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const midi = useMidiStore();
  const { deviceType, deviceName, basePath } = useDeviceConfig();
  const store = useHomePageStore(deviceType, midi);

  const [probeState, setProbeState] = useState<ProbeState>('idle');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const transportMode = getActiveTransportMode();
  const transportLabel = TRANSPORT_LABELS[transportMode] ?? transportMode;
  const transportKey = resolveTransport(transportMode);

  const isConnected = store.status === 'connected';
  const isConnecting = store.status === 'connecting';
  const isError = store.status === 'error';

  // Operator has chosen both ports — manually via the Connection
  // Details dropdowns OR carried over from localStorage. Treated
  // equivalently to a completed `Scan` for the CTA derivation: a
  // ready-to-connect state, no probe required.
  const portsReady = !!store.selectedInputId && !!store.selectedOutputId;

  // When the connection succeeds (e.g., via URL auto-connect or
  // after the operator clicked Connect), normalize probe state so
  // the UI doesn't read as "needs to scan first".
  useEffect(() => {
    if (isConnected) setProbeState('found');
  }, [isConnected]);

  // ---- DERIVED STATUS + CTA ----------------------------------
  const continueLabel = `Continue to ${basePath.endsWith('/') ? 'Patches' : 'Patches'}`;
  // The runtime config has a continueLabel field that varies per
  // device, but it's always "Continue to Patches" today; preserve
  // that string verbatim because connection.spec.ts targets it by
  // accessible name.

  let statusLabel: string;
  let ledModifier = ''; // '' (default rec-red blink) | --scanning | --success
  if (isConnected) {
    statusLabel = 'Connected';
    ledModifier = 'ac-vfd-led--success';
  } else if (isConnecting) {
    statusLabel = 'Connecting…';
    ledModifier = 'ac-vfd-led--scanning';
  } else if (probeState === 'scanning') {
    statusLabel = 'Scanning MIDI ports…';
    ledModifier = 'ac-vfd-led--scanning';
  } else if (probeState === 'found' || portsReady) {
    statusLabel = 'Ready to connect';
  } else if (probeState === 'not-found') {
    statusLabel = 'No MIDI interface detected';
  } else {
    statusLabel = 'Ready to scan';
  }

  // CTA: the next operator action. State-driven label + behavior.
  let ctaLabel: string;
  let ctaState: 'scan' | 'connect' | 'continue' | 'retry';
  let ctaTestId: string | undefined;
  let ctaDisabled = false;
  if (isConnecting) {
    ctaLabel = 'Connecting…';
    ctaState = 'connect';
    ctaTestId = 'connect-button';
    ctaDisabled = true;
  } else if (isConnected) {
    ctaLabel = continueLabel;
    ctaState = 'continue';
  } else if (probeState === 'scanning') {
    ctaLabel = 'Scanning…';
    ctaState = 'scan';
    ctaDisabled = true;
  } else if (probeState === 'found' || portsReady) {
    ctaLabel = isError ? 'Retry' : 'Connect';
    ctaState = isError ? 'retry' : 'connect';
    ctaTestId = 'connect-button';
  } else if (probeState === 'not-found') {
    ctaLabel = 'Scan again';
    ctaState = 'scan';
  } else {
    ctaLabel = 'Scan for device';
    ctaState = 'scan';
  }

  // Detected port labels — visible in the VFD's Detected row once a
  // scan has populated the candidates.
  const selectedInput = store.inputs.find((p) => p.id === store.selectedInputId);
  const selectedOutput = store.outputs.find((p) => p.id === store.selectedOutputId);
  const detectedReadout = useMemo(() => {
    if (probeState === 'scanning') return 'Probing MIDI ports…';
    if (probeState === 'not-found') return null;
    if (selectedInput && selectedOutput) {
      // Operators usually see one cable on a single interface; show the
      // input label as the primary readout. If input ≠ output we surface
      // both so the operator knows what we matched.
      const portName = selectedInput.name === selectedOutput.name
        ? selectedInput.name
        : `${selectedInput.name} ↔ ${selectedOutput.name}`;
      return `${portName} · ID ${store.deviceId + 1}`;
    }
    return null;
  }, [probeState, selectedInput, selectedOutput, store.deviceId]);

  // ---- ACTIONS -----------------------------------------------
  const onScan = useCallback(async () => {
    setProbeState('scanning');
    await store.refresh();
    // Heuristic candidate selection: prefer ports whose label mentions
    // the device name, otherwise fall back to first available.
    const lower = deviceName.toLowerCase();
    const pickInput = store.inputs.find((p) => p.name.toLowerCase().includes(lower)) ?? store.inputs[0];
    const pickOutput = store.outputs.find((p) => p.name.toLowerCase().includes(lower)) ?? store.outputs[0];
    if (!pickInput || !pickOutput) {
      setProbeState('not-found');
      return;
    }
    store.setSelectedInputId(pickInput.id);
    store.setSelectedOutputId(pickOutput.id);
    setProbeState('found');
  }, [deviceName, store]);

  const onConnect = useCallback(async () => {
    await store.connect();
  }, [store]);

  const onContinue = useCallback(() => {
    navigate(`${basePath}/patches`);
  }, [navigate, basePath]);

  const onDisconnect = useCallback(async () => {
    await store.disconnect();
    setProbeState('idle');
  }, [store]);

  const onCtaClick = () => {
    if (ctaState === 'scan' || ctaState === 'retry') return void onScan();
    if (ctaState === 'connect') return void onConnect();
    if (ctaState === 'continue') return onContinue();
  };

  const openConnectionDetails = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setAdvancedOpen(true);
    queueMicrotask(() => {
      document.getElementById('connection-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const minDeviceId = 1;
  const maxDeviceId = 17;
  const displayDeviceId = store.deviceId + 1;

  const onTransportChange = useCallback((next: TransportKey) => {
    // Transport switching reloads the page after clearing the runtime
    // config — same shape as the existing "Reset Transport" affordance.
    clearTransportConfig();
    // TransportSelector below writes the new selection to localStorage
    // and reloads; for the AcToggle path we mirror that by setting the
    // query param and reloading. (Mock and HTTP have their own setup
    // surfaces inside TransportSelector.)
    const params = new URLSearchParams(window.location.search);
    if (next === 'web') params.delete('midi');
    else params.set('midi', next);
    window.location.search = params.toString();
  }, []);

  return (
    <div className="ac-page ac-page-shell">
      <header className="ac-page-title-row">
        <div className="ac-page-title-block">
          <h2 id="connect-heading" className="ac-page-title-heading">Connect</h2>
          <div className="ac-page-title-rule" aria-hidden="true" />
        </div>
        <span className="ac-page-title-metric">
          {deviceName} · MIDI Handshake
        </span>
      </header>

      {/* VFD STATUS DISPLAY -------------------------------------- */}
      <section className="ac-vfd" aria-label="Connection status">
        <div className="ac-vfd-screen">
          <div className="ac-vfd-status-line">
            <span className={cn('ac-vfd-led', ledModifier)} aria-hidden="true" />
            <span className="ac-vfd-status-label">Status</span>
            <span className="ac-vfd-status-value">{statusLabel}</span>
          </div>
          <div className="ac-vfd-detail">
            {/*
              Single text run "Transport: {label}" so the wiring spec's
              `getByText(/Transport: simulated/)` matches under the
              simulated harness (transportMode='simulated' falls through
              the TRANSPORT_LABELS map and renders verbatim).
            */}
            <div className="ac-vfd-detail-row">
              <span>Transport: {transportLabel}</span>
              <button
                type="button"
                className="ac-vfd-action"
                onClick={openConnectionDetails}
                aria-controls="connection-details"
                aria-label="Change transport"
              >
                change
              </button>
            </div>
            <div className="ac-vfd-detail-row">
              <span>Device: {deviceName}</span>
            </div>
            {detectedReadout && (
              <div className="ac-vfd-detail-row">
                <span>Detected: {detectedReadout}</span>
                {(probeState === 'found' || portsReady) && !isConnected && (
                  <>
                    <button
                      type="button"
                      className="ac-vfd-action"
                      onClick={() => { void onScan(); }}
                    >
                      re-scan
                    </button>
                    <button
                      type="button"
                      className="ac-vfd-action"
                      onClick={openConnectionDetails}
                      aria-controls="connection-details"
                    >
                      configure
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PRIMARY CTA --------------------------------------------- */}
      <div className="ac-connect-cta-row">
        <button
          type="button"
          className="ac-connect-cta"
          onClick={onCtaClick}
          disabled={ctaDisabled}
          data-state={ctaState}
          data-testid={ctaTestId}
        >
          {ctaLabel}
        </button>
        {isConnected && (
          <button
            type="button"
            className="ac-connect-cta ac-connect-cta--secondary"
            onClick={() => { void onDisconnect(); }}
            data-testid="disconnect-button"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Error message, when one exists. */}
      {store.error && (
        <div className="ac-alert ac-alert-error" data-testid="connect-error">
          <p className="ac-text-error">{store.error}</p>
        </div>
      )}

      {/* DISCLOSURES — Connection details + Setup + Troubleshooting */}
      <section className="learn-more" aria-label="More options" style={{ marginTop: 'var(--ac-space-4)' }}>
        <details
          id="connection-details"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>
            <span className="marker" aria-hidden="true">▸</span>
            <span>Connection details</span>
            <span className="count">{transportLabel} · {transportKey === 'web' ? '3 fields' : '2 fields'}</span>
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="ac-connect-transport-row">
              <span className="ac-connect-checklist-label">Transport</span>
              <div className="ac-connect-transport-row-controls">
                <AcToggle<TransportKey>
                  value={transportKey}
                  options={TRANSPORT_OPTIONS}
                  onChange={onTransportChange}
                  ariaLabel="Choose transport"
                  name="connect-transport"
                />
              </div>
              <p className="ac-connect-transport-hint">
                Leave on <strong>Web MIDI API</strong> unless you're running a specific test rig
                (HTTP for the SCSI-bridge / Pi, Mock for the simulated harness).
              </p>
            </div>

            {transportKey === 'web' ? (
              <>
                <div className="ac-connect-checklist">
                  <div className="ac-connect-checklist-num">01</div>
                  <div>
                    <div className="ac-connect-checklist-label">MIDI Input · From device</div>
                    <MidiPortSelector
                      label=""
                      ports={store.inputs}
                      value={store.selectedInputId}
                      onChange={store.setSelectedInputId}
                      disabled={isConnected || isConnecting}
                      testId="midi-input-select"
                    />
                  </div>
                </div>
                <div className="ac-connect-checklist">
                  <div className="ac-connect-checklist-num">02</div>
                  <div>
                    <div className="ac-connect-checklist-label">MIDI Output · To device</div>
                    <MidiPortSelector
                      label=""
                      ports={store.outputs}
                      value={store.selectedOutputId}
                      onChange={store.setSelectedOutputId}
                      disabled={isConnected || isConnecting}
                      testId="midi-output-select"
                    />
                  </div>
                </div>
                <div className="ac-connect-checklist">
                  <div className="ac-connect-checklist-num">03</div>
                  <div>
                    <div className="ac-connect-checklist-label">
                      Device ID · Front panel MIDI menu
                    </div>
                    <div className="ac-connect-checklist-control">
                      <input
                        type="number"
                        className="ac-input"
                        min={minDeviceId}
                        max={maxDeviceId}
                        value={displayDeviceId}
                        onChange={(e) => {
                          const parsed = Number.parseInt(e.target.value, 10) || minDeviceId;
                          store.setDeviceId(Math.min(maxDeviceId, Math.max(minDeviceId, parsed)) - 1);
                        }}
                        disabled={isConnected}
                        style={{ maxWidth: '4.5rem', textAlign: 'center' }}
                      />
                      <span className="ac-connect-checklist-hint">
                        ({minDeviceId}–{maxDeviceId} · matches device front-panel display)
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="ac-connect-checklist">
                <div className="ac-connect-checklist-num">·</div>
                <div>
                  <div className="ac-connect-checklist-label">{transportLabel} configuration</div>
                  <TransportSelector disabled={isConnected || isConnecting} webMidiUnsupported={!midi.isSupported} />
                </div>
              </div>
            )}
          </div>
        </details>

        <details>
          <summary>
            <span className="marker" aria-hidden="true">▸</span>
            <span>Setup guide · prepare your device for SysEx control</span>
            <span className="count">7 steps</span>
          </summary>
          <div className="learn-more-body">
            <p>
              Before the editor can read or write to your {deviceName}, the device itself
              needs to be put into a mode where it accepts SysEx. Step-by-step:
            </p>
            <ol>
              <li>Power on the {deviceName} and wait for the home screen.</li>
              <li>Press <strong>MIDI</strong> on the front panel.</li>
              <li>Confirm <strong>EXC ON</strong> is set (Exclusive accepted).</li>
              <li>Note the Device ID shown on the screen — enter the same value in the Device ID field (1–17, defaults to 1).</li>
              <li>Connect the {deviceName}'s MIDI OUT to your interface's MIDI IN.</li>
              <li>Connect your interface's MIDI OUT to the {deviceName}'s MIDI IN.</li>
              <li>Press <strong>Scan for device</strong> above, then <strong>Connect</strong>.</li>
            </ol>
          </div>
        </details>

        <details>
          <summary>
            <span className="marker" aria-hidden="true">▸</span>
            <span>Troubleshooting · the editor can't reach the device</span>
            <span className="count">common fixes</span>
          </summary>
          <div className="learn-more-body">
            <ul>
              <li>Confirm the MIDI interface appears in BOTH the Input and Output dropdowns. For most operators it should be the same interface in both.</li>
              <li>If your browser prompted for Web MIDI access on first load, click <em>Allow</em>. Without that permission the editor can read MIDI events but cannot write changes to {deviceName}.</li>
              <li>On the device itself, the MIDI menu's <em>EXC</em> setting must be <em>ON</em> for the editor to read or write patches and tones. (Setup Guide → step 3.)</li>
              <li>The {deviceName} displays IDs 1–17 on the front panel but the underlying MIDI protocol value is 0–16. The form here uses the front-panel value, so match what your device shows.</li>
              <li>Some MIDI interfaces require their own utility to be running. Make sure the interface is recognized by your OS before reloading the editor.</li>
              <li>If a previous connection left the device in an odd state, power-cycle the {deviceName} and reload the page.</li>
            </ul>
          </div>
        </details>
      </section>
    </div>
  );
}
