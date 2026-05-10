/**
 * SimulatedMidiTransport — wraps SimulatedAdapter as a MidiTransport.
 *
 * Mounts in place of the real Web MIDI / mock / http / scsi transport when
 * the editor is loaded with `?midi=simulated&scenario=<name>` URL params.
 * Fetches an NDJSON fixture in `initialize()` and creates a fresh
 * SimulatedAdapter per `connect()` call so each connection (e.g. React
 * StrictMode double-mount, or a manual reconnect) gets a clean cursor.
 *
 * Phase 0 Task 7 — see `.tmp/phase-0-task-7-injection-design.md`.
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
      return SIMULATED_PORTS;
    },
    refresh: async (): Promise<MidiTransportPorts> => SIMULATED_PORTS,
    onStateChange: () => {
      // Simulated transport has no port hot-plug events.
    },
    connect: async (
      _inputId: string,
      _outputId: string,
    ): Promise<MidiTransportConnection> => {
      if (!cachedScenario) {
        throw new Error(
          '[SimulatedMidiTransport] connect() called before initialize(). ' +
            'The store should always call initialize() first.',
        );
      }
      const adapter = new SimulatedAdapter(cachedScenario, { latencyMode: 'none' });
      return {
        adapter,
        inputInfo: SIMULATED_INPUT,
        outputInfo: SIMULATED_OUTPUT,
        disconnect: async () => {
          // SimulatedAdapter cursor state is owned by this instance and is
          // discarded with it. Nothing to clean up explicitly.
        },
      };
    },
  };
}
