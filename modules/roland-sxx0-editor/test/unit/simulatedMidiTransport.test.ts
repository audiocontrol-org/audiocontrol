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

/**
 * Two-outbound fixture used by the cursor-continuity tests: lets a test
 * advance the cursor by sending the first outbound, reconnect, then send
 * the second outbound. If the reconnect created a new (cursor-0) adapter,
 * the second send would fail because it'd be compared against the FIRST
 * outbound bytes — which is exactly the bug Wave 2b's contract change
 * fixed.
 */
const FIRST_OUTBOUND_BYTES = [0xf0, 0x41, 0x10, 0x1e, 0x11, 0x01, 0xf7];
const SECOND_OUTBOUND_BYTES = [0xf0, 0x41, 0x10, 0x1e, 0x12, 0x02, 0xf7];

function buildTwoOutboundScenarioText(): string {
  const scenario = createScenario({
    name: 'unit-test-two-outbound',
    device: 's330',
    deviceId: 0,
  });
  appendRecord(scenario, {
    kind: 'outbound',
    timestampMs: 0,
    bytes: FIRST_OUTBOUND_BYTES,
  });
  appendRecord(scenario, {
    kind: 'outbound',
    timestampMs: 1,
    bytes: SECOND_OUTBOUND_BYTES,
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

  it('returns the same adapter instance on consecutive connect() calls (cursor continuity)', async () => {
    // Wave 2b (#412): connect() is idempotent within a transport lifetime
    // so React StrictMode's double-mount does not hand the page a fresh
    // cursor-0 adapter after the first one has already advanced through
    // the mount sequence. Real hardware connect is similarly idempotent —
    // the device IS the same regardless of how many times the client
    // attaches. A genuine reset comes from creating a new transport.
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
    expect(first.adapter).toBe(second.adapter);
    expect(first.adapter).toBeInstanceOf(SimulatedAdapter);
    await first.disconnect();
    await second.disconnect();
  });

  it('preserves cursor across consecutive connect() calls (behavioral: second send advances past first)', async () => {
    // Identity (above) logically implies cursor continuity given
    // SimulatedAdapter's private-cursor model, but this test proves the
    // behavior end-to-end: advance the cursor by sending the FIRST
    // outbound, reconnect, then send the SECOND outbound. If the second
    // connect returned a fresh cursor-0 adapter, this send would be
    // compared against the FIRST outbound bytes and throw.
    const fixtureText = buildTwoOutboundScenarioText();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fixtureText, { status: 200 }),
    );

    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'test',
    });
    await transport.initialize();
    const first = await transport.connect('sim-in', 'sim-out');
    // Advance cursor past record 0.
    first.adapter.send([...FIRST_OUTBOUND_BYTES]);

    const second = await transport.connect('sim-in', 'sim-out');
    expect(first.adapter).toBe(second.adapter);
    // If cursor reset, this would throw (would be compared against
    // FIRST_OUTBOUND_BYTES). It does not — cursor preserved.
    expect(() => second.adapter.send([...SECOND_OUTBOUND_BYTES])).not.toThrow();
  });

  it('returns the same adapter across StrictMode-style double initialize() (cursor preserved)', async () => {
    // StrictMode dev double-mount calls initialize() twice on first mount.
    // The simulated transport must NOT create a second adapter on the
    // second call — that would reset the cursor and corrupt write tests
    // whose setter call lands on cursor 0 of the just-replaced adapter.
    const fixtureText = buildTwoOutboundScenarioText();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fixtureText, { status: 200 }),
    );

    const transport = createSimulatedMidiTransport({
      deviceType: 's330',
      scenario: 'test',
    });
    await transport.initialize();
    const first = await transport.connect('sim-in', 'sim-out');
    // Advance cursor past the first outbound record before the second
    // initialize() — proves the second initialize() does NOT reset.
    first.adapter.send([...FIRST_OUTBOUND_BYTES]);
    await transport.initialize();
    const second = await transport.connect('sim-in', 'sim-out');
    expect(first.adapter).toBe(second.adapter);
    // Cursor still points at the second outbound record — would throw if
    // initialize() had created a fresh cursor-0 adapter.
    expect(() => second.adapter.send([...SECOND_OUTBOUND_BYTES])).not.toThrow();
  });
});
