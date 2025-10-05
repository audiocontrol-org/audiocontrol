import type {
    HeaderChunk,
    Lfo1Chunk,
    Lfo2Chunk,
    ModsChunk,
    OutputChunk,
    ProgramChunk,
    TuneChunk,
    KeygroupChunk
} from '@/devices/s56k-types.js';
import {
    newHeaderChunk,
    newLfo1Chunk,
    newLfo2Chunk,
    newModsChunk,
    newOutputChunk,
    newProgramChunk,
    newTuneChunk,
    newKeygroupChunk
} from '@/devices/s56k-chunks.js';

/**
 * Internal parser state for S5000/S6000 program files
 */
export interface S56kParserState {
    header: HeaderChunk;
    program: ProgramChunk;
    output: OutputChunk;
    tune: TuneChunk;
    lfo1: Lfo1Chunk;
    lfo2: Lfo2Chunk;
    mods: ModsChunk;
    keygroups: KeygroupChunk[];
    originalBuffer?: Buffer;
    firstKeygroupOffset?: number;
}

/**
 * Create initial parser state with empty chunks
 */
export function createParserState(): S56kParserState {
    return {
        header: newHeaderChunk(),
        program: newProgramChunk(),
        output: newOutputChunk(),
        tune: newTuneChunk(),
        lfo1: newLfo1Chunk(),
        lfo2: newLfo2Chunk(),
        mods: newModsChunk(),
        keygroups: []
    };
}

/**
 * Parse S5000/S6000 program from buffer
 */
export function parseProgram(buf: Buffer, state: S56kParserState, offset: number = 0): void {
    state.originalBuffer = buf;

    offset += state.header.parse(buf, offset);
    offset += state.program.parse(buf, offset);
    offset += state.output.parse(buf, offset);
    offset += state.tune.parse(buf, offset);
    offset += state.lfo1.parse(buf, offset);
    offset += state.lfo2.parse(buf, offset);
    offset += state.mods.parse(buf, offset);

    state.firstKeygroupOffset = offset;
    state.keygroups = [];

    for (let i = 0; i < state.program.keygroupCount; i++) {
        const keygroup = newKeygroupChunk();
        state.keygroups.push(keygroup);
        try {
            offset += keygroup.parse(buf, offset);
        } catch (err) {
            throw new Error(`Failed to parse keygroup ${i + 1} of ${state.program.keygroupCount} at offset ${offset}: ${err.message}`);
        }
    }
}

/**
 * Parse JSON into parser state
 */
export function parseFromJson(json: string, state: S56kParserState): void {
    const obj = JSON.parse(json);

    // Program metadata
    state.program.programNumber = obj.programNumber;
    state.program.keygroupCount = obj.keygroupCount;

    // Output settings
    state.output.loudness = obj.output.loudness;
    state.output.ampMod1 = obj.output.ampMod1;
    state.output.ampMod2 = obj.output.ampMod2;
    state.output.panMod1 = obj.output.panMod1;
    state.output.panMod2 = obj.output.panMod2;
    state.output.panMod3 = obj.output.panMod3;
    state.output.velocitySensitivity = obj.output.velocitySensitivity;

    // Tune settings
    state.tune.semiToneTune = obj.tune.semiToneTune;
    state.tune.fineTune = obj.tune.fineTune;
    state.tune.detuneC = obj.tune.detuneC;
    state.tune.detuneCSharp = obj.tune.detuneCSharp;
    state.tune.detuneD = obj.tune.detuneD;
    state.tune.detuneEFlat = obj.tune.detuneEFlat;
    state.tune.detuneE = obj.tune.detuneE;
    state.tune.detuneF = obj.tune.detuneF;
    state.tune.detuneFSharp = obj.tune.detuneFSharp;
    state.tune.detuneG = obj.tune.detuneG;
    state.tune.detuneGSharp = obj.tune.detuneGSharp;
    state.tune.detuneA = obj.tune.detuneA;
    state.tune.detuneBFlat = obj.tune.detuneBFlat;
    state.tune.detuneB = obj.tune.detuneB;

    // LFO1 settings
    state.lfo1.waveform = obj.lfo1.waveform;
    state.lfo1.rate = obj.lfo1.rate;
    state.lfo1.delay = obj.lfo1.delay;
    state.lfo1.depth = obj.lfo1.depth;
    state.lfo1.sync = obj.lfo1.sync;
    state.lfo1.modwheel = obj.lfo1.modwheel;
    state.lfo1.aftertouch = obj.lfo1.aftertouch;
    state.lfo1.rateMod = obj.lfo1.rateMod;
    state.lfo1.delayMod = obj.lfo1.delayMod;
    state.lfo1.depthMod = obj.lfo1.depthMod;

    // LFO2 settings
    state.lfo2.waveform = obj.lfo2.waveform;
    state.lfo2.rate = obj.lfo2.rate;
    state.lfo2.delay = obj.lfo2.delay;
    state.lfo2.depth = obj.lfo2.depth;
    state.lfo2.retrigger = obj.lfo2.retrigger;
    state.lfo2.rateMod = obj.lfo2.rateMod;
    state.lfo2.delayMod = obj.lfo2.delayMod;
    state.lfo2.depthMod = obj.lfo2.depthMod;

    // Modulation sources
    state.mods.ampMod1Source = obj.mods.ampMod1Source;
    state.mods.ampMod2Source = obj.mods.ampMod2Source;
    state.mods.panMod1Source = obj.mods.panMod1Source;
    state.mods.panMod2Source = obj.mods.panMod2Source;
    state.mods.panMod3Source = obj.mods.panMod3Source;
    state.mods.lfo1RateModSource = obj.mods.lfo1RateModSource;
    state.mods.lfo1DelayModSource = obj.mods.lfo1DelayModSource;
    state.mods.lfo1DepthModSource = obj.mods.lfo1DepthModSource;
    state.mods.lfo2RateModSource = obj.mods.lfo2RateModSource;
    state.mods.lfo2DelayModSource = obj.mods.lfo2DelayModSource;
    state.mods.lfo2DepthModSource = obj.mods.lfo2DepthModSource;
    state.mods.pitchMod1Source = obj.mods.pitchMod1Source;
    state.mods.pitchMod2Source = obj.mods.pitchMod2Source;
    state.mods.ampModSource = obj.mods.ampModSource;
    state.mods.filterModInput1 = obj.mods.filterModInput1;
    state.mods.filterModInput2 = obj.mods.filterModInput2;
    state.mods.filterModInput3 = obj.mods.filterModInput3;

    // Keygroups
    state.keygroups.length = 0;
    for (let i = 0; i < obj.keygroups.length; i++) {
        const keygroup = newKeygroupChunk();
        state.keygroups.push(keygroup);

        const srcKloc = obj.keygroups[i].kloc;
        const destKloc = keygroup.kloc;

        destKloc.lowNote = srcKloc.lowNote;
        destKloc.highNote = srcKloc.highNote;
        destKloc.semiToneTune = srcKloc.semiToneTune;
        destKloc.fineTune = srcKloc.fineTune;
        destKloc.overrideFx = srcKloc.overrideFx;
        destKloc.fxSendLevel = srcKloc.fxSendLevel;
        destKloc.pitchMod1 = srcKloc.pitchMod1;
        destKloc.pitchMod2 = srcKloc.pitchMod2;
        destKloc.ampMod = srcKloc.ampMod;
        destKloc.zoneXFade = srcKloc.zoneXFade;
        destKloc.muteGroup = srcKloc.muteGroup;

        const srcAmpEnv = obj.keygroups[i].ampEnvelope;
        const destAmpEnv = keygroup.ampEnvelope;
        destAmpEnv.attack = srcAmpEnv.attack;
        destAmpEnv.decay = srcAmpEnv.decay;
        destAmpEnv.sustain = srcAmpEnv.sustain;
        destAmpEnv.release = srcAmpEnv.release;
        destAmpEnv.velocity2Attack = srcAmpEnv.velocity2Attack;
        destAmpEnv.keyscale = srcAmpEnv.keyscale;
        destAmpEnv.onVelocity2Release = srcAmpEnv.onVelocity2Release;
        destAmpEnv.offVelocity2Release = srcAmpEnv.offVelocity2Release;

        const srcFiltEnv = obj.keygroups[i].filterEnvelope;
        const destFiltEnv = keygroup.filterEnvelope;
        destFiltEnv.attack = srcFiltEnv.attack;
        destFiltEnv.decay = srcFiltEnv.decay;
        destFiltEnv.sustain = srcFiltEnv.sustain;
        destFiltEnv.release = srcFiltEnv.release;
        destFiltEnv.depth = srcFiltEnv.depth;
        destFiltEnv.velocity2Attack = srcFiltEnv.velocity2Attack;
        destFiltEnv.keyscale = srcFiltEnv.keyscale;
        destFiltEnv.onVelocity2Release = srcFiltEnv.onVelocity2Release;
        destFiltEnv.offVelocity2Release = srcFiltEnv.offVelocity2Release;

        const srcAuxEnv = obj.keygroups[i].auxEnvelope;
        const destAuxEnv = keygroup.auxEnvelope;
        destAuxEnv.rate1 = srcAuxEnv.rate1;
        destAuxEnv.rate2 = srcAuxEnv.rate2;
        destAuxEnv.rate3 = srcAuxEnv.rate3;
        destAuxEnv.rate4 = srcAuxEnv.rate4;
        destAuxEnv.level1 = srcAuxEnv.level1;
        destAuxEnv.level2 = srcAuxEnv.level2;
        destAuxEnv.level3 = srcAuxEnv.level3;
        destAuxEnv.level4 = srcAuxEnv.level4;

        const srcFilt = obj.keygroups[i].filter;
        const destFilt = keygroup.filter;
        destFilt.mode = srcFilt.mode;
        destFilt.cutoff = srcFilt.cutoff;
        destFilt.resonance = srcFilt.resonance;
        destFilt.keyboardTrack = srcFilt.keyboardTrack;
        destFilt.modInput1 = srcFilt.modInput1;
        destFilt.modInput2 = srcFilt.modInput2;
        destFilt.modInput3 = srcFilt.modInput3;
        destFilt.headroom = srcFilt.headroom;

        for (let j = 1; j <= 4; j++) {
            let zoneName = `zone${j}`;
            const srcZone = obj.keygroups[i][zoneName];
            const destZone = keygroup[zoneName];
            destZone.sampleName = srcZone.sampleName;
            destZone.sampleNameLength = destZone.sampleName.length;
            destZone.lowVelocity = srcZone.lowVelocity;
            destZone.highVelocity = srcZone.highVelocity;
            destZone.fineTune = srcZone.fineTune;
            destZone.semiToneTune = srcZone.semiToneTune;
            destZone.filter = srcZone.filter;
            destZone.panBalance = srcZone.panBalance;
            destZone.playback = srcZone.playback;
            destZone.output = srcZone.output;
            destZone.level = srcZone.level;
            destZone.keyboardTrack = srcZone.keyboardTrack;
            destZone.velocity2StartLsb = srcZone.velocity2StartLsb;
            destZone.velocity2StartMsb = srcZone.velocity2StartMsb;
        }
    }
}
