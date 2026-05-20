import { describe, it, expect } from 'vitest';
import {
    createScenario,
    appendRecord,
    serializeFixture,
    parseFixture,
    type FixtureScenario,
    type FixtureRecord,
    SCHEMA_VERSION,
} from '@/recording/fixture-schema.js';

describe('fixture-schema', () => {
    describe('createScenario', () => {
        it('creates an empty scenario with required fields', () => {
            const scenario = createScenario({
                name: 's550-load-empty',
                device: 's550',
                deviceId: 0,
            });

            expect(scenario.schemaVersion).toBe(SCHEMA_VERSION);
            expect(scenario.name).toBe('s550-load-empty');
            expect(scenario.device).toBe('s550');
            expect(scenario.deviceId).toBe(0);
            expect(scenario.records).toEqual([]);
            expect(scenario.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('accepts optional description and bridgeVersion', () => {
            const scenario = createScenario({
                name: 's330-load',
                device: 's330',
                deviceId: 5,
                description: 'Read all 64 patches and 32 tones',
                bridgeVersion: '1.2.3',
            });

            expect(scenario.description).toBe('Read all 64 patches and 32 tones');
            expect(scenario.bridgeVersion).toBe('1.2.3');
        });
    });

    describe('appendRecord', () => {
        it('assigns sequence numbers monotonically', () => {
            const scenario = createScenario({ name: 'seq-test', device: 's550', deviceId: 0 });

            appendRecord(scenario, {
                kind: 'outbound',
                bytes: [0xf0, 0x41, 0x00, 0x1e, 0x11, 0xf7],
                timestampMs: 0,
            });
            appendRecord(scenario, {
                kind: 'inbound',
                bytes: [0xf0, 0x41, 0x00, 0x1e, 0x12, 0xf7],
                timestampMs: 50,
            });

            expect(scenario.records).toHaveLength(2);
            expect(scenario.records[0].sequence).toBe(0);
            expect(scenario.records[1].sequence).toBe(1);
        });

        it('preserves all record fields', () => {
            const scenario = createScenario({ name: 'preserve', device: 's550', deviceId: 0 });

            appendRecord(scenario, {
                kind: 'outbound',
                bytes: [0xf0, 0xf7],
                timestampMs: 100,
                annotation: 'RQD patch 0',
            });

            expect(scenario.records[0]).toEqual({
                sequence: 0,
                kind: 'outbound',
                bytes: [0xf0, 0xf7],
                timestampMs: 100,
                annotation: 'RQD patch 0',
            });
        });
    });

    describe('NDJSON round-trip', () => {
        it('serializes and parses a scenario byte-for-byte equal', () => {
            const original = createScenario({
                name: 's550-roundtrip',
                device: 's550',
                deviceId: 3,
                description: 'unit-test fixture',
                bridgeVersion: '0.1.0',
            });
            // Pin capturedAt for deterministic comparison
            original.capturedAt = '2026-05-09T12:00:00.000Z';

            appendRecord(original, {
                kind: 'outbound',
                bytes: [0xf0, 0x41, 0x03, 0x1e, 0x11, 0x00, 0x00, 0x00, 0x00, 0x40, 0xf7],
                timestampMs: 0,
                annotation: 'request system params',
            });
            appendRecord(original, {
                kind: 'inbound',
                bytes: [0xf0, 0x41, 0x03, 0x1e, 0x12, 0x00, 0x00, 0x00, 0x00, /* data */ 0x42, 0xf7],
                timestampMs: 47,
            });
            appendRecord(original, {
                kind: 'outbound',
                bytes: [0xf0, 0x41, 0x03, 0x1e, 0x11, 0x01, 0x00, 0x00, 0x00, 0x00, 0xf7],
                timestampMs: 100,
            });

            const serialized = serializeFixture(original);
            const parsed = parseFixture(serialized);

            expect(parsed).toEqual(original);
        });

        it('emits one JSON object per line (NDJSON)', () => {
            const scenario = createScenario({ name: 'ndjson', device: 's550', deviceId: 0 });
            scenario.capturedAt = '2026-05-09T00:00:00.000Z';
            appendRecord(scenario, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 0 });
            appendRecord(scenario, { kind: 'inbound', bytes: [0xf0, 0xf7], timestampMs: 1 });

            const lines = serializeFixture(scenario).split('\n').filter((l) => l.length > 0);

            // Expect 1 header line + N record lines
            expect(lines).toHaveLength(3);
            const header = JSON.parse(lines[0]);
            expect(header.schemaVersion).toBe(SCHEMA_VERSION);
            expect(header.records).toBeUndefined(); // records live on subsequent lines
            const r0 = JSON.parse(lines[1]);
            expect(r0.kind).toBe('outbound');
            const r1 = JSON.parse(lines[2]);
            expect(r1.kind).toBe('inbound');
        });

        it('rejects fixtures with mismatched schemaVersion', () => {
            const scenario = createScenario({ name: 'v', device: 's550', deviceId: 0 });
            const serialized = serializeFixture(scenario);
            const tampered = serialized.replace(`"schemaVersion":${SCHEMA_VERSION}`, '"schemaVersion":99');

            expect(() => parseFixture(tampered)).toThrow(/schemaVersion/);
        });

        it('rejects fixtures with malformed JSON lines', () => {
            const scenario = createScenario({ name: 'bad', device: 's550', deviceId: 0 });
            appendRecord(scenario, { kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 0 });
            const serialized = serializeFixture(scenario);
            const tampered = serialized + '\n{not valid json';

            expect(() => parseFixture(tampered)).toThrow();
        });
    });

    describe('schema invariants', () => {
        it('records preserve byte ordering across round-trip', () => {
            const scenario = createScenario({ name: 'order', device: 's330', deviceId: 0 });
            scenario.capturedAt = '2026-05-09T00:00:00.000Z';

            // Build a 100-record sequence with ordered timestamps
            for (let i = 0; i < 100; i++) {
                appendRecord(scenario, {
                    kind: i % 2 === 0 ? 'outbound' : 'inbound',
                    bytes: [0xf0, i & 0x7f, 0xf7],
                    timestampMs: i * 10,
                });
            }

            const parsed = parseFixture(serializeFixture(scenario));
            expect(parsed.records).toHaveLength(100);
            for (let i = 0; i < 100; i++) {
                expect(parsed.records[i].sequence).toBe(i);
                expect(parsed.records[i].timestampMs).toBe(i * 10);
                expect(parsed.records[i].bytes[1]).toBe(i & 0x7f);
            }
        });

        it('parser rejects records with sequence gaps', () => {
            // Build NDJSON manually to bypass serialiser validation —
            // the parser must independently catch sequence corruption.
            const header = JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                name: 'gaps',
                device: 's550',
                deviceId: 0,
                capturedAt: '2026-05-09T00:00:00.000Z',
            });
            const r0 = JSON.stringify({ sequence: 0, kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 0 });
            const r2 = JSON.stringify({ sequence: 2, kind: 'outbound', bytes: [0xf0, 0xf7], timestampMs: 10 });
            const tampered = `${header}\n${r0}\n${r2}\n`;

            expect(() => parseFixture(tampered)).toThrow(/sequence/);
        });

        it('parser rejects records where sysex bytes are out of [0,255]', () => {
            const header = JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                name: 'oob',
                device: 's550',
                deviceId: 0,
                capturedAt: '2026-05-09T00:00:00.000Z',
            });
            const bad = JSON.stringify({ sequence: 0, kind: 'outbound', bytes: [0xf0, 256, 0xf7], timestampMs: 0 });
            const tampered = `${header}\n${bad}\n`;

            expect(() => parseFixture(tampered)).toThrow(/byte/);
        });

        it('serializer also rejects invalid scenarios at write time (defense in depth)', () => {
            const bad = createScenario({ name: 'bad', device: 's550', deviceId: 0 });
            bad.records.push({
                sequence: 5, // wrong — should be 0 if appended freshly
                kind: 'outbound',
                bytes: [0xf0, 0xf7],
                timestampMs: 0,
            } as FixtureRecord);

            expect(() => serializeFixture(bad)).toThrow(/sequence/);
        });
    });
});
