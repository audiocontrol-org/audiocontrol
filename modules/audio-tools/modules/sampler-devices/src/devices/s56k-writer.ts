import type { S56kParserState } from '@/devices/s56k-parser.js';

/**
 * Write S5000/S6000 program to buffer
 */
export function writeProgram(buf: Buffer, state: S56kParserState, offset: number = 0): number {
    offset += state.header.write(buf, offset);
    offset += state.program.write(buf, offset);
    offset += state.output.write(buf, offset);
    offset += state.tune.write(buf, offset);
    offset += state.lfo1.write(buf, offset);
    offset += state.lfo2.write(buf, offset);
    offset += state.mods.write(buf, offset);

    for (let i = 0; i < state.keygroups.length; i++) {
        const keygroup = state.keygroups[i];
        offset += keygroup.write(buf, offset);
    }

    return offset;
}
