import type { Chunk } from '@/devices/s56k-types.js';

/**
 * Pad field name generator for spec-based chunks
 */
export class Pad {
    padCount = 0

    padField(): string {
        return 'pad' + this.padCount++
    }
}

/**
 * Writes the data into the buffer; returns the number of bytes written
 */
export function write(buf: Buffer, data: number[], offset: number): number {
    buf.set(data, offset)
    return data.length
}

/**
 * Write the number to the buffer; returns the number of bytes written
 */
export function writeByte(buf: Buffer, n: number, offset: number): number {
    buf.writeInt8(n, offset)
    return 1
}

export function readByte(buf: Buffer, offset: number): number {
    return buf.readInt8(offset)
}

export function string2Bytes(str: string) {
    const rv: number[] = []
    for (let i = 0; i < str.length; i++) {
        rv.push(str.charCodeAt(i))
    }
    return rv
}

export function bytes2String(bytes: number[]) {
    let rv = ''
    for (const b of bytes) {
        rv += String.fromCharCode(b)
    }
    return rv
}

/**
 * Validates the buffer from offset matches the expected data array. Returns the number of bytes read
 */
export function checkOrThrow(buf: Buffer, data: number[], offset: number): number {
    for (let i = 0; i < data.length; i++, offset++) {
        if (data[i] != buf.readInt8(offset)) {
            throw new Error(`Bad vibes at: i: ${i}, offset: ${offset}. Expected ${data[i]} but found ${buf.readInt8(offset)}`)
        }
    }
    return data.length
}

export function bytes2Number(bytes: number[]): number {
    return Buffer.from(bytes).readInt32LE()
}

/**
 * Parses [offset .. offset + 8]  bytes of the buffer:
 *   - sets the chunk name to the ascii values of bytes [offset .. offset + 4]
 *   - sets the chunk length to the int32 value of bytes [offset + 5 .. offset + 8]
 *   - returns the number of bytes read
 */
export function parseChunkHeader(buf: Buffer, chunk: Chunk, offset: number): number {
    chunk.name = ''
    for (let i = 0; i < 4; i++, offset++) {
        chunk.name += String.fromCharCode(readByte(buf, offset))
    }
    chunk.lengthInBytes = buf.readInt32LE(offset)
    return 8
}

export function readFromSpec(buf: Buffer, obj: any, spec: string[], offset: number): number {
    for (let i = 0; i < spec.length; i++, offset++) {
        try {
            obj[spec[i]] = readByte(buf, offset)
        } catch (err) {
            const chunkNameString = bytes2String(obj.chunkName)
            throw new Error(`Failed to read spec field '${spec[i]}' at index ${i}, offset ${offset} for chunk '${chunkNameString}': ${err.message}`)
        }
    }
    return spec.length
}

export function writeFromSpec(buf: Buffer, chunk: any, spec: string[], offset: number): number {
    const chunkNameString = bytes2String(chunk.chunkName)
    const checkpoint = offset
    const zeroPad = chunkNameString === 'zone'

    for (let i = 0; i < chunk.chunkName.length; i++, offset++) {
        writeByte(buf, chunk.chunkName[i], offset)
    }

    // Note: Buffer.writeInt32LE returns the offset + bytes written, not the bytes written
    offset = buf.writeInt32LE(chunk.length, offset)

    for (let i = 0; i < spec.length; i++, offset++) {
        // Zero out padded bytes for zone chunks
        if (zeroPad && spec[i].startsWith('pad')) {
            chunk[spec[i]] = 0
        }
        writeByte(buf, chunk[spec[i]], offset)
    }

    return offset - checkpoint
}

export function newChunkFromSpec(chunkName: number[], chunkLength: number, spec: string[]) {
    const chunkNameString = bytes2String(chunkName)
    return {
        chunkName: chunkName,
        length: chunkLength,
        parse(buf: Buffer, offset: number): number {
            try {
                checkOrThrow(buf, chunkName, offset)
            } catch (err) {
                throw new Error(`Failed to parse chunk '${chunkNameString}': expected chunk name ${chunkName} but got mismatch at offset ${offset}: ${err.message}`)
            }
            offset += parseChunkHeader(buf, this, offset)
            readFromSpec(buf, this, spec, offset)
            return this.length + 8
        },
        write(buf: Buffer, offset: number): number {
            const bytesReported = this.length + 8
            const bytesWritten = writeFromSpec(buf, this, spec, offset)
            if (bytesReported < bytesWritten) {
                // barf if we've written more bytes than we report
                throw new Error(`Bytes written != bytes reported: ${bytes2String(chunkName)}; written: ${bytesWritten}, reported: ${bytesReported}`)
            }
            return bytesReported
        }
    }
}
