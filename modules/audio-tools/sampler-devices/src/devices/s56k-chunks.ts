import type {
    AmpEnvelopeChunk,
    AuxEnvelopeChunk,
    FilterChunk,
    FilterEnvelopeChunk,
    HeaderChunk,
    KeygroupChunk,
    KlocChunk,
    Lfo1Chunk,
    Lfo2Chunk,
    ModsChunk,
    OutputChunk,
    ProgramChunk,
    TuneChunk,
    ZoneChunk
} from '@/devices/s56k-types.js';
import {
    bytes2Number,
    bytes2String,
    checkOrThrow,
    newChunkFromSpec,
    Pad,
    parseChunkHeader,
    write,
    writeByte
} from '@/devices/s56k-utils.js';

// Re-export utilities for backward compatibility
export { bytes2Number, bytes2String, parseChunkHeader };

export function newHeaderChunk(): HeaderChunk {
    const riff = [0x52, 0x49, 0x46, 0x46] // 'RIFF'
    const chunkLength = [0x00, 0x00, 0x00, 0x00] //  Chunk length: 0 (not correct, but that's what Akai does)
    const aprg = [0x41, 0x50, 0x52, 0x47] // 'APRG'
    return {
        chunkName: riff,
        lengthInBytes: bytes2Number(chunkLength),
        name: '',
        parse(buf: Buffer, offset: number): number {
            const checkpoint = offset
            offset += checkOrThrow(buf, riff, offset)
            offset += checkOrThrow(buf, chunkLength, offset)
            offset += checkOrThrow(buf, aprg, offset)
            return offset - checkpoint
        },
        write(buf: Buffer, offset: number): number {
            const checkpoint = offset
            offset += write(buf, riff, offset)
            offset += write(buf, chunkLength, offset)
            offset += write(buf, aprg, offset)
            return offset - checkpoint
        }
    }
}

const programSpec = ["pad1", "programNumber", "keygroupCount", "pad2", "pad3", "pad4"];

export function newProgramChunk(): ProgramChunk {
    const chunkName = [0x70, 0x72, 0x67, 0x20] // 'prg '
    const chunk = newChunkFromSpec(chunkName, 6, programSpec)
    return chunk as unknown as ProgramChunk
}

const outputSpec = ['pad1', 'loudness', 'ampMod1', 'ampMod2', 'panMod1', 'panMod2', 'panMod3', 'velocitySensitivity']

export function newOutputChunk(): OutputChunk {
    const chunkName = [0x6f, 0x75, 0x74, 0x20]   // 'out '
    const chunk = newChunkFromSpec(chunkName, 8, outputSpec)
    return chunk as unknown as OutputChunk
}

export function newTuneChunk(): TuneChunk {
    const chunkName = [0x74, 0x75, 0x6e, 0x65] // 'tune'
    const chunk = newChunkFromSpec(chunkName, 24, [
        'pad1',
        'semiToneTune',
        'fineTune',
        'detuneC',
        'detuneCSharp',
        'detuneD',
        'detuneEFlat',
        'detuneE',
        'detuneF',
        'detuneFSharp',
        'detuneG',
        'detuneGSharp',
        'detuneA',
        'detuneBFlat',
        'detuneB',
        'pitchBendUp',
        'pitchBendDown',
        'bendMode',
        'aftertouch',
        'pad2',
        'pad3',
        'pad4'
    ])

    return chunk as unknown as TuneChunk
}

export function newLfo1Chunk(): Lfo1Chunk {
    const chunkName = [0x6c, 0x66, 0x6f, 0x20] // 'lfo '
    const chunk = newChunkFromSpec(chunkName, 14, ['pad1', 'waveform', 'rate', 'delay', 'depth', 'sync', 'pad2', 'modwheel', 'aftertouch',
        'rateMod', 'delayMod', 'depthMod'])
    return chunk as unknown as Lfo1Chunk
}

export function newLfo2Chunk(): Lfo2Chunk {
    const chunkName = [0x6c, 0x66, 0x6f, 0x20] // 'lfo '
    const chunk = newChunkFromSpec(chunkName, 14, [
        'pad1',
        'waveform',
        'rate',
        'delay',
        'depth',
        'pad2',
        'retrigger',
        'pad3',
        'pad4',
        'rateMod',
        'delayMod',
        'depthMod'
    ])
    return chunk as unknown as Lfo2Chunk
}

export function newModsChunk(): ModsChunk {
    const chunkName = [0x6d, 0x6f, 0x64, 0x73] // 'mods'
    const chunk = newChunkFromSpec(chunkName, 38, [
        'pad1',
        'pad2',
        'pad3',
        'pad4',
        'pad5',
        'ampMod1Source',
        'pad6',
        'ampMod2Source',
        'pad7',
        'panMod1Source',
        'pad8',
        'panMod2Source',
        'pad9',
        'panMod3Source',
        'pad10',
        'lfo1RateModSource',
        'pad11',
        'lfo1DelayModSource',
        'pad12',
        'lfo1DepthModSource',
        'pad13',
        'lfo2RateModSource',
        'pad14',
        'lfo2DelayModSource',
        'pad15',
        'lfo2DepthModSource',
        'pad15',
        'pitchMod1Source',
        'pad16',
        'pitchMod2Source',
        'pad17',
        'ampModSource',
        'pad19',
        'filterModInput1',
        'pad19',
        'filterModInput2',
        'pad20',
        'filterModInput3'
    ])
    return chunk as unknown as ModsChunk
}

/**
 * Parse sample name from zone chunk's character fields
 */
function parseSampleName(zone: ZoneChunk) {
    zone.sampleName = ''
    for (let i = 0; i < zone.sampleNameLength; i++) {
        zone.sampleName += String.fromCharCode(zone[`character${i}`])
    }
}

/**
 * Write sample name to zone chunk's character fields
 */
function writeSampleName(zone: ZoneChunk) {
    zone.sampleNameLength = zone.sampleName.length
    // Zero out all character fields first
    for(const name of Object.getOwnPropertyNames(zone)) {
        if (name.startsWith('character')) {
            zone[name] = 0
        }
    }
    // Write sample name characters
    for (let i = 0; i < zone.sampleNameLength; i++) {
        zone[`character${i}`] = zone.sampleName.charCodeAt(i)
    }
}

export function newKeygroupChunk(): KeygroupChunk {
    const pad = new Pad()
    const keygroupChunkName = [0x6b, 0x67, 0x72, 0x70]
    const klocChunkName = [0x6b, 0x6c, 0x6f, 0x63];
    const klocChunkSpec = [
        pad.padField(),
        pad.padField(),
        pad.padField(),
        pad.padField(),
        'lowNote',
        'highNote',
        'semiToneTune',
        'fineTune',
        'overrideFx',
        'fxSendLevel',
        'pitchMod1',
        'pitchMod2',
        'ampMod',
        'zoneXFade',
        'muteGroup',
        pad.padField()
    ]
    const envChunkName = [0x65, 0x6e, 0x76, 0x20]
    const ampEnvelopeChunkSpec = [
        pad.padField(),
        'attack',
        pad.padField(),
        'decay',
        'release',
        pad.padField(),
        pad.padField(),
        'sustain',
        pad.padField(),
        pad.padField(),
        'velocity2Attack',
        pad.padField(),
        'keyscale',
        pad.padField(),
        'onVelocity2Release',
        pad.padField(),
        'offVelocity2Release',
        pad.padField(),
    ];
    const filterEnvelopeChunkSpec = [
        pad.padField(),
        'attack',
        pad.padField(),
        'decay',
        'release',
        pad.padField(),
        pad.padField(),
        'sustain',
        pad.padField(),
        'depth',
        'velocity2Attack',
        pad.padField(),
        'keyscale',
        pad.padField(),
        'onVelocity2Release',
        'offVelocity2Release',
        pad.padField(),
        pad.padField()
    ];
    const auxEnvelopeChunkSpec = [
        pad.padField(),
        'rate1',
        'rate2',
        'rate3',
        'rate4',
        'level1',
        'level2',
        'level3',
        'level4',
        pad.padField(),
        'velocity2Rate1',
        pad.padField(),
        'keyboard2Rate2and4',
        pad.padField(),
        'velocity2Rate4',
        'offVelocity2Rate4',
        'velocity2OutLevel',
        pad.padField()
    ];
    const filterChunkName = [0x66, 0x69, 0x6c, 0x74];
    const filterChunkSpec = [
        pad.padField(),
        'mode',
        'cutoff',
        'resonance',
        'keyboardTrack',
        'modInput1',
        'modInput2',
        'modInput3',
        'headroom',
        pad.padField()
    ];

    // 20 character sample name
    const sampleNameSpec = []
    for (let i = 0; i < 20; i++) {
        sampleNameSpec.push('character' + i)
    }
    // 12 unused fields after the sample name
    const zonePadSpec = []
    for (let i = 0; i < 12; i++) {
        zonePadSpec.push(pad.padField())
    }

    const zoneChunkName = [0x7a, 0x6f, 0x6e, 0x65];
    const zoneChunkSpec = [pad.padField(), 'sampleNameLength'].concat(sampleNameSpec).concat(zonePadSpec).concat([
        'lowVelocity',
        'highVelocity',
        'fineTune',
        'semiToneTune',
        'filter',
        'panBalance',
        'playback',
        'output',
        'level',
        'keyboardTrack',
        'velocity2StartLsb',
        'velocity2StartMsb'
    ]);

    const zones = []
    for (let i = 0; i < 4; i++) {
        zones[i] = newChunkFromSpec(zoneChunkName, 48, zoneChunkSpec)
    }

    const keygroupLength = 352
    return {
        chunkName: keygroupChunkName,
        name: bytes2String(keygroupChunkName),
        lengthInBytes: keygroupLength,
        kloc: newChunkFromSpec(klocChunkName, 16, klocChunkSpec) as unknown as KlocChunk,
        ampEnvelope: newChunkFromSpec(envChunkName, 18, ampEnvelopeChunkSpec) as unknown as AmpEnvelopeChunk,
        filterEnvelope: newChunkFromSpec(envChunkName, 18, filterEnvelopeChunkSpec) as unknown as FilterEnvelopeChunk,
        auxEnvelope: newChunkFromSpec(envChunkName, 18, auxEnvelopeChunkSpec) as unknown as AuxEnvelopeChunk,
        filter: newChunkFromSpec(filterChunkName, 10, filterChunkSpec) as unknown as FilterChunk,
        zone1: zones[0],
        zone2: zones[1],
        zone3: zones[2],
        zone4: zones[3],
        parse(buf, offset): number {
            checkOrThrow(buf, keygroupChunkName, offset)
            offset += parseChunkHeader(buf, this, offset)

            offset += this.kloc.parse(buf, offset)
            offset += this.ampEnvelope.parse(buf, offset)

            offset += this.filterEnvelope.parse(buf, offset)
            offset += this.auxEnvelope.parse(buf, offset)
            offset += this.filter.parse(buf, offset)

            offset += this.zone1.parse(buf, offset)
            parseSampleName(this.zone1)

            offset += this.zone2.parse(buf, offset)
            parseSampleName(this.zone2)

            offset += this.zone3.parse(buf, offset)
            parseSampleName(this.zone3)

            offset += this.zone4.parse(buf, offset)
            parseSampleName(this.zone4)

            return keygroupLength
        },
        write(buf: Buffer, offset: number): number {
            for (let i = 0; i < keygroupChunkName.length; i++) {
                offset += writeByte(buf, keygroupChunkName[i], offset)
            }
            buf.writeInt32LE(this.length, offset)
            offset += 4

            offset += this.kloc.write(buf, offset)
            offset += this.ampEnvelope.write(buf, offset)
            offset += this.filterEnvelope.write(buf, offset)
            offset += this.auxEnvelope.write(buf, offset)
            offset += this.filter.write(buf, offset)

            writeSampleName(this.zone1)
            offset += this.zone1.write(buf, offset)

            writeSampleName(this.zone2)
            offset += this.zone2.write(buf, offset)

            writeSampleName(this.zone3)
            offset += this.zone3.write(buf, offset)

            writeSampleName(this.zone4)
            offset += this.zone4.write(buf, offset)

            return keygroupLength
        }

    } as KeygroupChunk
}
