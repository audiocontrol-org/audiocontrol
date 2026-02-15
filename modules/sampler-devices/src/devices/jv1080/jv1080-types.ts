/**
 * Roland JV-1080 Type Definitions
 *
 * Typed interfaces for JV-1080 SysEx transport and parsed messages.
 *
 * @packageDocumentation
 */

/**
 * MIDI transport adapter for JV-1080 communication.
 */
export interface Jv1080MidiAdapter {
    /**
     * Send a complete SysEx message (including F0/F7).
     */
    send(data: number[]): void;

    /**
     * Register a callback for incoming SysEx messages.
     */
    onSysEx(callback: (data: number[]) => void): void;

    /**
     * Remove a previously registered callback.
     */
    removeSysExListener(callback: (data: number[]) => void): void;
}

/**
 * Known command bytes used by the JV-1080.
 */
export type Jv1080Command = 0x11 | 0x12;

/**
 * Fixed 4-byte Roland parameter address.
 */
export type Jv1080Address = [number, number, number, number];

/**
 * Parsed JV-1080 SysEx message.
 */
export interface Jv1080SysexMessage {
    deviceId: number;
    modelId: number;
    command: number;
    payload: number[];
    checksum: number;
}

/**
 * Parsed DT1 parameter/value update event.
 */
export interface Jv1080ParameterEvent {
    deviceId: number;
    address: Jv1080Address;
    value: number;
    checksum: number;
}

/**
 * High-level events exposed by the client.
 */
export enum Jv1080Event {
    FxType = "fx-type",
    FxParam = "fx-param",
}

/**
 * FX parameter update payload.
 */
export interface Jv1080FxParamEvent {
    index: number;
    value: number;
}

/**
 * Client options.
 */
export interface Jv1080ClientOptions {
    deviceId?: number;
}
