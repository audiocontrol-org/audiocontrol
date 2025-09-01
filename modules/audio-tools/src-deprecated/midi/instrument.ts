import {Midi} from "./midi";
import {Output} from "webmidi";

export interface MidiInstrument {
    noteOn(note: number, velocity: number)
    noteOff(note: number, velocity: number)
}

class BasicMidiInstrument implements MidiInstrument {
    private readonly midi: Midi;
    private output: Output;
    private readonly channel: number;

    constructor(midi: Midi, channel: number) {
        this.midi = midi
        midi.getCurrentOutput().then((output) => this.output = output)
        this.channel = channel
    }

    async noteOff(note: number, velocity: number) {

    }

    noteOn(note: number, velocity: number) {
        this.output.sendNoteOn(note, {channels: this.channel, rawAttack: velocity})
    }

}

export function newMidiInstrument(midi: Midi, channel: number): MidiInstrument {
    return new BasicMidiInstrument(midi, channel)
}