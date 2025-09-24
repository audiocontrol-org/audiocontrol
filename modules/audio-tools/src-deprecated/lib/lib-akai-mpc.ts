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
        version
        note: string
        scale: string
        slices: Slice[]
        barCount: number
    }

    export function newSampleSliceDataFromBuffer(buf) {
        const rv = {
            version: -1,
            note: "",
            scale: "",
            barCount: -1,
            slices: []
        } as SampleSliceData
        const riff = new riffFile.RIFFFile()
        riff.setSignature(buf)
        const chunk = riff.findChunk('atem')
        if (chunk) {
            let d: string = buf.subarray(chunk["chunkData"].start, chunk["chunkData"].end).toString()
            //
            // while (d.length > 0 && d.charAt(d.length - 1) !== '}') {
            //     d = d.substring(0, d.length - 2)
            // }
            // console.log(d)

            const o = JSON.parse(d)
            const value0 = o['value0']
            for (const name of Object.getOwnPropertyNames(value0)) {
                if (name.startsWith('Slice')) {
                    const s = value0[name] as Slice
                    const slice = {} as Slice
                    slice.name = name
                    slice.start = s['Start']
                    slice.end = s['End']
                    rv.slices.push(slice)
                }
            }
        }
        return rv
    }

    export function newProgramFromBuffer(buf) {
        const layers = []
        const program = {
            layers: layers
        }
        let inProgramName = false
        let inLayer = false
        let layer = {}
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
                        layer['number'] = Number.parseInt(attribs['number'])
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
                    program['programName'] = data
                } else if (inSampleName) {
                    layer['sampleName'] = data
                    // this layer has a sample name, so we care about it
                    layers.push(layer)
                } else if (inSliceStart) {
                    layer['sliceStart'] = Number.parseInt(data)
                } else if (inSliceEnd) {
                    layer['sliceEnd'] = Number.parseInt(data)
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
        return program as MpcProgram
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
