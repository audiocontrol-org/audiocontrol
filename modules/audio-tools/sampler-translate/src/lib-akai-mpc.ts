import * as htmlparser2 from "htmlparser2"
import * as riffFile from "riff-file";

/**
 * Akai MPC format utilities for parsing programs and sample slice data
 * @public
 */
export namespace mpc {

    /**
     * Sample slice definition from MPC slice data
     * @public
     */
    export interface Slice {
        /** Slice name/identifier */
        name: string
        /** Start position in samples */
        start: number
        /** End position in samples */
        end: number
        /** Loop start position in samples */
        loopStart: number
    }

    /**
     * Sample slice data embedded in WAV file 'atem' chunk
     * @public
     */
    export interface SampleSliceData {
        /** Format version number */
        version: number
        /** Musical note */
        note: string
        /** Musical scale */
        scale: string
        /** Array of slice definitions */
        slices: Slice[]
        /** Number of bars */
        barCount: number
    }

    /**
     * Extract sample slice data from MPC-format WAV file.
     *
     * MPC software can embed slice information in a custom 'atem' RIFF chunk
     * within WAV files. This function extracts that metadata.
     *
     * @param buf - Buffer containing WAV file data
     * @returns SampleSliceData with all slice points
     * @public
     *
     * @example
     * ```typescript
     * import fs from "fs/promises";
     * import { mpc } from "@/lib-akai-mpc.js";
     *
     * const wavBuffer = await fs.readFile("drumloop.wav");
     * const sliceData = mpc.newSampleSliceDataFromBuffer(wavBuffer);
     *
     * console.log(`Found ${sliceData.slices.length} slices`);
     * for (const slice of sliceData.slices) {
     *   console.log(`${slice.name}: ${slice.start} - ${slice.end}`);
     * }
     * ```
     *
     * @remarks
     * - Looks for 'atem' RIFF chunk in WAV file
     * - Parses JSON data from chunk containing slice information
     * - Each slice has start/end sample positions
     * - Returns empty slices array if no 'atem' chunk found
     * - Slice positions are in sample frames
     */
    export function newSampleSliceDataFromBuffer(buf: Buffer): SampleSliceData {
        const rv: SampleSliceData = {
            version: -1,
            note: "",
            scale: "",
            barCount: -1,
            slices: []
        }
        const riff = new riffFile.RIFFFile()
        riff.setSignature(buf)
        const chunk: any = riff.findChunk('atem')
        if (chunk && chunk.chunkData) {
            let d: string = buf.subarray(chunk.chunkData.start, chunk.chunkData.end).toString()

            const o = JSON.parse(d)
            const value0 = o['value0']
            for (const name of Object.getOwnPropertyNames(value0)) {
                if (name.startsWith('Slice')) {
                    const s = value0[name]
                    const slice: Slice = {
                        name: name,
                        start: s['Start'],
                        end: s['End'],
                        loopStart: 0
                    }
                    rv.slices.push(slice)
                }
            }
        }
        return rv
    }

    /**
     * Parse MPC program XML file from buffer.
     *
     * MPC programs are stored in XML format containing layers (samples),
     * slice information, and program settings.
     *
     * @param buf - Buffer containing MPC program XML file
     * @returns MpcProgram with all layers and settings
     * @public
     *
     * @example
     * ```typescript
     * import fs from "fs/promises";
     * import { mpc } from "@/lib-akai-mpc.js";
     *
     * const xmlBuffer = await fs.readFile("drumkit.xpm");
     * const program = mpc.newProgramFromBuffer(xmlBuffer);
     *
     * console.log(`Program: ${program.programName}`);
     * console.log(`Layers: ${program.layers.length}`);
     * for (const layer of program.layers) {
     *   console.log(`Layer ${layer.number}: ${layer.sampleName}`);
     * }
     * ```
     *
     * @remarks
     * - Parses standard MPC XML program format
     * - Extracts program name and layer information
     * - Each layer references a sample and has slice points
     * - Only layers with sample names are included in result
     * - Slice start/end positions are in sample frames
     */
    export function newProgramFromBuffer(buf: Buffer): MpcProgram {
        const layers: Layer[] = []
        const program: MpcProgram = {
            programName: "",
            layers: layers
        }
        let inProgramName = false
        let inLayer = false
        let layer: Partial<Layer> = {}
        let inSampleName = false
        let inSliceStart = false
        let inSliceEnd = false
        const parser = new htmlparser2.Parser({
            onopentag(name: string, attribs: { [p: string]: string }, isImplied: boolean) {
                switch (name) {
                    case "programname":
                        inProgramName = true
                        break
                    case "instrument" :
                        break
                    case "layer":
                        inLayer = true
                        layer.number = Number.parseInt(attribs['number'])
                        break
                    case "samplename":
                        inSampleName = true
                        break
                    case "slicestart":
                        inSliceStart = true
                        break
                    case "sliceend":
                        inSliceEnd = true
                        break
                    default:
                        break
                }

            },
            ontext(data: string) {
                if (inProgramName) {
                    program.programName = data
                } else if (inSampleName) {
                    layer.sampleName = data
                    // this layer has a sample name, so we care about it
                    layers.push(layer as Layer)
                } else if (inSliceStart) {
                    layer.sliceStart = Number.parseInt(data)
                } else if (inSliceEnd) {
                    layer.sliceEnd = Number.parseInt(data)
                }
            },
            onclosetag(name: string, isImplied: boolean) {
                switch (name) {
                    case "programname":
                        inProgramName = false
                        break
                    case "layer":
                        inLayer = false
                        layer = {}
                        break
                    case "samplename":
                        inSampleName = false
                        break
                    case "slicestart":
                        inSliceStart = false
                        break
                    case "sliceend":
                        inSliceEnd = false
                        break
                    default:
                        break
                }
            }
        })
        parser.write(buf.toString())
        return program
    }

    /**
     * Layer definition in MPC program
     * @public
     */
    export interface Layer {
        /** Layer number (1-based) */
        number: number
        /** Sample file name (without extension) */
        sampleName: string
        /** Slice start position in samples */
        sliceStart: number
        /** Slice end position in samples */
        sliceEnd: number
    }

    /**
     * MPC program containing multiple layers
     * @public
     */
    export interface MpcProgram {
        /** Program name */
        programName: string
        /** Array of layers with sample assignments */
        layers: Layer[]
    }
}
