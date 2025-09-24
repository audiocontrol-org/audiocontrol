import {parse} from 'yaml'
import * as fs from 'fs/promises'

const DEBUG = "false"

interface Spec {
    name: string
    className: string
    headerOffset: number
    fields: {
        n: string,  // name
        f?: string,  // function name root
        l?: string, // label
        d: string,  // description
        s?: number, // size in bytes; 1 if undefined
        t?: string   // type; number if undefined
    }[]
}

const HEADER_START = 7;

export async function readSpecs(file: string) {
    return parse((await fs.readFile(file)).toString())
}

export function genImports() {
    return `//
// GENERATED ${new Date()}. DO NOT EDIT.
//    
import {byte2nibblesLE, bytes2numberLE, nibbles2byte, newClientOutput} from "@oletizi/sampler-lib"
import {Device, nextByte, akaiByte2String, string2AkaiBytes} from "@/client/client-akai-s3000xl.js"
    
`
}

export async function genInterface(spec: Spec) {
    let rv = `export interface ${spec.name} {\n`
    for (const field of spec.fields) {
        rv += `  ${field.n}: ${field.t ? field.t : 'number'}    // ${field.d}\n`
        rv += `  ${field.n}Label: string\n`
        // rv += `  set${field.n}(header: ${spec.name}, v: ${field.t ? field.t : 'number'})\n`
        rv += `\n`
    }
    rv += '  raw: number[] // Raw sysex message data\n'
    rv += '}\n'
    return rv
}

export async function genClass(spec: Spec) {
    console.log(`Generating ${spec.className}...`)
    let rv = `export class ${spec.className} {\n`

    rv += `    private readonly device: Device\n`
    rv += `    private readonly header: ${spec.name}\n`
    rv += `\n`
    rv += `    constructor(device: Device, header: ${spec.name}) {\n`
    rv += `        this.device = device\n`
    rv += `        this.header = header\n`
    rv += `    }\n`
    rv += `\n`
    rv += `    getHeader(): ${spec.name} {\n`
    rv += `        return this.header\n`
    rv += `    }\n`
    rv += `\n`
    // rv += `    copy(): ${spec.className} {\n`
    // rv += `        const h = {} as ${spec.name}\n`
    // rv += `        parse${spec.name}(this.header.raw.map(i => i), ${spec.headerOffset}, h)\n`
    // rv += `        return new ${spec.className}(this.device, h)\n`
    // rv += `    }\n`
    // rv += `\n`
    rv += '    async save() {\n'
    rv += `        return this.device.sendRaw(this.header.raw)\n`
    rv += '    }\n'
    rv += `\n`
    for (const field of spec.fields) {
        if (field.f) {
            // const parseOffset = HEADER_START
            const fu = String(field.f).charAt(0).toUpperCase() + String(field.f).slice(1)
            const type = field.t ? field.t : 'number'
            rv += `    get${fu}(): ${type} { \n`
            rv += `        return this.header.${field.n}\n`
            rv += `    }\n`
            rv += `    set${fu}(v: ${type}) {\n`
            rv += `        const out = newClientOutput(${DEBUG}, 'set${fu}')\n`
            rv += `        ${writeFunctionName(spec, field)}(this.header, v)\n`
            rv += `        // this is dumb. parse should be able to read the raw data; but, it doesn't. You should change that.\n`
            rv += `        out.log('Parsing header from ${HEADER_START} with header offset: ${spec.headerOffset}')\n`
            rv += `        const tmp = this.header.raw.slice(${HEADER_START}, this.header.raw.length - 1)\n`
            rv += `        parse${spec.name}(tmp, ${spec.headerOffset}, this.header)\n`
            rv += `    }\n`
            rv += `\n`
        }
    }

    rv += '}\n\n'
    return rv
}

function writeFunctionName(spec: Spec, field: any) {
    return `${spec.name}_write${field.n}`
}


export async function genSetters(spec: Spec) {
    let rv = ''
    let offset = HEADER_START + spec.headerOffset * 2
    for (const field of spec.fields) {
        const fname = writeFunctionName(spec, field)
        rv += `export function ${fname}(header: ${spec.name}, v: ${field.t ? field.t : 'number'}) {\n`
        rv += `    const out = newClientOutput(${DEBUG}, '${fname}')\n`
        rv += `    out.log('Offset: ' + ${offset})\n`
        if (field.t) {
            if (field.t === 'string') {
                //         const data = string2AkaiBytes(name)
                //         for (let i = offset, j = 0; i < offset + 12 * 2; i += 2, j++) {
                //             const nibbles = byte2nibblesLE(data[j])
                //             header.raw[i] = nibbles[0]
                //             header.raw[i + 1] = nibbles[1]
                //         }
                rv += `    const data = string2AkaiBytes(v)\n`
                rv += `    for (let i = ${offset}, j = 0; i < ${offset} + 12 * 2; i += 2, j++) {\n`
                rv += `        const nibbles = byte2nibblesLE(data[j])\n`
                rv += `        header.raw[i] = nibbles[0]\n`
                rv += `        header.raw[i + 1] = nibbles[1]`
                rv += `    }\n`

            } else {
                rv += `    // IMPLEMENT ME for field: ${field.t}`
            }
        } else {
            //         const d = byte2nibblesLE(polyphony)
            //         header.raw[offset] = d[0]
            //         header.raw[offset + 1] = d[1]
            rv += `    const d = byte2nibblesLE(v)\n`
            rv += `    header.raw[${offset}] = d[0]\n`
            rv += `    header.raw[${offset} + 1] = d[1]\n`
        }
        rv += `}\n\n`
        offset += field.s ? field.s * 2 : 2
    }
    return rv
}

export async function genParser(spec: Spec) {
    let rv = `export function parse${spec.name}(data: number[], offset: number, o: ${spec.name}) {\n`
    rv += `    const out = newClientOutput(${DEBUG}, 'parse${spec.name}')\n`
    rv += `    const v = {value: 0, offset: offset * 2}\n\n`
    rv += '    let b: number[]\n'
    rv += '    function reloff() {\n' +
        '        // This calculates the current offset into the header data so it will match with the Akai sysex docs for sanity checking. See https://lakai.sourceforge.net/docs/s2800_sysex.html\n' +
        '        // As such, The math here is weird: \n' +
        '        // * Each offset "byte" in the docs is actually two little-endian nibbles, each of which take up a slot in the midi data array--hence v.offset /2 \n' +
        '        return (v.offset / 2)\n' +
        '    }\n\n'
    for (const field of spec.fields) {
        rv += `    // ${field.d}\n`
        rv += `    out.log('${field.n}: offset: ' + reloff())\n`
        if (field.l) {
            rv += `    o["${field.n}Label"] = "${field.l}"\n`
        }
        if (field.t) {
            rv += `    o.${field.n} = ''\n` +
                '    for (let i = 0; i < 12; i++) {\n' +
                '          nextByte(data, v)\n' +
                `          o.${field.n} += akaiByte2String([v.value])\n` +
                `          out.log('${field.n} at ' + i + ': ' + o.${field.n})` +
                '    }\n'
        } else {
            rv += `    b = []\n`
            rv += `    for (let i=0; i<${field.s ? field.s : 1}; i++) {\n`
            rv += '        b.push(nextByte(data, v).value)\n'
            rv += `    }\n`
            rv += `    o.${field.n} = bytes2numberLE(b)\n`
        }
        rv += '\n'
    }
    rv += '}'
    return rv
}