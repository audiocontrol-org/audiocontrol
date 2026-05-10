import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimulatedAdapter } from '@/simulation/simulated-adapter.js';
import { RecordingProxyAdapter } from '@/recording/recording-proxy.js';
import {
    createScenario,
    appendRecord,
    SCHEMA_VERSION,
    type FixtureScenario,
} from '@/recording/fixture-schema.js';
import type { SSeriesMidiAdapter } from '@/devices/roland-s-series/s-series-types.js';

function buildScenario(): FixtureScenario {
    const scenario = createScenario({
        name: 'sim-test',
        device: 's550',
        deviceId: 0,
    });
    return scenario;
}

describe('SimulatedAdapter', () => {
    describe('basic replay', () => {
        it('accepts a matching outbound, then dispatches the recorded inbound to listener', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0x11, 0xf7], timestampMs: 0 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x12, 0xf7], timestampMs: 50 });

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            const received: number[][] = [];
            sim.onSysEx((data) => received.push([...data]));

            sim.send([0xf0, 0x11, 0xf7]);

            expect(received).toEqual([[0xf0, 0x12, 0xf7]]);
        });

        it('drains consecutive inbound after each matching outbound', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0x11, 0xf7], timestampMs: 0 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x12, 0xf7], timestampMs: 10 }); // DAT
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x45, 0xf7], timestampMs: 20 }); // EOD
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0x52, 0xf7], timestampMs: 30 }); // ACK

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            const received: number[][] = [];
            sim.onSysEx((data) => received.push([...data]));

            sim.send([0xf0, 0x11, 0xf7]);
            expect(received).toEqual([
                [0xf0, 0x12, 0xf7],
                [0xf0, 0x45, 0xf7],
            ]);

            sim.send([0xf0, 0x52, 0xf7]); // ACK should match
            expect(received).toHaveLength(2); // no further inbound
        });
    });

    describe('error cases', () => {
        it('throws on send when fixture is empty', () => {
            const sim = new SimulatedAdapter(buildScenario(), { latencyMode: 'none' });
            expect(() => sim.send([0xf0, 0x11, 0xf7])).toThrow(
                /no more outbound records/i,
            );
        });

        it('throws on send with mismatched bytes', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0x11, 0xf7], timestampMs: 0 });

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            expect(() => sim.send([0xf0, 0x99, 0xf7])).toThrow(/does not match/i);
        });

        it('error includes first-diff byte index for diagnostics', () => {
            const s = buildScenario();
            appendRecord(s, {
                kind: 'outbound',
                bytes: [0xf0, 0x41, 0x00, 0x1e, 0x11, 0xf7],
                timestampMs: 0,
            });

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            // Tamper byte at index 2:
            try {
                sim.send([0xf0, 0x41, 0x99, 0x1e, 0x11, 0xf7]);
                expect.fail('should have thrown');
            } catch (err) {
                expect((err as Error).message).toMatch(/byte 2|index 2/i);
            }
        });

        it('throws if fixture has only inbound at the cursor when send arrives', () => {
            const s = buildScenario();
            // The cursor starts at sequence 0, which is inbound — can't match a send.
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x12, 0xf7], timestampMs: 0 });

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            expect(() => sim.send([0xf0, 0x11, 0xf7])).toThrow();
        });
    });

    describe('listener management', () => {
        it('forwards inbound to multiple listeners', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 0 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0xab, 0xf7], timestampMs: 1 });

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            const a: number[][] = [];
            const b: number[][] = [];
            sim.onSysEx((d) => a.push([...d]));
            sim.onSysEx((d) => b.push([...d]));

            sim.send([0xf0, 0xf7]);
            expect(a).toEqual([[0xf0, 0xab, 0xf7]]);
            expect(b).toEqual([[0xf0, 0xab, 0xf7]]);
        });

        it('removeSysExListener detaches a specific listener', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 0 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x01, 0xf7], timestampMs: 1 });
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 2 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x02, 0xf7], timestampMs: 3 });

            const sim = new SimulatedAdapter(s, { latencyMode: 'none' });
            const a: number[][] = [];
            const b: number[][] = [];
            const cbA = (d: number[]) => a.push([...d]);
            const cbB = (d: number[]) => b.push([...d]);
            sim.onSysEx(cbA);
            sim.onSysEx(cbB);

            sim.send([0xf0, 0xf7]);
            sim.removeSysExListener(cbA);
            sim.send([0xf0, 0xf7]);

            expect(a).toEqual([[0xf0, 0x01, 0xf7]]);
            expect(b).toEqual([
                [0xf0, 0x01, 0xf7],
                [0xf0, 0x02, 0xf7],
            ]);
        });
    });

    describe('latency modes', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('latencyMode "fixed" delays inbound dispatch by fixedMs', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 0 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x77, 0xf7], timestampMs: 10 });

            const sim = new SimulatedAdapter(s, { latencyMode: { fixedMs: 100 } });
            const received: number[][] = [];
            sim.onSysEx((d) => received.push([...d]));

            sim.send([0xf0, 0xf7]);
            expect(received).toHaveLength(0); // inbound not yet fired

            vi.advanceTimersByTime(99);
            expect(received).toHaveLength(0);

            vi.advanceTimersByTime(1);
            expect(received).toEqual([[0xf0, 0x77, 0xf7]]);
        });

        it('latencyMode "recorded" uses the timestamp delta from outbound to inbound', () => {
            const s = buildScenario();
            appendRecord(s, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 100 });
            appendRecord(s, { kind: 'inbound', bytes: [0xf0, 0x77, 0xf7], timestampMs: 150 }); // +50ms

            const sim = new SimulatedAdapter(s, { latencyMode: 'recorded' });
            const received: number[][] = [];
            sim.onSysEx((d) => received.push([...d]));

            sim.send([0xf0, 0xf7]);
            expect(received).toHaveLength(0);

            vi.advanceTimersByTime(49);
            expect(received).toHaveLength(0);

            vi.advanceTimersByTime(1);
            expect(received).toEqual([[0xf0, 0x77, 0xf7]]);
        });
    });

    describe('round-trip with RecordingProxyAdapter', () => {
        it('replay-of-recording produces identical listener output', () => {
            // Stage 1: record from a fake adapter
            const sent: number[][] = [];
            const fakeListeners: Array<(d: number[]) => void> = [];
            const fake: SSeriesMidiAdapter = {
                send: (d) => sent.push([...d]),
                onSysEx: (cb) => fakeListeners.push(cb),
                removeSysExListener: (cb) => {
                    const i = fakeListeners.indexOf(cb);
                    if (i >= 0) fakeListeners.splice(i, 1);
                },
            };
            let clock = 0;
            const proxy = new RecordingProxyAdapter(fake, {
                scenarioName: 'rt',
                device: 's550',
                deviceId: 0,
                clock: () => {
                    const v = clock;
                    clock += 5;
                    return v;
                },
            });

            const recordedListenerOutput: number[][] = [];
            proxy.onSysEx((d) => recordedListenerOutput.push([...d]));

            // Drive a scripted session
            proxy.send([0xf0, 0x11, 0x00, 0xf7]);
            fakeListeners.forEach((cb) => cb([0xf0, 0x12, 0xab, 0xf7]));
            fakeListeners.forEach((cb) => cb([0xf0, 0x45, 0xf7]));
            proxy.send([0xf0, 0x52, 0xf7]);

            const scenario = proxy.getScenario();
            expect(scenario.records).toHaveLength(4);

            // Stage 2: replay the captured scenario through SimulatedAdapter
            const sim = new SimulatedAdapter(scenario, { latencyMode: 'none' });
            const replayedListenerOutput: number[][] = [];
            sim.onSysEx((d) => replayedListenerOutput.push([...d]));

            sim.send([0xf0, 0x11, 0x00, 0xf7]);
            sim.send([0xf0, 0x52, 0xf7]);

            // Replayed listener output must exactly equal the recorded output
            expect(replayedListenerOutput).toEqual(recordedListenerOutput);
        });
    });
});
