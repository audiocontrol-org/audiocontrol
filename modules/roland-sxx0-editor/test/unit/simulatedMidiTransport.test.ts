/**
 * Unit tests for createSimulatedMidiTransport.
 *
 * The simulated transport is a thin shim that wraps the SimulatedAdapter
 * (from @audiocontrol/sampler-devices/recording) as a MidiTransport so the
 * editor's MIDI store can run against captured NDJSON fixtures instead of
 * Web MIDI / hardware.
 *
 * Phase 0 Task 7 — see `.tmp/phase-0-task-7-injection-design.md`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SimulatedAdapter,
  serializeFixture,
  createScenario,
  appendRecord,
} from '@audiocontrol/sampler-devices/recording';
import { createSimulatedMidiTransport } from '@/transports/simulatedMidiTransport';

function buildTrivialScenarioText(): string {
  // Minimum viable fixture: one outbound + one inbound record.
  const scenario = createScenario({
    name: 'unit-test-scenario',
    device: 's330',
    deviceId: 0,
  });
  appendRecord(scenario, {
    kind: 'outbound',
    timestampMs: 0,
    bytes: [0xf0, 0x41, 0x10, 0x1e, 0x11, 0xf7],
  });
  appendRecord(scenario, {
    kind: 'inbound',
    timestampMs: 1,
    bytes: [0xf0, 0x41, 0x10, 0x1e, 0x12, 0xf7],
  });
  return serializeFixture(scenario);
}

describe('createSimulatedMidiTransport', () => {
  afterEach(() => {
    // Restores any vi.spyOn(globalThis, 'fetch') installed by individual
    // tests; vitest tracks the original implementation per spy.
    vi.restoreAllMocks();
  });

  it('returns a MidiTransport whose kind is "simulated" and is supported', () => {
    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'test',
    });
    expect(transport.kind).toBe('simulated');
    expect(transport.isSupported()).toBe(true);
    const info = transport.getBrowserInfo();
    expect(info.supported).toBe(true);
    expect(info.browser).toBe('Simulated MIDI');
    expect(info.notes).toContain('s330');
    expect(info.notes).toContain('test');
  });

  it('initialize() fetches the fixture from /test-fixtures/<deviceType>/<scenario>.ndjson and resolves to one input + one output port', async () => {
    const fixtureText = buildTrivialScenarioText();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : input.toString();
        expect(url).toBe('/test-fixtures/s330/load-everything.ndjson');
        return new Response(fixtureText, { status: 200 });
      });

    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'load-everything',
    });
    const ports = await transport.initialize();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(ports.inputs).toHaveLength(1);
    expect(ports.outputs).toHaveLength(1);
    expect(ports.sysExEnabled).toBe(true);
    expect(ports.inputs[0].manufacturer).toBeDefined();
    expect(ports.outputs[0].manufacturer).toBeDefined();
  });

  it('initialize() rejects with a descriptive error when the fixture fetch returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404, statusText: 'Not Found' }),
    );

    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'missing',
    });
    await expect(transport.initialize()).rejects.toThrow(/Failed to fetch fixture/);
    await expect(transport.initialize()).rejects.toThrow(/404/);
  });

  it('connect() before initialize() rejects with a descriptive error', async () => {
    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'test',
    });
    await expect(transport.connect('sim-in', 'sim-out')).rejects.toThrow(/initialize/);
  });

  it('connect() after initialize() returns a connection whose adapter is a SimulatedAdapter', async () => {
    const fixtureText = buildTrivialScenarioText();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fixtureText, { status: 200 }),
    );

    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'test',
    });
    await transport.initialize();
    const connection = await transport.connect('sim-in', 'sim-out');
    expect(connection.adapter).toBeInstanceOf(SimulatedAdapter);
    expect(connection.inputInfo.id).toBe('sim-in');
    expect(connection.outputInfo.id).toBe('sim-out');
    await connection.disconnect();
  });

  it('returns distinct adapter instances on consecutive connect() calls (cursor isolation)', async () => {
    const fixtureText = buildTrivialScenarioText();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fixtureText, { status: 200 }),
    );

    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'test',
    });
    await transport.initialize();
    const first = await transport.connect('sim-in', 'sim-out');
    const second = await transport.connect('sim-in', 'sim-out');
    expect(first.adapter).not.toBe(second.adapter);
    expect(first.adapter).toBeInstanceOf(SimulatedAdapter);
    expect(second.adapter).toBeInstanceOf(SimulatedAdapter);
    await first.disconnect();
    await second.disconnect();
  });
});
