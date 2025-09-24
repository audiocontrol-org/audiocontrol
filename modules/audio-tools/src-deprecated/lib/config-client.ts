
export interface ClientConfig {
    midiInput: string;
    midiOutput: string
}

export function newClientConfig() {
    return {
        midiOutput: '',
        midiInput: '',
    } as ClientConfig
}
