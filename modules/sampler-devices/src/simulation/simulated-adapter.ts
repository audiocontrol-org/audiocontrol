/**
 * SimulatedAdapter
 *
 * A drop-in `SSeriesMidiAdapter` that replays a captured `FixtureScenario`.
 * Mounts in place of the real adapter so the editor (and any other code
 * built on the SSeriesMidiAdapter contract) runs end-to-end without
 * touching MIDI hardware.
 *
 * Replay model:
 * - The fixture is a strict ordered byte-level event log. Each
 *   `outbound` event is the bytes the UI sent to the device on the
 *   recording day; each `inbound` is what the device sent back.
 * - When the consumer calls `send(bytes)`, the next unconsumed record at
 *   the cursor MUST be `outbound` and must match the bytes byte-for-byte.
 *   On match: advance the cursor, then drain consecutive `inbound`
 *   records into the registered listeners (immediately or with latency,
 *   depending on `latencyMode`).
 * - Mismatch / wrong direction / cursor exhausted ⇒ throw with diagnostic
 *   context. Silent fallback would defeat the point of replay testing.
 *
 * @packageDocumentation
 */

import type { SSeriesMidiAdapter } from '../devices/roland-s-series/s-series-types.js';
import type { FixtureScenario, FixtureRecord } from '../recording/fixture-schema.js';

export type LatencyMode = 'none' | 'recorded' | { fixedMs: number };

export interface SimulatedAdapterOptions {
    /**
     * Latency model for inbound dispatch.
     * - `'none'`: fire inbound synchronously after the matching outbound returns
     * - `'recorded'`: use the recorded timestamp delta (inbound.timestampMs - outbound.timestampMs)
     * - `{ fixedMs }`: fixed delay
     */
    latencyMode: LatencyMode;
}

export class SimulatedAdapterUnexpectedSendError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SimulatedAdapterUnexpectedSendError';
    }
}

export class SimulatedAdapterRecordsExhaustedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SimulatedAdapterRecordsExhaustedError';
    }
}

/**
 * Public introspection methods on SimulatedAdapter — used by test
 * harnesses to assert that a fixture's outbound records were fully
 * consumed (positive-assertion infrastructure, see
 * tone-writes-helpers.expectFixtureFullyConsumed).
 *
 * SimulatedAdapter implements this interface; the type also serves as
 * the contract for window.__simulatedAdapter so both the source-tree
 * exposure and the test-tree read site compile against the same shape.
 * Adding a method here forces every test consumer to update.
 */
export interface SimulatedAdapterIntrospection {
    getCursor(): number;
    getTotalRecords(): number;
}

export class SimulatedAdapter implements SSeriesMidiAdapter, SimulatedAdapterIntrospection {
    private readonly scenario: FixtureScenario;
    private readonly latencyMode: LatencyMode;
    private cursor = 0;
    private readonly listeners: Array<(data: number[]) => void> = [];

    constructor(scenario: FixtureScenario, options: SimulatedAdapterOptions) {
        this.scenario = scenario;
        this.latencyMode = options.latencyMode;
    }

    send(data: number[]): void {
        if (this.cursor >= this.scenario.records.length) {
            throw new SimulatedAdapterRecordsExhaustedError(
                `send([${formatBytes(data)}]) — fixture "${this.scenario.name}" has no more outbound records (cursor at end of ${this.scenario.records.length} records)`,
            );
        }

        const expected = this.scenario.records[this.cursor];

        if (expected.kind !== 'outbound') {
            throw new SimulatedAdapterUnexpectedSendError(
                `send([${formatBytes(data)}]) — fixture "${this.scenario.name}" has no more outbound records at cursor ${this.cursor}; next record is ${expected.kind}`,
            );
        }

        const diffIndex = firstByteDiff(expected.bytes, data);
        if (diffIndex !== -1) {
            const expectedByte = diffIndex < expected.bytes.length ? toHex(expected.bytes[diffIndex]) : '<end>';
            const actualByte = diffIndex < data.length ? toHex(data[diffIndex]) : '<end>';
            throw new SimulatedAdapterUnexpectedSendError(
                `send([${formatBytes(data)}]) at sequence ${expected.sequence} does not match recorded outbound [${formatBytes(expected.bytes)}] — first diff at byte ${diffIndex}: expected ${expectedByte}, got ${actualByte}`,
            );
        }

        // Match — advance cursor past the outbound, then drain consecutive inbound.
        const outboundTimestamp = expected.timestampMs;
        this.cursor++;
        this.dispatchPendingInbound(outboundTimestamp);
    }

    /**
     * Return the current cursor (number of records consumed so far —
     * both `outbound` records that matched a `send()` call and the
     * subsequent `inbound` records drained by `dispatchPendingInbound`).
     *
     * Capability specs use this to assert their UI driver actually
     * emitted an outbound — without a positive assertion, a UI control
     * that's silently disabled or a click that lands off-target would
     * make the test false-pass (no outbound emitted = no byte mismatch
     * = no error thrown by `send()`).
     */
    getCursor(): number {
        return this.cursor;
    }

    /**
     * Total record count in the underlying scenario. Paired with
     * `getCursor()`; capability specs assert
     * `cursorAfter === totalRecords` to prove every captured byte was
     * replayed in full.
     */
    getTotalRecords(): number {
        return this.scenario.records.length;
    }

    onSysEx(callback: (data: number[]) => void): void {
        this.listeners.push(callback);
    }

    removeSysExListener(callback: (data: number[]) => void): void {
        const idx = this.listeners.indexOf(callback);
        if (idx >= 0) {
            this.listeners.splice(idx, 1);
        }
    }

    private dispatchPendingInbound(referenceTimestamp: number): void {
        while (this.cursor < this.scenario.records.length) {
            const next = this.scenario.records[this.cursor];
            if (next.kind !== 'inbound') break;

            const delayMs = this.computeDelay(referenceTimestamp, next);
            const bytes = [...next.bytes];
            this.cursor++;

            if (delayMs <= 0) {
                this.fireListeners(bytes);
            } else {
                // Snapshot the listener list at scheduling time? No — fire
                // against whoever is registered at delivery time, which
                // matches real hardware behavior (late listeners miss
                // earlier events; early-detached listeners don't get them).
                setTimeout(() => this.fireListeners(bytes), delayMs);
            }
        }
    }

    private computeDelay(referenceTimestamp: number, inbound: FixtureRecord): number {
        if (this.latencyMode === 'none') return 0;
        if (this.latencyMode === 'recorded') {
            return Math.max(0, inbound.timestampMs - referenceTimestamp);
        }
        return Math.max(0, this.latencyMode.fixedMs);
    }

    private fireListeners(bytes: number[]): void {
        for (const cb of [...this.listeners]) {
            cb([...bytes]);
        }
    }
}

function firstByteDiff(expected: number[], actual: number[]): number {
    const len = Math.max(expected.length, actual.length);
    for (let i = 0; i < len; i++) {
        if (expected[i] !== actual[i]) return i;
    }
    return -1;
}

function formatBytes(bytes: number[]): string {
    if (bytes.length <= 12) {
        return bytes.map(toHex).join(' ');
    }
    const head = bytes.slice(0, 6).map(toHex).join(' ');
    const tail = bytes.slice(-3).map(toHex).join(' ');
    return `${head} ... ${tail} (${bytes.length} bytes)`;
}

function toHex(b: number): string {
    return `0x${b.toString(16).padStart(2, '0').toUpperCase()}`;
}
