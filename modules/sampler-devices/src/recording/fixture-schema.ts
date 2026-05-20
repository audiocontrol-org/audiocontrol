/**
 * Fixture format for SSeriesMidiAdapter recording/replay.
 *
 * A fixture captures a full byte-level event log at the SSeriesMidiAdapter
 * boundary: every outbound `send(bytes)` call and every inbound `onSysEx`
 * callback firing. Replay drives a SimulatedAdapter through the recorded
 * sequence so UI tests can run without hardware.
 *
 * Storage format: NDJSON (newline-delimited JSON).
 *   - Line 1: scenario header (everything except records)
 *   - Lines 2..N: one FixtureRecord per line, in sequence order
 *
 * NDJSON keeps memory bounded for long recordings and supports streaming
 * read/write once the byte budget grows.
 *
 * @packageDocumentation
 */

export const SCHEMA_VERSION = 1 as const;

export type FixtureEventKind = 'outbound' | 'inbound';

export type FixtureDevice = 's330' | 's550';

/**
 * One byte-level event at the SSeriesMidiAdapter boundary.
 *
 * - `outbound`: produced by `adapter.send(bytes)` from UI / client code
 * - `inbound`: produced by the device, delivered to UI via `onSysEx(bytes)`
 *   callback firing
 */
export interface FixtureRecord {
    /** Monotonic ordinal within the scenario, starting at 0. */
    sequence: number;
    /** Direction of this byte-level event. */
    kind: FixtureEventKind;
    /** Raw SysEx bytes, including F0 start and F7 end framing. Each byte must be in [0, 255]. */
    bytes: number[];
    /** Wall-clock time since scenario start, in milliseconds. */
    timestampMs: number;
    /** Optional human hint (e.g., "RQD patch 0") for fixture readability. */
    annotation?: string;
}

/**
 * A captured scenario: an ordered byte-level event log plus metadata.
 */
export interface FixtureScenario {
    /** Schema version. Mismatch on parse throws. */
    schemaVersion: typeof SCHEMA_VERSION;
    /** Scenario identifier (filename-safe), e.g., "s550-load-empty". */
    name: string;
    /** Device under recording. */
    device: FixtureDevice;
    /** SysEx device ID (0-15) the recording was made against. */
    deviceId: number;
    /** ISO-8601 timestamp of capture. */
    capturedAt: string;
    /** Optional midi-server / bridge version for provenance. */
    bridgeVersion?: string;
    /** Optional free-text purpose. */
    description?: string;
    /** Ordered byte-level event log. */
    records: FixtureRecord[];
}

interface CreateScenarioOptions {
    name: string;
    device: FixtureDevice;
    deviceId: number;
    description?: string;
    bridgeVersion?: string;
}

/**
 * Construct an empty scenario with `capturedAt` set to the current time.
 */
export function createScenario(opts: CreateScenarioOptions): FixtureScenario {
    return {
        schemaVersion: SCHEMA_VERSION,
        name: opts.name,
        device: opts.device,
        deviceId: opts.deviceId,
        capturedAt: new Date().toISOString(),
        bridgeVersion: opts.bridgeVersion,
        description: opts.description,
        records: [],
    };
}

/**
 * Append a record. The caller supplies everything except `sequence`, which
 * is assigned monotonically based on existing record count.
 */
export function appendRecord(
    scenario: FixtureScenario,
    record: Omit<FixtureRecord, 'sequence'>,
): void {
    scenario.records.push({
        sequence: scenario.records.length,
        ...record,
    });
}

/**
 * Serialize a scenario to NDJSON.
 *
 * Output structure:
 *   line 0: scenario header (records field omitted)
 *   line 1..N: one record per line
 */
export function serializeFixture(scenario: FixtureScenario): string {
    validateScenario(scenario);

    // Header line — everything but `records`.
    const header = {
        schemaVersion: scenario.schemaVersion,
        name: scenario.name,
        device: scenario.device,
        deviceId: scenario.deviceId,
        capturedAt: scenario.capturedAt,
        bridgeVersion: scenario.bridgeVersion,
        description: scenario.description,
    };

    const lines: string[] = [JSON.stringify(header)];
    for (const record of scenario.records) {
        lines.push(JSON.stringify(record));
    }
    return lines.join('\n') + '\n';
}

/**
 * Parse an NDJSON-serialized fixture. Throws on schema-version mismatch,
 * malformed JSON, sequence gaps, or out-of-range byte values.
 */
export function parseFixture(content: string): FixtureScenario {
    const lines = content.split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) {
        throw new Error('parseFixture: empty fixture content');
    }

    const header = parseHeaderLine(lines[0]);

    const records: FixtureRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const record = parseRecordLine(lines[i], i);
        if (record.sequence !== records.length) {
            throw new Error(
                `parseFixture: sequence gap at line ${i + 1}: expected sequence ${records.length}, got ${record.sequence}`,
            );
        }
        records.push(record);
    }

    const scenario: FixtureScenario = {
        schemaVersion: header.schemaVersion,
        name: header.name,
        device: header.device,
        deviceId: header.deviceId,
        capturedAt: header.capturedAt,
        bridgeVersion: header.bridgeVersion,
        description: header.description,
        records,
    };

    return scenario;
}

interface FixtureHeader {
    schemaVersion: typeof SCHEMA_VERSION;
    name: string;
    device: FixtureDevice;
    deviceId: number;
    capturedAt: string;
    bridgeVersion?: string;
    description?: string;
}

function parseHeaderLine(line: string): FixtureHeader {
    let raw: unknown;
    try {
        raw = JSON.parse(line);
    } catch (err) {
        throw new Error(`parseFixture: header line is not valid JSON: ${(err as Error).message}`);
    }
    if (!isObject(raw)) {
        throw new Error('parseFixture: header is not an object');
    }
    if (raw.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(
            `parseFixture: schemaVersion mismatch — expected ${SCHEMA_VERSION}, got ${String(raw.schemaVersion)}`,
        );
    }
    if (typeof raw.name !== 'string' || raw.name.length === 0) {
        throw new Error('parseFixture: header.name must be a non-empty string');
    }
    if (raw.device !== 's330' && raw.device !== 's550') {
        throw new Error(`parseFixture: header.device must be 's330' or 's550', got ${String(raw.device)}`);
    }
    if (typeof raw.deviceId !== 'number' || raw.deviceId < 0 || raw.deviceId > 15) {
        throw new Error(`parseFixture: header.deviceId must be 0-15, got ${String(raw.deviceId)}`);
    }
    if (typeof raw.capturedAt !== 'string') {
        throw new Error('parseFixture: header.capturedAt must be a string');
    }

    return {
        schemaVersion: SCHEMA_VERSION,
        name: raw.name,
        device: raw.device,
        deviceId: raw.deviceId,
        capturedAt: raw.capturedAt,
        bridgeVersion: typeof raw.bridgeVersion === 'string' ? raw.bridgeVersion : undefined,
        description: typeof raw.description === 'string' ? raw.description : undefined,
    };
}

function parseRecordLine(line: string, lineNum: number): FixtureRecord {
    let raw: unknown;
    try {
        raw = JSON.parse(line);
    } catch (err) {
        throw new Error(`parseFixture: line ${lineNum + 1} is not valid JSON: ${(err as Error).message}`);
    }
    if (!isObject(raw)) {
        throw new Error(`parseFixture: line ${lineNum + 1} record is not an object`);
    }
    if (typeof raw.sequence !== 'number' || !Number.isInteger(raw.sequence) || raw.sequence < 0) {
        throw new Error(`parseFixture: line ${lineNum + 1} sequence must be a non-negative integer`);
    }
    if (raw.kind !== 'outbound' && raw.kind !== 'inbound') {
        throw new Error(`parseFixture: line ${lineNum + 1} kind must be 'outbound' or 'inbound'`);
    }
    if (!Array.isArray(raw.bytes)) {
        throw new Error(`parseFixture: line ${lineNum + 1} bytes must be an array`);
    }
    for (let b = 0; b < raw.bytes.length; b++) {
        const byte = raw.bytes[b];
        if (typeof byte !== 'number' || !Number.isInteger(byte) || byte < 0 || byte > 255) {
            throw new Error(
                `parseFixture: line ${lineNum + 1} byte at index ${b} out of range — expected 0-255, got ${String(byte)}`,
            );
        }
    }
    if (typeof raw.timestampMs !== 'number') {
        throw new Error(`parseFixture: line ${lineNum + 1} timestampMs must be a number`);
    }

    const record: FixtureRecord = {
        sequence: raw.sequence,
        kind: raw.kind,
        bytes: raw.bytes as number[],
        timestampMs: raw.timestampMs,
    };
    if (typeof raw.annotation === 'string') {
        record.annotation = raw.annotation;
    }
    return record;
}

function validateScenario(scenario: FixtureScenario): void {
    if (scenario.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(
            `serializeFixture: schemaVersion must be ${SCHEMA_VERSION}, got ${scenario.schemaVersion}`,
        );
    }
    for (let i = 0; i < scenario.records.length; i++) {
        const r = scenario.records[i];
        if (r.sequence !== i) {
            throw new Error(
                `serializeFixture: record at index ${i} has sequence ${r.sequence} (expected ${i})`,
            );
        }
        for (let b = 0; b < r.bytes.length; b++) {
            const byte = r.bytes[b];
            if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
                throw new Error(
                    `serializeFixture: record ${i} byte at index ${b} out of range — expected 0-255, got ${byte}`,
                );
            }
        }
    }
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
