import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecordingProxyAdapter } from '@/recording/recording-proxy.js';
import type { SSeriesMidiAdapter } from '@/devices/roland-s-series/s-series-types.js';

/**
 * Build a fake real adapter for tests.
 *
 * The fake exposes `fireInbound(bytes)` so tests can simulate the device
 * delivering an inbound message. It records `sent` and the registered
 * listeners so we can assert the proxy delegates correctly.
 */
function createFakeAdapter() {
    const sent: number[][] = [];
    const listeners: Array<(data: number[]) => void> = [];

    const adapter: SSeriesMidiAdapter = {
        send(data: number[]): void {
            sent.push([...data]);
        },
        onSysEx(callback: (data: number[]) => void): void {
            listeners.push(callback);
        },
        removeSysExListener(callback: (data: number[]) => void): void {
            const idx = listeners.indexOf(callback);
            if (idx >= 0) listeners.splice(idx, 1);
        },
    };

    function fireInbound(bytes: number[]): void {
        for (const cb of [...listeners]) cb([...bytes]);
    }

    return { adapter, sent, listeners, fireInbound };
}

describe('RecordingProxyAdapter', () => {
    let mockClock: { now: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        let t = 0;
        mockClock = {
            now: vi.fn(() => {
                const v = t;
                t += 10; // each call advances clock by 10ms
                return v;
            }),
        };
    });

    describe('outbound', () => {
        it('records send() and delegates to the real adapter', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'send-test',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            proxy.send([0xf0, 0x41, 0x00, 0x1e, 0x11, 0xf7]);

            expect(real.sent).toEqual([[0xf0, 0x41, 0x00, 0x1e, 0x11, 0xf7]]);
            const scenario = proxy.getScenario();
            expect(scenario.records).toHaveLength(1);
            expect(scenario.records[0].kind).toBe('outbound');
            expect(scenario.records[0].bytes).toEqual([0xf0, 0x41, 0x00, 0x1e, 0x11, 0xf7]);
            expect(scenario.records[0].timestampMs).toBe(0);
        });

        it('captures multiple sends in order with monotonic sequence + advancing timestamps', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'multi-send',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            proxy.send([0xf0, 0x01, 0xf7]);
            proxy.send([0xf0, 0x02, 0xf7]);
            proxy.send([0xf0, 0x03, 0xf7]);

            const records = proxy.getScenario().records;
            expect(records.map((r) => r.sequence)).toEqual([0, 1, 2]);
            expect(records.map((r) => r.bytes[1])).toEqual([0x01, 0x02, 0x03]);
            expect(records.map((r) => r.timestampMs)).toEqual([0, 10, 20]);
            expect(records.every((r) => r.kind === 'outbound')).toBe(true);
        });
    });

    describe('inbound', () => {
        it('captures inbound message and forwards to registered listener', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'inbound-test',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            const received: number[][] = [];
            proxy.onSysEx((data) => received.push([...data]));

            real.fireInbound([0xf0, 0x42, 0xf7]);

            expect(received).toEqual([[0xf0, 0x42, 0xf7]]);
            const scenario = proxy.getScenario();
            expect(scenario.records).toHaveLength(1);
            expect(scenario.records[0].kind).toBe('inbound');
            expect(scenario.records[0].bytes).toEqual([0xf0, 0x42, 0xf7]);
        });

        it('forwards inbound to all registered listeners', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'fanout',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            const a: number[][] = [];
            const b: number[][] = [];
            proxy.onSysEx((data) => a.push([...data]));
            proxy.onSysEx((data) => b.push([...data]));

            real.fireInbound([0xf0, 0x99, 0xf7]);

            expect(a).toEqual([[0xf0, 0x99, 0xf7]]);
            expect(b).toEqual([[0xf0, 0x99, 0xf7]]);
            // But only ONE record (the inbound message itself, not per-listener)
            expect(proxy.getScenario().records).toHaveLength(1);
        });

        it('removeSysExListener detaches a specific listener without affecting others', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'detach',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            const a: number[][] = [];
            const b: number[][] = [];
            const cbA = (data: number[]) => a.push([...data]);
            const cbB = (data: number[]) => b.push([...data]);
            proxy.onSysEx(cbA);
            proxy.onSysEx(cbB);

            real.fireInbound([0xf0, 0x01, 0xf7]);
            proxy.removeSysExListener(cbA);
            real.fireInbound([0xf0, 0x02, 0xf7]);

            expect(a).toEqual([[0xf0, 0x01, 0xf7]]); // only the first
            expect(b).toEqual([
                [0xf0, 0x01, 0xf7],
                [0xf0, 0x02, 0xf7],
            ]);
            // BOTH inbound messages were recorded regardless
            expect(proxy.getScenario().records).toHaveLength(2);
        });
    });

    describe('interleaving', () => {
        it('preserves outbound/inbound order in the captured log', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'interleave',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });
            proxy.onSysEx(() => {}); // register a listener so inbound flows

            proxy.send([0xf0, 0x11, 0xf7]); // RQ
            real.fireInbound([0xf0, 0x12, 0xf7]); // DAT
            real.fireInbound([0xf0, 0x45, 0xf7]); // EOD
            proxy.send([0xf0, 0x52, 0xf7]); // ACK

            const records = proxy.getScenario().records;
            expect(records.map((r) => ({ kind: r.kind, b: r.bytes[1] }))).toEqual([
                { kind: 'outbound', b: 0x11 },
                { kind: 'inbound', b: 0x12 },
                { kind: 'inbound', b: 0x45 },
                { kind: 'outbound', b: 0x52 },
            ]);
            expect(records.map((r) => r.sequence)).toEqual([0, 1, 2, 3]);
        });
    });

    describe('annotation', () => {
        it('annotate() attaches annotation to the next captured record', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'annotation',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            proxy.annotate('RQD patch 0');
            proxy.send([0xf0, 0x01, 0xf7]);
            proxy.send([0xf0, 0x02, 0xf7]); // no annotation

            const records = proxy.getScenario().records;
            expect(records[0].annotation).toBe('RQD patch 0');
            expect(records[1].annotation).toBeUndefined();
        });
    });

    describe('lifecycle', () => {
        it('does NOT register a listener with the real adapter eagerly', () => {
            const real = createFakeAdapter();
            new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'eager',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });
            // Before any onSysEx call, the proxy should NOT have polluted the
            // real adapter listener list — only one underlying listener
            // (the proxy's own) gets registered when the FIRST consumer
            // attaches via proxy.onSysEx().
            expect(real.listeners).toHaveLength(0);
        });

        it('registers exactly one listener with the real adapter regardless of consumer count', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'one-listener',
                device: 's550',
                deviceId: 0,
                clock: mockClock.now,
            });

            proxy.onSysEx(() => {});
            proxy.onSysEx(() => {});
            proxy.onSysEx(() => {});

            // Only one listener attached on the real adapter — the proxy's own multiplexer.
            expect(real.listeners).toHaveLength(1);
        });
    });

    describe('scenario metadata', () => {
        it('preserves name, device, deviceId, description, bridgeVersion in the captured scenario', () => {
            const real = createFakeAdapter();
            const proxy = new RecordingProxyAdapter(real.adapter, {
                scenarioName: 'meta-test',
                device: 's330',
                deviceId: 5,
                description: 'meta scenario',
                bridgeVersion: '1.2.3',
                clock: mockClock.now,
            });
            const scenario = proxy.getScenario();
            expect(scenario.name).toBe('meta-test');
            expect(scenario.device).toBe('s330');
            expect(scenario.deviceId).toBe(5);
            expect(scenario.description).toBe('meta scenario');
            expect(scenario.bridgeVersion).toBe('1.2.3');
            expect(scenario.schemaVersion).toBe(1);
        });
    });
});
