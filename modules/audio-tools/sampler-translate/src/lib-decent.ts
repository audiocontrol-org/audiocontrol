import * as htmlparser2 from "htmlparser2";
import { parseNote } from "@oletizi/sampler-lib";

export namespace decent {
    export interface Sample {
        volume: string
        sustain: number
        start: number
        rootNote: number
        releaseCurve: number
        release: number
        pitchKeyTrack: number
        pan: number
        loVel: number
        loNote: number
        hiVel: number
        hiNote: number
        end: number
        decayCurve: number
        decay: number
        attackCurve: number
        attack: number
        path: string
    }

    export interface Group {
        name: string
        samples: Sample[]
    }

    export interface Program {
        groups: Group[];
    }

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
