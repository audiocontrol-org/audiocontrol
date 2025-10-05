import * as htmlparser2 from "htmlparser2"
import * as riffFile from "riff-file";

export namespace mpc {

    export interface Slice {
        name: string
        start: number
        end: number
        loopStart: number
    }

    export interface SampleSliceData {
        version: number
        note: string
        scale: string
        slices: Slice[]
        barCount: number
    }

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

    export interface Layer {
        number: number
        sampleName: string
        sliceStart: number
        sliceEnd: number
    }

    export interface MpcProgram {
        programName: string
        layers: Layer[]
    }
}
