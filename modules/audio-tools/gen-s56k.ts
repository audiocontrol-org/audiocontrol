import {DeviceSpec, getDeviceSpecs} from "@/midi/devices/specs";
import fs from "fs";
import path from "path";

const out = fs.createWriteStream(path.join('src','ts', 'midi', 'devices', 'devices.ts'))

out.write(`// GENERATED: ${new Date().toLocaleString()}\n`)
out.write('// DO NOT EDIT. YOUR CHANGES WILL BE OVERWRITTEN.\n\n')

out.write(`import {MutableNumber, MutableString, Result, NumberResult, StringResult} from "@/lib/lib-core"\n`)
out.write(`import {Sysex} from "@/midi/sysex"\n`)
out.write(`import {newDeviceObject} from "@/midi/device"\n`)
out.write(`import {ProcessOutput} from "@/process-output"\n`)

out.write(`import {${getDeviceSpecs().map(spec => spec.specName).join(',')}} from "@/midi/devices/specs"\n\n`)
getDeviceSpecs().forEach(device => {
    gen(device)
})

// | general                                 | set request spec. req data length encoded in length of the spec array
// | method name root, type spec             | item code, req data, response data type, response data length | item code, [req byte 1 (type | value), ..., req byte n (type | value) ]
// |                   'number|min|max|step" |
// |                   'string|max'          |
// ["Loudness", "number|0|100|1", 0x28, [], "uint8", 1, 0x20, ["uint8"]],

interface StringTypeSpec {
    type: string
    max: number
}

interface NumberTypeSpec {
    type: string
    min: number
    max: number
    step: number
}

function parseTypeSpec(spec) {
    if (spec.startsWith('number')) {
        const [type, min, max, step] = spec.split('|')
        return {type: type, min: min, max: max, step: step} as NumberTypeSpec
    } else {
        const [type, max] = spec.split('|')
        return {type: type, max: max} as StringTypeSpec
    }
}

interface Item {
    methodNameRoot: string
    getterName: string
    setterName: string
    propertyName: string
    dataTypeSpec: NumberTypeSpec | StringTypeSpec
    getterCode: number
    getterData: number[]
    setterType: string
    setterDataLength: number
    setterDataCode: number
    setterDataTypes: string[]
}

function parseItem(itemSpec) {
    let cursor = 0
    const methodNameRoot = itemSpec[cursor++]
    return {
        methodNameRoot: methodNameRoot,
        getterName: `get${methodNameRoot}`,
        setterName: `set${methodNameRoot}`,
        propertyName: String(methodNameRoot).charAt(0).toLowerCase() + String(methodNameRoot).slice(1),
        dataTypeSpec: parseTypeSpec(itemSpec[cursor++]),
        getterCode: itemSpec[cursor++],
        getterData: itemSpec[cursor++],
        setterType: itemSpec[cursor++],
        setterDataLength: itemSpec[cursor++],
        setterDataCode: itemSpec[cursor++],
        setterDataTypes: itemSpec[cursor++]
    } as Item
}

function gen(device: DeviceSpec) {
    const basename = device.className
    const infoName = basename + 'Info'

    out.write(`//\n`)
    out.write(`// ${basename}\n`)
    out.write(`//\n\n`)

    //
    // <Device>Info interface
    //
    out.write(`export interface ${infoName} {\n`)
    out.write(device.items.map(i => {
        // let cursor = 0
        // const methodNameRoot = item[cursor++]
        // const propertyName = String(methodNameRoot).charAt(0).toLowerCase() + String(methodNameRoot).slice(1)
        // const typeSpec = parseTypeSpec(item[cursor++])
        const item = parseItem(i)
        const field = [item.propertyName]
        switch (item.dataTypeSpec.type) {
            case 'number':
                field.push('MutableNumber')
                break
            case 'string':
                field.push('MutableString')
                break
            default:
                break
        }
        return '  ' + field.join(': ')
    }).join('\n'))

    //
    // <Device>InfoResult interface
    //
    out.write('\n}\n\n')
    out.write(`export interface ${infoName}Result extends Result {\n`)
    out.write(`  data: ${infoName}\n`)
    out.write(`}\n\n`)

    //
    // <Device> interface
    //
    out.write('\n')
    out.write(`export interface ${basename} {\n`)
    out.write(device.items.map(i => {
        const item = parseItem(i)
        let getter = `  ${item.getterName}(): `
        getter += item.dataTypeSpec.type === 'number' ? 'NumberResult' : 'StringResult'
        return getter
    }).join('\n'))
    out.write('\n')
    out.write(`  getInfo(): Promise<${infoName}Result>\n`)
    out.write('}\n\n')

    //
    // <Device> ctor
    //

    out.write(`\n`)
    out.write(`export function new${basename}(sysex: Sysex, out: ProcessOutput) {\n`)
    out.write( `  return newDeviceObject(${device.specName}, sysex, out) as ${basename}`)
    out.write('}\n\n')
}