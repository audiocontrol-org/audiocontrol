import { describe, it, expect, vi } from 'vitest';
import path from 'pathe';
import {midiNoteToNumber} from "@/lib-midi.js"
import {
    AbstractKeygroup,
    AudioMetadata,
    AudioSource,
    TranslateContext,
    description,
    mapLogicAutoSampler,
    mapProgram, newDefaultTranslateContext,
    newDefaultAudioFactory, newDefaultAudioTranslate, MapFunction, AbstractZone
} from "@/lib-translate.js";
import {tmpdir} from "node:os";
import {Sample} from "@/sample.js";
import {parseFile} from "music-metadata";

describe('Test lib-translate exports', () => {
    it('Exports description()', () => {
        description()
    })
})


describe(`default audio factory`, async () => {
    it(`Creates a default audio factory`, async () => {
        const factory = newDefaultAudioFactory()
        const source = await factory.loadFromFile(path.join('test', 'data', 'decent', 'Samples', 'Oscar.wav'))
        expect(source).toBeDefined()

        const meta = source.meta
        expect(meta.sampleRate).toBe(44100)
        expect(meta.bitDepth).toBe(24)
        expect(meta.channelCount).toBe(2)
        expect(meta.container).toBe('WAVE')
        expect(meta.codec).toBe("PCM")

        const sample = await source.getSample()
        expect(sample).toBeDefined()
    })
})


describe(`Core translator mapper tests`, async () => {
    it(`Handles empty arguments`, async () => {
        // @ts-ignore
        const result = await mapProgram(undefined, undefined, undefined)
        expect(result.errors.length).toBe(3)
    })

    it(`Checks for empty audio factory`, async () => {
        // @ts-ignore
        const result = await mapProgram({audioFactory: undefined, fs: vi.fn()}, vi.fn(), {source: vi.fn(), target: vi.fn()})
        expect(result.errors.length).toBe(1)
    })

    it(`Checks for empty fileio`, async () => {
        // @ts-ignore
        const result = await mapProgram({audioFactory: vi.fn(), fs: undefined}, vi.fn(), {source: vi.fn(), target: vi.fn()})
        expect(result.errors.length).toBe(1)
    })

    it(`Checks for empty map function`, async () => {
        // @ts-ignore
        const ctx: TranslateContext = {fs: vi.fn(), audioFactory: vi.fn()}
        // @ts-ignore
        const result = await mapProgram(ctx, undefined, {source: vi.fn(), target: vi.fn()})
        expect(result.errors.length).toBe(1)

    })

    it(`Checks for empty source`, async () => {
        // @ts-ignore
        const ctx: TranslateContext = {fs: vi.fn(), audioFactory: vi.fn()}
        // @ts-ignore
        const result = await mapProgram(ctx, vi.fn(), {source: undefined, target: vi.fn()})
        expect(result.errors.length).toBe(1)
    })

    it(`Checks for empty target`, async () => {
        // @ts-ignore
        const ctx: TranslateContext = {fs: vi.fn(), audioFactory: vi.fn()}
        // @ts-ignore
        const result = await mapProgram(ctx, vi.fn(), {source: vi.fn(), target: undefined})
        expect(result.errors.length).toBe(1)
    })

    it(`Maps samples to a program`, async () => {
        const mapFunctionCalls = []

        function mapFunction(s: AudioSource[]): AbstractKeygroup[] {
            mapFunctionCalls.push(s)

            return s.map((v) => {
                const zone: AbstractZone = {
                    centerNote: 60,
                    audioSource: v,
                    lowNote: 0,
                    highNote: 127,
                    lowVelocity: 0,
                    highVelocity: 127
                };
                return {zones: [zone]}
            })
        }

        const source = path.join('test', 'data', 'auto', 'J8.01')
        const target = path.join('build')
        const program = await mapProgram(newDefaultTranslateContext(), mapFunction, {source: source, target: target})
        expect(mapFunctionCalls.length).toBe(1)
        expect(program).toBeDefined()
        expect(program.data).toBeDefined()
        expect(program.data?.length).toBe(11)
    })

    it(`Maps multiple Logic auto-sample output files to a set of keygroups`, async () => {
        const files = [
            "J8-QG7B.01-C1-V127.aif",
            "J8-WJ92.01-F#1-V127.aif",
            "J8-28YB.01-C2-V127.aif",
            "J8-G22P.01-F#2-V127.aif",
            "J8-OVMR.01-F#3-V127.aif",
            "J8-XTC0.01-C3-V127.aif",
            "J8-1DY0.01-C4-V127.aif",
            "J8-1DY0.01-C4-V64.aif",
            "J8-BP6I.01-F#4-V127.aif",
            "J8-GGQ0.01-C5-V127.aif",
            "J8-L5KB.01-B5-V127.aif",
            "J8-ZYRJ.01-F#5-V127.aif"]

        const sources: AudioSource[] = files.map(f => {
            const rv: AudioSource = {
                meta: {} as AudioMetadata, filepath: f,
                getSample: function (): Promise<Sample> {
                    throw new Error("Function not implemented.");
                }
            }
            return rv
        })
        const keygroups = mapLogicAutoSampler(sources);
        expect(keygroups).toBeDefined()
        expect(keygroups.length).toBe(11)
        const kg1 = keygroups[0]
        expect(kg1).toBeDefined()
        expect(kg1.zones).toBeDefined()
        expect(kg1.zones.length).toBe(1)
        const zone1 = kg1.zones[0]
        expect(zone1).toBeDefined()
        expect(zone1.audioSource.filepath.endsWith(files[0]))
        expect(zone1?.lowNote).toBe(midiNoteToNumber('C0') - 12)
        expect(zone1.highNote).toBe(midiNoteToNumber('C1'))

        const k2 = keygroups[1]
        expect(k2).toBeDefined()
        expect(k2.zones).toBeDefined()
        expect(k2.zones.length).toBe(1)
        const zone2 = k2.zones[0]
        expect(zone2).toBeDefined()
        expect(zone2.lowNote).toBe(midiNoteToNumber('C#1'))
        expect(zone2.highNote).toBe(midiNoteToNumber('F#1'))
    })
})

describe('mapProgram', () => {

    it.skip('handles empty directory', async () => {
        // FIXME: This test hangs because tmpdir() may contain files
        // Need to create an actual empty temp directory for this test
        const result = await mapProgram(newDefaultTranslateContext(), () => [], {source: tmpdir(), target: tmpdir()});
        expect(result.data).toEqual([]);
    });

    it('processes audio files correctly', async function () {

        const mapFunction: MapFunction = (sources: AudioSource[]) => sources.map(s => {

            const zone: AbstractZone = {
                centerNote: 60,
                audioSource: s, lowNote: 0, highNote: 127, lowVelocity: 0, highVelocity: 127
            };
            return {
                zones: [zone],
            }
        });


        const sourceDir = path.join(process.cwd(), 'test', 'data', 'auto', 'J8.01').normalize();
        console.log(`sourceDir: ${sourceDir}`);
        console.log(`working dir: ${process.cwd()}`);
        const targetDir = tmpdir()
        const result = await mapProgram(newDefaultTranslateContext(), mapFunction, {
            source: sourceDir,
            target: targetDir
        });
        expect(result.data).toHaveLength(11);
        // @ts-ignore
        expect(result.data[0].zones[0].lowNote).toBe(0);
        // @ts-ignore
        expect(result.data[0].zones[0].highNote).toBe(127);

    }, { timeout: 10000 });
})

describe('AudioTranslate', async () => {

    it(`Converts aiff to mp3`, async () => {
        const t = newDefaultAudioTranslate()
        const source = path.join('test', 'data', 'auto', 'J8.01', 'J8-1DY0.01-C4-V64.aif')
        const target = path.join(tmpdir(), 'translate.mp3')
        const result = await t.translate(source, target)
        expect(result).toBeDefined()
        expect(result.errors.length).toBe(0)

        const meta = await parseFile(target)
        expect(meta.format.container).toBe("MPEG")
        expect(meta.format.codec).toBe('MPEG 1 Layer 3')
    })

    it(`Converts Aiff to Wav`, async () => {
        const t = newDefaultAudioTranslate()
        const source = path.join('test', 'data', 'auto', 'J8.01', 'J8-1DY0.01-C4-V64.aif')
        const target = path.join(tmpdir(), 'translated.wav')
        const result = await t.translate(source, target)
        expect(result).toBeDefined()
        expect(result.errors.length).toBe(0)

        const meta = await parseFile(target);
        expect(meta.format.container).toBe('WAVE')
        expect(meta.format.bitsPerSample).toBe(16)
        expect(meta.format.sampleRate).toBe(44100)
    })
})
