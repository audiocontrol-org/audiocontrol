import {expect} from "chai";
import {stub} from "sinon";
import path from "pathe";
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
        expect(source).to.exist

        const meta = source.meta
        expect(meta.sampleRate).to.equal(44100)
        expect(meta.bitDepth).to.equal(24)
        expect(meta.channelCount).to.equal(2)
        expect(meta.container).to.equal('WAVE')
        expect(meta.codec).to.equal("PCM")

        const sample = await source.getSample()
        expect(sample).to.exist
    })
})


describe(`Core translator mapper tests`, async () => {
    it(`Handles empty arguments`, async () => {
        // @ts-ignore
        const result = await mapProgram(undefined, undefined, undefined)
        expect(result.errors.length).to.equal(3)
    })

    it(`Checks for empty audio factory`, async () => {
        // @ts-ignore
        const result = await mapProgram({audioFactory: undefined, fs: stub()}, stub(), {source: stub(), target: stub()})
        expect(result.errors.length).to.equal(1)
    })

    it(`Checks for empty fileio`, async () => {
        // @ts-ignore
        const result = await mapProgram({audioFactory: stub(), fs: undefined}, stub(), {source: stub(), target: stub()})
        expect(result.errors.length).to.equal(1)
    })

    it(`Checks for empty map function`, async () => {
        // @ts-ignore
        const ctx: TranslateContext = {fs: stub(), audioFactory: stub()}
        // @ts-ignore
        const result = await mapProgram(ctx, undefined, {source: stub(), target: stub()})
        expect(result.errors.length).to.equal(1)

    })

    it(`Checks for empty source`, async () => {
        // @ts-ignore
        const ctx: TranslateContext = {fs: stub(), audioFactory: stub()}
        // @ts-ignore
        const result = await mapProgram(ctx, stub(), {source: undefined, target: stub()})
        expect(result.errors.length).to.equal(1)
    })

    it(`Checks for empty target`, async () => {
        // @ts-ignore
        const ctx: TranslateContext = {fs: stub(), audioFactory: stub()}
        // @ts-ignore
        const result = await mapProgram(ctx, stub(), {source: stub(), target: undefined})
        expect(result.errors.length).to.equal(1)
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
        expect(mapFunctionCalls.length).eq(1)
        expect(program).to.exist
        expect(program.data).to.exist
        expect(program.data?.length).eq(11)
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
        expect(keygroups).to.exist
        expect(keygroups.length).to.eq(11)
        const kg1 = keygroups[0]
        expect(kg1).to.exist
        expect(kg1.zones).to.exist
        expect(kg1.zones.length).to.eq(1)
        const zone1 = kg1.zones[0]
        expect(zone1).to.exist
        expect(zone1.audioSource.filepath.endsWith(files[0]))
        expect(zone1?.lowNote).to.eq(midiNoteToNumber('C0') - 12)
        expect(zone1.highNote).eq(midiNoteToNumber('C1'))

        const k2 = keygroups[1]
        expect(k2).to.exist
        expect(k2.zones).to.exist
        expect(k2.zones.length).to.eq(1)
        const zone2 = k2.zones[0]
        expect(zone2).to.exist
        expect(zone2.lowNote).eq(midiNoteToNumber('C#1'))
        expect(zone2.highNote).eq(midiNoteToNumber('F#1'))
    })
})

describe('mapProgram', () => {

    it('handles empty directory', async () => {
        const result = await mapProgram(newDefaultTranslateContext(), () => [], {source: tmpdir(), target: tmpdir()});
        expect(result.data).to.deep.equal([]);
    });

    it('processes audio files correctly', async function () {

        this.timeout(10 * 1000)

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
        expect(result.data).to.have.lengthOf(11);
        // @ts-ignore
        expect(result.data[0].zones[0].lowNote).to.equal(0);
        // @ts-ignore
        expect(result.data[0].zones[0].highNote).to.equal(127);

    });
})

describe('AudioTranslate', async () => {

    it(`Converts aiff to mp3`, async () => {
        const t = newDefaultAudioTranslate()
        const source = path.join('test', 'data', 'auto', 'J8.01', 'J8-1DY0.01-C4-V64.aif')
        const target = path.join(tmpdir(), 'translate.mp3')
        const result = await t.translate(source, target)
        expect(result).to.exist
        expect(result.errors.length).to.eq(0)

        const meta = await parseFile(target)
        expect(meta.format.container).to.eq("MPEG")
        expect(meta.format.codec).eq('MPEG 1 Layer 3')
    })

    it(`Converts Aiff to Wav`, async () => {
        const t = newDefaultAudioTranslate()
        const source = path.join('test', 'data', 'auto', 'J8.01', 'J8-1DY0.01-C4-V64.aif')
        const target = path.join(tmpdir(), 'translated.wav')
        const result = await t.translate(source, target)
        expect(result).to.exist
        expect(result.errors.length).to.equal(0)

        const meta = await parseFile(target);
        expect(meta.format.container).to.equals('WAVE')
        expect(meta.format.bitsPerSample).to.eq(16)
        expect(meta.format.sampleRate).to.eq(44100)
    })
})
