/**
 * RecordingProxyAdapter
 *
 * A drop-in `SSeriesMidiAdapter` that wraps a real adapter and captures
 * every byte-level event — outbound `send()` calls and inbound `onSysEx`
 * callbacks fired by the real adapter — into a {@link FixtureScenario}.
 *
 * Architecture rationale: the Phase 0 contract audit established that
 * front-panel DT1 sends and parameter-listener inbound broadcasts both
 * bypass `SamplerClientInterface` and converge at this adapter. Recording
 * here covers the full device communication surface in one place.
 *
 * @packageDocumentation
 */

import type { SSeriesMidiAdapter } from '../devices/roland-s-series/s-series-types.js';
import {
    SCHEMA_VERSION,
    appendRecord,
    createScenario,
    type FixtureDevice,
    type FixtureScenario,
} from './fixture-schema.js';

/**
 * Clock function returning monotonic milliseconds since some fixed origin
 * (typically scenario start). Injected for deterministic tests.
 */
export type ClockFn = () => number;

export interface RecordingProxyAdapterOptions {
    scenarioName: string;
    device: FixtureDevice;
    deviceId: number;
    description?: string;
    bridgeVersion?: string;
    /**
     * Clock function. When omitted, defaults to `performance.now()` (browser
     * + Node 16+) measured from proxy construction time.
     */
    clock?: ClockFn;
}

/**
 * Real-time recording proxy.
 *
 * Construct with the real adapter; pass the proxy wherever an
 * `SSeriesMidiAdapter` is expected. Call {@link getScenario} to retrieve
 * the captured event log; serialise via `serializeFixture()`.
 */
export class RecordingProxyAdapter implements SSeriesMidiAdapter {
    private readonly real: SSeriesMidiAdapter;
    private readonly scenario: FixtureScenario;
    private readonly clock: ClockFn;
    private readonly consumerListeners: Array<(data: number[]) => void> = [];
    private realListenerAttached = false;
    private pendingAnnotation: string | undefined;

    /**
     * Single multiplexed listener that the proxy registers with the real
     * adapter. When the device fires inbound, this records the event then
     * fans out to all consumer-registered listeners.
     */
    private readonly realCallback = (data: number[]): void => {
        this.captureRecord('inbound', data);
        // Defensive copy of the consumer list in case a callback mutates it.
        for (const cb of [...this.consumerListeners]) {
            cb([...data]);
        }
    };

    constructor(real: SSeriesMidiAdapter, options: RecordingProxyAdapterOptions) {
        this.real = real;
        this.clock = options.clock ?? defaultClock();
        this.scenario = createScenario({
            name: options.scenarioName,
            device: options.device,
            deviceId: options.deviceId,
            description: options.description,
            bridgeVersion: options.bridgeVersion,
        });
    }

    send(data: number[]): void {
        this.captureRecord('outbound', data);
        this.real.send(data);
    }

    onSysEx(callback: (data: number[]) => void): void {
        this.consumerListeners.push(callback);
        if (!this.realListenerAttached) {
            this.real.onSysEx(this.realCallback);
            this.realListenerAttached = true;
        }
    }

    removeSysExListener(callback: (data: number[]) => void): void {
        const idx = this.consumerListeners.indexOf(callback);
        if (idx >= 0) {
            this.consumerListeners.splice(idx, 1);
        }
        // We keep the multiplexed listener attached even when the consumer
        // list empties — the next onSysEx call would just re-attach, and
        // removing+reattaching invites bugs around in-flight inbound events.
    }

    /**
     * Attach an annotation to the NEXT captured record (outbound or inbound).
     * Useful for tagging high-level context — "RQD patch 0", "WSD chunk 3/12" —
     * for fixture readability. Only the immediately next record is annotated;
     * subsequent records remain unannotated unless `annotate()` is called again.
     */
    annotate(text: string): void {
        this.pendingAnnotation = text;
    }

    /**
     * Get the captured scenario. Returns the live reference — callers
     * generally serialise immediately rather than mutating it.
     */
    getScenario(): FixtureScenario {
        return this.scenario;
    }

    /**
     * Detach the multiplexed listener from the real adapter. Call this when
     * the recording session is complete and the proxy is being discarded
     * (so the real adapter's listener list doesn't grow unbounded across
     * recording sessions).
     */
    detach(): void {
        if (this.realListenerAttached) {
            this.real.removeSysExListener(this.realCallback);
            this.realListenerAttached = false;
        }
    }

    private captureRecord(kind: 'outbound' | 'inbound', bytes: number[]): void {
        const record: Parameters<typeof appendRecord>[1] = {
            kind,
            bytes: [...bytes],
            timestampMs: this.clock(),
        };
        if (this.pendingAnnotation !== undefined) {
            record.annotation = this.pendingAnnotation;
            this.pendingAnnotation = undefined;
        }
        appendRecord(this.scenario, record);
    }
}

function defaultClock(): ClockFn {
    const origin = readNow();
    return () => readNow() - origin;
}

function readNow(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

// Reference SCHEMA_VERSION here so unused-import lint does not strip the
// fixture-schema dependency. (We re-export through the recording barrel.)
void SCHEMA_VERSION;
