/**
 * Client-side configuration for MIDI connections.
 *
 * @remarks
 * Stores MIDI port names for input and output devices.
 * Used by client applications to persist MIDI port preferences.
 */
export interface ClientConfig {
    /** Name of the MIDI input port */
    midiInput: string;
    /** Name of the MIDI output port */
    midiOutput: string
}

/**
 * Creates a new client configuration with default values.
 *
 * @returns ClientConfig with empty port names
 *
 * @example
 * ```typescript
 * const config = newClientConfig();
 * config.midiInput = 'IAC Driver Bus 1';
 * config.midiOutput = 'S3000XL';
 * ```
 */
export function newClientConfig() {
    return {
        midiOutput: '',
        midiInput: '',
    } as ClientConfig
}
