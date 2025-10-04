declare module 'easymidi' {
    import { EventEmitter } from 'events';

    export type MidiMessage = number[];

    export class Input extends EventEmitter {
        constructor(name: string, virtual?: boolean);
        on(event: 'message', listener: (msg: {_type: string, bytes: MidiMessage}) => void): this;
        on(event: 'sysex', listener: (msg: {bytes: MidiMessage}) => void): this;
        close(): void;
    }

    export class Output {
        constructor(name: string, virtual?: boolean);
        send(type: 'sysex', data: {bytes: MidiMessage}): void;
        send(type: string, data: any): void;
        close(): void;
    }

    export function getInputs(): string[];
    export function getOutputs(): string[];
}
