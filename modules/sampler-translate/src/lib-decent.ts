import * as htmlparser2 from "htmlparser2";
import { parseNote } from "@audiocontrol/sampler-lib";

/**
 * DecentSampler format utilities
 * @public
 */
export namespace decent {
    /**
     * Sample definition in DecentSampler format
     * @public
     */
    export interface Sample {
        /** Volume level */
        volume: string
        /** Sustain level (0-1) */
        sustain: number
        /** Sample start point */
        start: number
        /** MIDI root note (0-127) */
        rootNote: number
        /** Release curve shape */
        releaseCurve: number
        /** Release time */
        release: number
        /** Pitch tracking per key (typically 1.0 for normal tracking) */
        pitchKeyTrack: number
        /** Pan position (-1 to 1, 0 = center) */
        pan: number
        /** Low velocity threshold (0-127) */
        loVel: number
        /** Low MIDI note (0-127) */
        loNote: number
        /** High velocity threshold (0-127) */
        hiVel: number
        /** High MIDI note (0-127) */
        hiNote: number
        /** Sample end point */
        end: number
        /** Decay curve shape */
        decayCurve: number
        /** Decay time */
        decay: number
        /** Attack curve shape */
        attackCurve: number
        /** Attack time */
        attack: number
        /** Relative path to audio file */
        path: string
    }

    /**
     * Group of samples in DecentSampler format
     * @public
     */
    export interface Group {
        /** Group name */
        name: string
        /** Array of samples in this group */
        samples: Sample[]
    }

    /**
     * DecentSampler program containing multiple groups
     * @public
     */
    export interface Program {
        /** Array of sample groups */
        groups: Group[];
    }

    /**
     * Parse a DecentSampler XML file from buffer.
     *
     * Parses the XML structure to extract program, groups, and sample definitions
     * with full ADSR envelope, velocity, and note range information.
     *
     * @param buf - Buffer containing DecentSampler XML file
     * @returns Promise resolving to Program with all groups and samples
     * @public
     *
     * @example
     * ```typescript
     * import fs from "fs/promises";
     * import { decent } from "@/lib-decent.js";
     *
     * const xmlBuffer = await fs.readFile("piano.dspreset");
     * const program = await decent.newProgramFromBuffer(xmlBuffer);
     *
     * console.log(`Program has ${program.groups.length} groups`);
     * for (const group of program.groups) {
     *   console.log(`Group "${group.name}" has ${group.samples.length} samples`);
     * }
     * ```
     *
     * @remarks
     * - Parses standard DecentSampler XML format
     * - Extracts ADSR envelope parameters (attack, decay, sustain, release)
     * - Parses velocity ranges (loVel, hiVel)
     * - Parses note ranges (loNote, hiNote) supporting note names like "C4"
     * - If rootNote is missing, uses loNote or hiNote as fallback
     * - Numeric attributes use NaN for missing/invalid values
     * - Groups without explicit names are numbered sequentially
     */
    export async function newProgramFromBuffer(buf: Buffer): Promise<Program> {
        const program: Program = {
            groups: []
        }
        let group: Group
        let inGroups = false
        let inGroup = false
        let inSample = false
        const parser = new htmlparser2.Parser({
            onopentag(name: string, attribs: { [p: string]: string }, isImplied: boolean) {
                switch (name) {
                    case 'groups':
                        inGroups = true
                        break
                    case 'group':
                        inGroup = true
                        group = {samples: [], name: attribs.name ? attribs.name: "" + program.groups.length + 1} as Group
                        program.groups.push(group)
                        break
                    case 'sample':
                        inSample = true
                        const sample = {} as Sample
                        group.samples.push(sample)
                        sample.path = attribs.path
                        sample.attack = attribs.attack ? Number.parseFloat(attribs.attack) : NaN
                        sample.attackCurve = attribs.attackcurve ? Number.parseFloat(attribs.attackcurve) : NaN
                        sample.decay = attribs.decay ? Number.parseFloat(attribs.decay) : NaN
                        sample.decayCurve = attribs.decaycurve ? Number.parseFloat(attribs.decaycurve) : NaN
                        sample.end = attribs.end ? Number.parseFloat(attribs.end) : NaN
                        sample.hiNote = attribs.hinote ? parseNote(attribs.hinote) : NaN
                        sample.hiVel = attribs.hivel ? Number.parseInt(attribs.hivel) : NaN
                        sample.loNote = attribs.lonote ? parseNote(attribs.lonote) : NaN
                        sample.loVel = attribs.lovel ? Number.parseInt(attribs.lovel) : NaN
                        sample.pan = attribs.pan ? Number.parseFloat(attribs.pan) : NaN
                        sample.pitchKeyTrack = attribs.pitchkeytrack ? Number.parseFloat(attribs.pitchkeytrack) : NaN
                        sample.release = attribs.release ? Number.parseFloat(attribs.release) : NaN
                        sample.releaseCurve = attribs.releasecurve ? Number.parseFloat(attribs.releasecurve) : NaN
                        sample.rootNote = attribs.rootnote ? parseNote(attribs.rootnote) : NaN
                        sample.start = attribs.start ? Number.parseFloat(attribs.start) : NaN
                        sample.sustain = attribs.sustain ? Number.parseFloat(attribs.sustain) : NaN
                        sample.volume = attribs.volume
                        if (Number.isNaN(sample.rootNote)) {
                            if (!Number.isNaN(sample.loNote)) {
                                sample.rootNote = sample.loNote
                            } else if (!Number.isNaN(sample.hiNote)) {
                                sample.rootNote = sample.hiNote
                            }
                        }
                        break
                    default:
                        break
                }
            },
            onclosetag(name: string, isImplied: boolean) {
                switch (name) {
                    case 'groups':
                        inGroups = false
                        break
                    case 'group':
                        inGroup = false
                        break
                    case 'sample':
                        inSample = false
                        break
                    default:
                        break
                }
            },
            ontext(data: string) {
            }
        })
        parser.write(buf.toString())
        return program
    }
}
