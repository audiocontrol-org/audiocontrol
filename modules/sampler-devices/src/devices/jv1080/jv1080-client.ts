import {
    JV_1080_DEFAULT_DEVICE_ID,
    JV_1080_FX_PARAM_COUNT,
    JV_1080_SYSTEM_OFFSETS,
    JV_1080_TEMP_PATCH_OFFSETS,
    buildSystemAddress,
    buildTempPatchAddress,
} from "./jv1080-addresses.js";
import { buildDt1WriteMessage, parseJv1080Dt1ParameterEvent } from "./jv1080-messages.js";
import { Jv1080Event } from "./jv1080-types.js";
import type {
    Jv1080Address,
    Jv1080ClientOptions,
    Jv1080FxParamEvent,
    Jv1080MidiAdapter,
} from "./jv1080-types.js";

type FxTypeListener = (value: number) => void;
type FxParamListener = (event: Jv1080FxParamEvent) => void;

/**
 * Typed JV-1080 MIDI client extracted from archived implementation.
 */
export class Jv1080Client {
    private readonly midi: Jv1080MidiAdapter;
    private readonly deviceId: number;
    private connected = false;
    private readonly fxParams = new Array<number>(JV_1080_FX_PARAM_COUNT).fill(0);

    private readonly fxTypeListeners = new Set<FxTypeListener>();
    private readonly fxParamListeners = new Set<FxParamListener>();

    private readonly onSysEx = (data: number[]): void => {
        const event = parseJv1080Dt1ParameterEvent(data);
        if (!event || event.deviceId !== this.deviceId) {
            return;
        }

        const fxTypeAddress = buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE);
        if (addressesEqual(event.address, fxTypeAddress)) {
            this.fxTypeListeners.forEach((listener) => listener(event.value));
            return;
        }

        const fxParamBaseAddress = buildTempPatchAddress(JV_1080_TEMP_PATCH_OFFSETS.FX_PARAM_1);
        const fxParamIndex = parseFxParamIndex(event.address, fxParamBaseAddress, JV_1080_FX_PARAM_COUNT);
        if (fxParamIndex >= 0) {
            this.fxParams[fxParamIndex] = event.value;
            const payload = { index: fxParamIndex, value: event.value };
            this.fxParamListeners.forEach((listener) => listener(payload));
        }
    };

    constructor(midi: Jv1080MidiAdapter, options: Jv1080ClientOptions = {}) {
        this.midi = midi;
        this.deviceId = options.deviceId ?? JV_1080_DEFAULT_DEVICE_ID;
    }

    connect(): void {
        if (this.connected) {
            return;
        }
        this.midi.onSysEx(this.onSysEx);
        this.connected = true;
    }

    disconnect(): void {
        if (!this.connected) {
            return;
        }
        this.midi.removeSysExListener(this.onSysEx);
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    getDeviceId(): number {
        return this.deviceId;
    }

    getFxParameter(parameterIndex: number): number | undefined {
        return this.fxParams[parameterIndex];
    }

    subscribe(event: Jv1080Event.FxType, listener: FxTypeListener): () => void;
    subscribe(event: Jv1080Event.FxParam, listener: FxParamListener): () => void;
    subscribe(event: Jv1080Event, listener: FxTypeListener | FxParamListener): () => void {
        if (event === Jv1080Event.FxType) {
            const typedListener = listener as FxTypeListener;
            this.fxTypeListeners.add(typedListener);
            return () => this.fxTypeListeners.delete(typedListener);
        }

        const typedListener = listener as FxParamListener;
        this.fxParamListeners.add(typedListener);
        return () => this.fxParamListeners.delete(typedListener);
    }

    panelModePerformance(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PANEL_MODE, 0x00);
    }

    panelModePatch(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PANEL_MODE, 0x01);
    }

    panelModeGm(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PANEL_MODE, 0x02);
    }

    setPerformanceNumber(value: number): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PERFORMANCE_NUMBER, value);
    }

    patchGroupUser(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PATCH_GROUP, 0x00);
    }

    patchGroupPcm(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PATCH_GROUP, 0x01);
    }

    setPatchGroupId(value: number): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PATCH_GROUP_ID, value);
    }

    setPatchNumber(value: number): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PATCH_NUMBER, value);
    }

    setInsertFx(enabled: boolean): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.INSERT_FX_SWITCH, enabled ? 1 : 0);
    }

    setChorusFx(enabled: boolean): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.CHORUS_FX_SWITCH, enabled ? 1 : 0);
    }

    setReverbFx(enabled: boolean): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.REVERB_FX_SWITCH, enabled ? 1 : 0);
    }

    setPatchRemain(enabled: boolean): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.PATCH_REMAIN, enabled ? 1 : 0);
    }

    setClockInternal(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.CLOCK_SOURCE, 0x00);
    }

    setClockMidi(): void {
        this.writeSystemParameter(JV_1080_SYSTEM_OFFSETS.CLOCK_SOURCE, 0x01);
    }

    setPatchName(name: string): void {
        const padded = name.padEnd(12, " ");
        for (let i = 0; i < 12; i += 1) {
            const offset = [...JV_1080_TEMP_PATCH_OFFSETS.PATCH_NAME] as Jv1080Address;
            offset[3] += i;
            this.writeTempPatchParameter(offset, padded.charCodeAt(i) & 0x7f);
        }
    }

    setFx(value: number): void {
        this.writeTempPatchParameter(JV_1080_TEMP_PATCH_OFFSETS.FX_TYPE, value);
    }

    setFxParam(index: number, value: number): void {
        if (index < 0 || index >= JV_1080_FX_PARAM_COUNT) {
            throw new Error(`FX parameter index out of range: ${index}`);
        }
        const offset = [...JV_1080_TEMP_PATCH_OFFSETS.FX_PARAM_1] as Jv1080Address;
        offset[3] += index;
        this.writeTempPatchParameter(offset, value);
    }

    private writeSystemParameter(offset: Jv1080Address, value: number): void {
        const address = buildSystemAddress(offset);
        this.writeParameter(address, value);
    }

    private writeTempPatchParameter(offset: Jv1080Address, value: number): void {
        const address = buildTempPatchAddress(offset);
        this.writeParameter(address, value);
    }

    private writeParameter(address: Jv1080Address, value: number): void {
        const message = buildDt1WriteMessage(this.deviceId, address, value);
        this.midi.send(message);
    }
}

function addressesEqual(a: Jv1080Address, b: Jv1080Address): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function parseFxParamIndex(address: Jv1080Address, base: Jv1080Address, count: number): number {
    if (address[0] !== base[0] || address[1] !== base[1] || address[2] !== base[2]) {
        return -1;
    }
    const index = address[3] - base[3];
    if (index < 0 || index >= count) {
        return -1;
    }
    return index;
}
