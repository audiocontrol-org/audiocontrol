import { describe, expect, it } from 'vitest';
import {
    Jv1080Client,
    Jv1080Event,
    JV_1080_BASE_SYSTEM,
    JV_1080_BASE_TEMP_PATCH,
    JV_1080_COMMANDS,
    JV_1080_DEFAULT_DEVICE_ID,
    JV_1080_SYSTEM_OFFSETS,
    JV_1080_TEMP_PATCH_OFFSETS,
    ROLAND_MANUFACTURER_ID,
    addAddress,
    buildDt1WriteMessage,
    buildJv1080SysexMessage,
    buildRq1RequestMessage,
    buildSystemAddress,
    buildTempPatchAddress,
    calculateRolandChecksum,
    parseJv1080Dt1ParameterEvent,
    parseJv1080SysexMessage,
    type Jv1080MidiAdapter,
} from '@/devices/jv1080/index.js';

class MockJv1080MidiAdapter implements Jv1080MidiAdapter {
    public sent: number[][] = [];
    private callback: ((data: number[]) => void) | null = null;

    send(data: number[]): void {
        this.sent.push(data);
    }

    onSysEx(callback: (data: number[]) => void): void {
        this.callback = callback;
    }

    removeSysExListener(callback: (data: number[]) => void): void {
        if (this.callback === callback) {
            this.callback = null;
        }
    }

    emit(data: number[]): void {
        this.callback?.(data);
    }
}

describe('JV-1080 message helpers', () => {
    it('calculates Roland checksum for payload bytes', () => {
        expect(calculateRolandChecksum([0x03, 0x00, 0x00, 0x0c, 0x09])).toBe(0x68);
    });

    it('builds a complete SysEx frame', () => {
        const payload = [0x03, 0x00, 0x00, 0x0c, 0x09];
        const message = buildJv1080SysexMessage(JV_1080_DEFAULT_DEVICE_ID, JV_1080_COMMANDS.DT1, payload);

        expect(message[0]).toBe(0xf0);
        expect(message[1]).toBe(ROLAND_MANUFACTURER_ID);
        expect(message[2]).toBe(JV_1080_DEFAULT_DEVICE_ID);
        expect(message[3]).toBe(0x6a);
        expect(message[4]).toBe(JV_1080_COMMANDS.DT1);
        expect(message.slice(5, 10)).toEqual(payload);
        expect(message.at(-2)).toBe(calculateRolandChecksum(payload));
        expect(message.at(-1)).toBe(0xf7);
    });

    it('builds DT1 and RQ1 messages with expected command bytes', () => {
        const address = buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE);
        const dt1 = buildDt1WriteMessage(JV_1080_DEFAULT_DEVICE_ID, address, 0x22);
        const rq1 = buildRq1RequestMessage(JV_1080_DEFAULT_DEVICE_ID, [0x00, 0x00, 0x00, 0x00, 0x00]);

        expect(dt1[4]).toBe(JV_1080_COMMANDS.DT1);
        expect(dt1.slice(5, 10)).toEqual([0x03, 0x00, 0x00, 0x0c, 0x22]);
        expect(rq1[4]).toBe(JV_1080_COMMANDS.RQ1);
    });

    it('parses a valid JV-1080 SysEx message', () => {
        const payload = [0x03, 0x00, 0x00, 0x0c, 0x09];
        const message = buildJv1080SysexMessage(JV_1080_DEFAULT_DEVICE_ID, JV_1080_COMMANDS.DT1, payload);
        const parsed = parseJv1080SysexMessage(message);

        expect(parsed).not.toBeNull();
        expect(parsed?.deviceId).toBe(JV_1080_DEFAULT_DEVICE_ID);
        expect(parsed?.command).toBe(JV_1080_COMMANDS.DT1);
        expect(parsed?.payload).toEqual(payload);
    });

    it('rejects invalid SysEx frames', () => {
        expect(parseJv1080SysexMessage([])).toBeNull();
        expect(parseJv1080SysexMessage([0xf0, 0x7e, 0x10, 0x6a, 0x12, 0x00, 0x00, 0xf7])).toBeNull();
        expect(parseJv1080SysexMessage([0x00, 0x41, 0x10, 0x6a, 0x12, 0x00, 0x00, 0xf7])).toBeNull();
    });

    it('parses DT1 address/value events', () => {
        const address = buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_PARAM_1);
        const message = buildDt1WriteMessage(JV_1080_DEFAULT_DEVICE_ID, address, 0x45);
        const event = parseJv1080Dt1ParameterEvent(message);

        expect(event).not.toBeNull();
        expect(event?.address).toEqual(address);
        expect(event?.value).toBe(0x45);
    });

    it('returns null for non-DT1 or short DT1 payloads', () => {
        const rq1 = buildRq1RequestMessage(JV_1080_DEFAULT_DEVICE_ID, [0x00, 0x00, 0x00, 0x00]);
        const shortDt1 = buildJv1080SysexMessage(JV_1080_DEFAULT_DEVICE_ID, JV_1080_COMMANDS.DT1, [0x03, 0x00, 0x00, 0x0d]);

        expect(parseJv1080Dt1ParameterEvent(rq1)).toBeNull();
        expect(parseJv1080Dt1ParameterEvent(shortDt1)).toBeNull();
    });
});

describe('JV-1080 address helpers', () => {
    it('adds 4-byte addresses', () => {
        expect(addAddress([0x03, 0x00, 0x00, 0x00], [0x00, 0x00, 0x00, 0x0c])).toEqual([0x03, 0x00, 0x00, 0x0c]);
    });

    it('builds system and temp patch addresses from their bases', () => {
        const systemAddress = buildSystemAddress(JV_1080_SYSTEM_OFFSETS.CLOCK_SOURCE);
        const tempPatchAddress = buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE);

        expect(systemAddress).toEqual(addAddress(JV_1080_BASE_SYSTEM, JV_1080_SYSTEM_OFFSETS.CLOCK_SOURCE));
        expect(tempPatchAddress).toEqual(addAddress(JV_1080_BASE_TEMP_PATCH, JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE));
    });
});

describe('Jv1080Client', () => {
    it('writes expected system and temp patch DT1 messages', () => {
        const midi = new MockJv1080MidiAdapter();
        const client = new Jv1080Client(midi);

        client.panelModePatch();
        client.setClockMidi();
        client.setFx(7);
        client.setFxParam(2, 99);

        expect(midi.sent).toHaveLength(4);
        expect(midi.sent[0]).toEqual(
            buildDt1WriteMessage(JV_1080_DEFAULT_DEVICE_ID, buildSystemAddress(JV_1080_SYSTEM_OFFSETS.PANEL_MODE), 1),
        );
        expect(midi.sent[1]).toEqual(
            buildDt1WriteMessage(JV_1080_DEFAULT_DEVICE_ID, buildSystemAddress(JV_1080_SYSTEM_OFFSETS.CLOCK_SOURCE), 1),
        );
        expect(midi.sent[2]).toEqual(
            buildDt1WriteMessage(JV_1080_DEFAULT_DEVICE_ID, buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE), 7),
        );
        expect(midi.sent[3]).toEqual(
            buildDt1WriteMessage(
                JV_1080_DEFAULT_DEVICE_ID,
                buildTempPatchAddress([0x00, 0x00, 0x00, JV_1080_TEMP_PATCH_OFFSETS.FX_PARAM_1[3] + 2]),
                99,
            ),
        );
    });

    it('throws for out-of-range FX parameter indices', () => {
        const client = new Jv1080Client(new MockJv1080MidiAdapter());
        expect(() => client.setFxParam(-1, 0)).toThrow('FX parameter index out of range: -1');
        expect(() => client.setFxParam(12, 0)).toThrow('FX parameter index out of range: 12');
    });

    it('subscribes to inbound FX events and filters by device id', () => {
        const midi = new MockJv1080MidiAdapter();
        const client = new Jv1080Client(midi, { deviceId: 0x22 });

        let fxTypeValue: number | null = null;
        let fxParamEvent: { index: number; value: number } | null = null;

        const unFxType = client.subscribe(Jv1080Event.FxType, (value) => {
            fxTypeValue = value;
        });
        const unFxParam = client.subscribe(Jv1080Event.FxParam, (event) => {
            fxParamEvent = event;
        });

        client.connect();

        midi.emit(buildDt1WriteMessage(0x10, buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE), 3));
        expect(fxTypeValue).toBeNull();

        midi.emit(buildDt1WriteMessage(0x22, buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE), 9));
        expect(fxTypeValue).toBe(9);

        midi.emit(buildDt1WriteMessage(0x22, buildTempPatchAddress([0x00, 0x00, 0x00, 0x0f]), 64));
        expect(fxParamEvent).toEqual({ index: 2, value: 64 });
        expect(client.getFxParameter(2)).toBe(64);

        unFxType();
        unFxParam();
        client.disconnect();

        midi.emit(buildDt1WriteMessage(0x22, buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE), 4));
        expect(fxTypeValue).toBe(9);
    });
});
