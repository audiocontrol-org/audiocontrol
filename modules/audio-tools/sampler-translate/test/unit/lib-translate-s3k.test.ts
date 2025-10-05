import {chop, ChopOpts, ProgramOpts, S3kTranslateContext} from '@/lib-translate-s3k.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsp from 'fs/promises';
import fs from 'fs'
import {newAkaiToolsConfig, newAkaitools, Akaitools} from "@oletizi/sampler-devices/s3k";
import {newServerConfig, ServerConfig} from "@oletizi/sampler-lib";
import {ExecutionResult} from "@oletizi/sampler-devices";
import {newDefaultSampleFactory, Sample} from "@/sample.js";
import {map} from "@/lib-translate-s3k.js"
import {
    fileio,
    AudioFactory,
    AbstractKeygroup,
    AbstractZone, AudioTranslate, AudioMetadata, AudioSource
} from "@/lib-translate.js";

describe(`map`,
    async () => {
        let audioFactory: AudioFactory,
            audioSource: AudioSource,
            akaiTools: any,
            wav2AkaiStub: any,
            readAkaiProgramStub: any,
            akaiProgramFile: any,
            programHeader: any,
            ctx: S3kTranslateContext,
            getS3kDefaultProgramPathStub: any,
            fsStub: fileio,
            mapFunctionStub: any,
            options: ProgramOpts,
            readdirStub: any,
            source: string,
            target: string,
            loadFromFileStub: any,
            meta: AudioMetadata,
            audioTranslate: AudioTranslate,
            translateStub: any

        beforeEach(async () => {
            fsStub = {
                // @ts-ignore
                readdir: () => {
                }
            }
            readdirStub = vi.spyOn(fsStub, 'readdir')
            audioFactory = {
                // @ts-ignore
                loadFromFile: loadFromFileStub = vi.fn()
            }

            akaiTools = {
                wav2Akai: wav2AkaiStub = vi.fn(),
                readAkaiProgram: readAkaiProgramStub = vi.fn(),
            }

            programHeader = {}
            akaiProgramFile = {
                program: programHeader
            }

            audioTranslate = {
                translate: translateStub = vi.fn(),
            }
            ctx = {
                getS3kDefaultProgramPath: getS3kDefaultProgramPathStub = vi.fn(),
                audioTranslate: audioTranslate,
                akaiTools: akaiTools,
                audioFactory: audioFactory,
                fs: fsStub
            }
            mapFunctionStub = vi.fn()
            source = ""
            target = ""
            options = {partition: 0, wipeDisk: false, source: source, target: target, prefix: "prefix"}
            meta = {
                channelCount: 2
            }
            audioSource = {
                filepath: "",
                getSample: () => {
                    return Promise.resolve({} as Sample);
                },
                meta: meta
            }
        })

        it(`maps sample to an S3000XL program`, async () => {
            expect(ctx.audioFactory).toBeDefined()
            options.source = '/path/to/source/dir'
            options.target = '/path/to/target/dir'

            readdirStub.mockResolvedValue(['a nice sample', 'another nice sample'])

            const zone: AbstractZone = {
                audioSource: audioSource,
                lowNote: 0,
                highNote: 0,
                highVelocity: 127,
                lowVelocity: 0,
                centerNote: 60
            }
            const kg: AbstractKeygroup = {
                zones: [zone]
            }

            const keygroups: AbstractKeygroup[] = [kg]
            mapFunctionStub.mockReturnValue(keygroups)


            loadFromFileStub.mockResolvedValue(audioSource)

            let successResult: ExecutionResult = {
                errors: [],
                code: 0
            }
            translateStub.mockResolvedValue(successResult)
            wav2AkaiStub.mockResolvedValue(successResult)
            readAkaiProgramStub.mockResolvedValue(akaiProgramFile)


            const result = await map(ctx, mapFunctionStub, options)
            expect(result.errors.length).toBe(0)
            expect(result.data && result.data.length > 0)

            const kgs = result.data
            expect(kgs).toEqual(keygroups)

            expect(akaiTools.wav2Akai).toHaveBeenCalledTimes(keygroups.length)
        })
    })

describe('chop error conditions', () => {
    let statStub: any, mkdirStub: any, readFileStub: any, writefileStub: any, readdirStub: any

    beforeEach(async () => {
        statStub = vi.spyOn(fsp, 'stat');
        mkdirStub = vi.spyOn(fsp, 'mkdir');
        readFileStub = vi.spyOn(fsp, 'readFile');
        writefileStub = vi.spyOn(fsp, 'writeFile');
        readdirStub = vi.spyOn(fsp, 'readdir');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws an error for invalid options (negative samplesPerBeat)', async () => {
        const opts: ChopOpts = {
            source: 'invalid.wav',
            target: '/some/dir',
            partition: 1,
            prefix: 'sample',
            samplesPerBeat: -4,
            beatsPerChop: 2,
            wipeDisk: false,
        };
        const rv = await chop({} as ServerConfig, {} as Akaitools, opts)
        expect(rv.errors.length > 0)
    });

    it('throws an error when the source is not a valid file', async () => {
        statStub.mockRejectedValue(new Error("ENOENT: no such file or directory"));

        const opts: ChopOpts = {
            source: 'invalid.wav',
            target: '/some/dir',
            partition: 1,
            prefix: 'sample',
            samplesPerBeat: 4,
            beatsPerChop: 2,
            wipeDisk: false,
        };

        await expect(chop({} as ServerConfig, {} as Akaitools, opts)).rejects.toThrow('ENOENT: no such file or directory');
    });
})

describe(`chop happy path`, async () => {

    let statStub: any, mkdirStub: any, readFileStub: any, readdirStub: any, createWriteStreamStub: any
    beforeEach(async () => {
        statStub = vi.spyOn(fsp, 'stat')
        mkdirStub = vi.spyOn(fsp, 'mkdir')
        readFileStub = vi.spyOn(fsp, 'readFile')
        readdirStub = vi.spyOn(fsp, 'readdir')
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('chops', async () => {
        // XXX: This is still super messy.
        const targetDir = '/some/dir';
        const samplesPerBeat = 1
        const beatsPerChop = 10
        const sampleCount = 100

        createWriteStreamStub = vi.spyOn(fs, 'createWriteStream')

        statStub.mockImplementation((path: string) => {
            if (path === 'source.wav') {
                return Promise.resolve({isFile: () => true})
            } else if (path === targetDir) {
                // First call rejects, second call resolves
                if (statStub.mock.calls.filter((c: any) => c[0] === targetDir).length === 1) {
                    return Promise.reject(new Error("ENOENT: no such file or directory"))
                }
                return Promise.resolve({isFile: () => false})
            }
            return Promise.reject(new Error("Unexpected path"))
        })
        mkdirStub.mockResolvedValue(undefined);
        createWriteStreamStub.mockReturnValue({write: () => true} as any)

        const opts: ChopOpts = {
            source: 'source.wav',
            target: targetDir,
            partition: 1,
            prefix: 'sample',
            samplesPerBeat: samplesPerBeat,
            beatsPerChop: beatsPerChop,
            wipeDisk: false,
        };

        readFileStub.mockResolvedValue(Buffer.alloc(1024)); // Simulate file data

        // You can stub other functions here to emulate successful operation

        const to16BitStub = vi.fn()
        const to441Stub = vi.fn()
        const trimStub = vi.fn()
        const writeToStreamStub = vi.fn()
        const s: Sample = {
            getBitDepth(): number {
                return 24;
            }, getRawData(): Uint8Array {
                return new Uint8Array(sampleCount);
            }, getSampleData(): Float64Array {
                return new Float64Array();
            }, setRootNote(): void {
            }, to24Bit(): Sample {
                return this;
            }, to48(): Sample {
                return this;
            }, write(_buf: Buffer, _offset?: number): number {
                return 0;
            },
            getMetadata: vi.fn().mockReturnValue({sampleRate: 48000, bitDepth: 24}),
            getSampleCount: vi.fn().mockReturnValue(sampleCount),
            getChannelCount: vi.fn().mockReturnValue(2),
            getSampleRate: vi.fn().mockReturnValue(44100),
            trim: trimStub,
            to441: to441Stub,
            to16Bit: to16BitStub,
            writeToStream: writeToStreamStub,
        };
        trimStub.mockReturnValue(s)
        to441Stub.mockResolvedValue(s)
        to16BitStub.mockResolvedValue(s)
        writeToStreamStub.mockResolvedValue(undefined)

        readdirStub.mockResolvedValue([]);
        const cfg = await newServerConfig()
        const c = await newAkaiToolsConfig()
        const tools = newAkaitools(c)
        const sampleFactory = newDefaultSampleFactory()
        vi.spyOn(tools, 'writeAkaiProgram').mockResolvedValue(undefined as any)
        vi.spyOn(tools, 'wav2Akai').mockResolvedValue({errors: [], code: 0} as ExecutionResult)
        vi.spyOn(tools, 'akaiWrite').mockResolvedValue({errors: [], code: 0} as ExecutionResult)
        vi.spyOn(sampleFactory, 'newSampleFromFile').mockResolvedValue(s)

        const result = await chop(cfg, tools, opts, sampleFactory)

        const mkdirArgs = []
        for (const call of mkdirStub.mock.calls) {
            mkdirArgs.push(call[0])
        }
        expect(mkdirArgs.includes('/some/dir'))

        expect(to16BitStub).toHaveBeenCalledTimes(1)
        expect(to441Stub).toHaveBeenCalledTimes(1)
        expect(trimStub).toHaveBeenCalledTimes(sampleCount / (samplesPerBeat * beatsPerChop))

        expect(result.code).toBe(0);

        expect(createWriteStreamStub).toHaveBeenCalledTimes(10)
    });
});
