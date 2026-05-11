/**
 * SimulatedMidiTransport — wraps SimulatedAdapter as a MidiTransport.
 *
 * Mounts in place of the real Web MIDI / mock / http / scsi transport when
 * the editor is loaded with `?midi=simulated&scenario=<name>` URL params.
 * Fetches an NDJSON fixture in `initialize()` and returns the SAME
 * SimulatedAdapter across `connect()` calls within a single transport
 * lifetime so React StrictMode's double-mount doesn't reset the cursor
 * mid-mount-sequence. Real hardware connect is idempotent (the device IS
 * the same regardless of how many times the client connects); the
 * simulated transport mirrors that contract.
 *
 * Phase 0 Task 7 — see `.tmp/phase-0-task-7-injection-design.md`.
 * Wave 2b (#412) — switched from per-connect fresh adapter to per-
 * transport singleton adapter; the earlier "fresh per connect" model
 * caused write tests to hit a cursor-0 adapter after StrictMode replaced
 * the first one mid-mount.
 */

import type {
  MidiTransport,
  MidiTransportBrowserInfo,
  MidiTransportConnection,
  MidiTransportPorts,
} from '@audiocontrol/editor-core';
import type { MidiPortInfo } from '@audiocontrol/midi-core';
import {
  SimulatedAdapter,
  parseFixture,
  type FixtureScenario,
} from '@audiocontrol/sampler-devices/recording';

const SIMULATED_INPUT: MidiPortInfo = {
  id: 'sim-in',
  name: 'Simulated In',
  manufacturer: 'AudioControl',
  state: 'connected',
};

const SIMULATED_OUTPUT: MidiPortInfo = {
  id: 'sim-out',
  name: 'Simulated Out',
  manufacturer: 'AudioControl',
  state: 'connected',
};

const SIMULATED_PORTS: MidiTransportPorts = {
  inputs: [SIMULATED_INPUT],
  outputs: [SIMULATED_OUTPUT],
  sysExEnabled: true,
};

export interface SimulatedMidiTransportOptions {
  /** Device folder under the fixtures root (e.g. 's330', 's550'). */
  deviceType: string;
  /** Fixture file basename without the `.ndjson` suffix. */
  scenario: string;
  /** Override the fixture base URL. Defaults to `/test-fixtures`. */
  fixtureBaseUrl?: string;
}

export function createSimulatedMidiTransport(
  options: SimulatedMidiTransportOptions,
): MidiTransport {
  const baseUrl = options.fixtureBaseUrl ?? '/test-fixtures';
  let cachedScenario: FixtureScenario | null = null;
  let sharedAdapter: SimulatedAdapter | null = null;

  const browserInfo: MidiTransportBrowserInfo = {
    supported: true,
    browser: 'Simulated MIDI',
    notes: `Fixture replay: ${options.deviceType}/${options.scenario}`,
  };

  return {
    kind: 'simulated',
    isSupported: () => true,
    getBrowserInfo: () => browserInfo,
    initialize: async (): Promise<MidiTransportPorts> => {
      if (!cachedScenario) {
        const url = `${baseUrl}/${options.deviceType}/${options.scenario}.ndjson`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `[SimulatedMidiTransport] Failed to fetch fixture ${url}: ` +
              `${response.status} ${response.statusText}`,
          );
        }
        const text = await response.text();
        cachedScenario = parseFixture(text);
      }
      // Only create the adapter once per transport lifetime. StrictMode's
      // double-mount calls initialize() twice; we want both calls to
      // resolve against the SAME adapter so the cursor advances
      // monotonically. A fresh adapter requires a fresh transport
      // instance, which currently only happens on a full page reload
      // (the transport is cached in `transportInstances` at module level
      // in `midiStore.ts`). MidiStore.reconnect() — disconnect +
      // initialize — reuses the same adapter under this contract. If a
      // future feature needs Reconnect-to-reset semantics, the transport
      // needs to expose a `resetCursor()` method or the cache
      // invalidation has to happen at the store level.
      if (!sharedAdapter) {
        sharedAdapter = new SimulatedAdapter(cachedScenario, { latencyMode: 'none' });
      }
      return SIMULATED_PORTS;
    },
    // No-op: simulated ports are static; the adapter cache lives in
    // initialize() and survives refresh() calls so the cursor advances
    // monotonically across a refresh-driven reconnect within the same
    // transport lifetime.
    refresh: async (): Promise<MidiTransportPorts> => SIMULATED_PORTS,
    onStateChange: () => {
      // Simulated transport has no port hot-plug events.
    },
    connect: async (
      _inputId: string,
      _outputId: string,
    ): Promise<MidiTransportConnection> => {
      if (!sharedAdapter) {
        throw new Error(
          '[SimulatedMidiTransport] connect() called before initialize(). ' +
            'The store should always call initialize() first.',
        );
      }
      // Return the shared adapter so all `connect()` calls within a
      // single transport lifetime see the same cursor. This matches
      // real-hardware semantics (one device, one state) and avoids the
      // StrictMode double-mount race where a second `connect()` would
      // otherwise hand the page a fresh cursor-0 adapter after the
      // first adapter had already advanced through the mount sequence.
      return {
        adapter: sharedAdapter,
        inputInfo: SIMULATED_INPUT,
        outputInfo: SIMULATED_OUTPUT,
        disconnect: async () => {
          // No-op: the shared adapter survives disconnect so a subsequent
          // re-connect within the same transport keeps the cursor where
          // it was. See `initialize()` above for the lifetime contract:
          // a fresh adapter requires a fresh transport instance (full
          // page reload), and MidiStore.reconnect()'s disconnect +
          // initialize reuses this same adapter.
        },
      };
    },
  };
}
