import type {
    AkaiS56kProgram,
    Keygroup,
    Lfo1,
    Lfo2,
    Mods,
    Output,
    Tune,
    Zone
} from '@/devices/s56k-types.js';
import { createParserState, parseFromJson, parseProgram, type S56kParserState } from '@/devices/s56k-parser.js';
import { writeProgram } from '@/devices/s56k-writer.js';
import { newKeygroupChunk } from '@/devices/s56k-chunks.js';

/**
 * Basic implementation of S5000/S6000 program
 */
class BasicProgram implements AkaiS56kProgram {
    private state: S56kParserState;

    constructor() {
        this.state = createParserState();
    }

    apply(mods: any) {
        // Recursive apply function to merge modifications
        function recursiveApply(source: any, dest: any) {
            for (const field of Object.getOwnPropertyNames(dest)) {
                if (source.hasOwnProperty(field) && dest.hasOwnProperty(field) && typeof source[field] === typeof dest[field]) {
                    if (typeof source[field] === 'object') {
                        recursiveApply(source[field], dest[field]);
                    } else {
                        dest[field] = source[field];
                    }
                }
            }
        }

        // Handle keygroup count changes
        if (mods.keygroupCount != this.getKeygroupCount()) {
            if (mods.keygroupCount < this.getKeygroupCount()) {
                this.state.keygroups.length = mods.keygroupCount;
            } else {
                for (let i = 0; i < mods.keygroupCount; i++) {
                    if (i >= this.state.keygroups.length) {
                        // Add a new keygroup by copying from original buffer
                        const keygroup = newKeygroupChunk();
                        this.state.keygroups.push(keygroup);
                        if (this.state.originalBuffer && this.state.firstKeygroupOffset !== undefined) {
                            keygroup.parse(this.state.originalBuffer, this.state.firstKeygroupOffset);
                        }
                    }
                    const modKeygroup: Keygroup = mods.keygroups[i];
                    const myKeygroup = this.state.keygroups[i];
                    for (let j = 0; j < 4; j++) {
                        const zoneName = 'zone' + (j + 1);
                        const modZone: Zone = modKeygroup[zoneName];
                        if (modZone) {
                            const myZone: Zone = myKeygroup[zoneName];
                            myZone.sampleName = modZone.sampleName;
                            myZone.sampleNameLength = myZone.sampleName.length;
                            myZone.semiToneTune = modZone.semiToneTune;
                            myZone.lowVelocity = modZone.lowVelocity;
                            myZone.highVelocity = modZone.highVelocity;
                        }
                    }
                }
            }
        }

        recursiveApply(mods, this.state);
        recursiveApply(mods, this.state.program);
    }

    parse(buf: Buffer, offset: number = 0) {
        parseProgram(buf, this.state, offset);
    }

    writeToBuffer(buf: Buffer, offset: number = 0): number {
        return writeProgram(buf, this.state, offset);
    }

    copyFromJson(json: string) {
        parseFromJson(json, this.state);
    }

    getKeygroupCount(): number {
        return this.state.program.keygroupCount;
    }

    getProgramNumber(): number {
        return this.state.program.programNumber;
    }

    getOutput(): Output {
        return this.state.output;
    }

    getTune(): Tune {
        return this.state.tune;
    }

    getLfo1(): Lfo1 {
        return this.state.lfo1;
    }

    getLfo2(): Lfo2 {
        return this.state.lfo2;
    }

    getMods(): Mods {
        return this.state.mods;
    }

    getKeygroups(): Keygroup[] {
        return Array.from(this.state.keygroups);
    }
}

/**
 * Create a new program from a binary buffer
 */
export function newProgramFromBuffer(buf: Buffer): AkaiS56kProgram {
    const program = new BasicProgram();
    program.parse(buf);
    return program;
}

/**
 * Create a new program from JSON
 */
export function newProgramFromJson(json: string): AkaiS56kProgram {
    const program = new BasicProgram();
    program.copyFromJson(json);
    return program;
}
