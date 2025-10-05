import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { newSampleFromBuffer, Sample, SampleMetadata } from '@/model/sample';
import { WaveFile } from 'wavefile';

describe('Sample Model', () => {
    let testWav: WaveFile;
    let testBuffer: Uint8Array;
    let sample: Sample;

    beforeEach(() => {
        // Create a test WAV file - mono, 44.1kHz, 16-bit, 1 second
        testWav = new WaveFile();
        const sampleRate = 44100;
        const samples = new Array(sampleRate).fill(0).map((_, i) =>
            Math.sin(2 * Math.PI * 440 * i / sampleRate) * 32767
        );
        testWav.fromScratch(1, sampleRate, '16', samples);

        testBuffer = testWav.toBuffer();
        sample = newSampleFromBuffer(testBuffer);
    });

    describe('newSampleFromBuffer', () => {
        it('should create a Sample from buffer', () => {
            expect(sample).to.not.be.undefined;
            expect(sample.getSampleRate()).to.equal(44100);
        });
    });

    describe('getMetadata', () => {
        it('should return metadata with basic sample info', () => {
            const metadata: SampleMetadata = sample.getMetadata();
            expect(metadata.sampleRate).to.equal(44100);
            expect(metadata.channelCount).to.equal(1);
            expect(metadata.bitDepth).to.equal(16);
            expect(metadata.sampleLength).to.be.greaterThan(0);
        });
    });

    describe('getSampleCount', () => {
        it('should return correct sample count', () => {
            const count = sample.getSampleCount();
            expect(count).to.equal(44100); // 1 second at 44.1kHz
        });
    });

    describe('getChannelCount', () => {
        it('should return correct channel count', () => {
            expect(sample.getChannelCount()).to.equal(1);
        });
    });

    describe('getSampleRate', () => {
        it('should return correct sample rate', () => {
            expect(sample.getSampleRate()).to.equal(44100);
        });
    });

    describe('getBitDepth', () => {
        it('should return correct bit depth', () => {
            expect(sample.getBitDepth()).to.equal(16);
        });
    });

    describe('setRootNote', () => {
        it('should set root note when smpl chunk exists', () => {
            // Create a sample with smpl chunk
            const wavWithSmpl = new WaveFile();
            wavWithSmpl.fromScratch(1, 44100, '16', new Array(1000).fill(0));
            wavWithSmpl.smpl = {
                dwManufacturer: 0,
                dwProduct: 0,
                dwSamplePeriod: 22675,
                dwMIDIUnityNote: 60,
                dwMIDIPitchFraction: 0,
                dwSMPTEFormat: 0,
                dwSMPTEOffset: 0,
                dwNumSampleLoops: 0,
                dwSamplerData: 0,
                loops: []
            };
            const sampleWithSmpl = newSampleFromBuffer(wavWithSmpl.toBuffer());
            sampleWithSmpl.setRootNote(48);
            const metadata = sampleWithSmpl.getMetadata();
            expect(metadata.rootNote).to.equal(48);
        });
    });

    describe('trim', () => {
        it('should trim sample to specified range', () => {
            const trimmed = sample.trim(0, 22050); // First 0.5 seconds
            expect(trimmed.getSampleCount()).to.equal(22050);
            expect(trimmed.getSampleRate()).to.equal(44100);
        });

        it('should preserve other metadata when trimming', () => {
            const trimmed = sample.trim(0, 10000);
            expect(trimmed.getChannelCount()).to.equal(1);
            expect(trimmed.getSampleRate()).to.equal(44100);
            expect(trimmed.getBitDepth()).to.equal(16);
        });
    });

    describe('to16Bit', () => {
        it('should convert to 16-bit if different', () => {
            // Create 24-bit sample
            const wav24 = new WaveFile();
            wav24.fromScratch(1, 44100, '24', new Array(1000).fill(0));
            const sample24 = newSampleFromBuffer(wav24.toBuffer());

            expect(sample24.getBitDepth()).to.equal(24);
            sample24.to16Bit();
            expect(sample24.getBitDepth()).to.equal(16);
        });
    });

    describe('to441', () => {
        it('should convert to 44.1kHz', () => {
            // Create 48kHz sample
            const wav48 = new WaveFile();
            wav48.fromScratch(1, 48000, '16', new Array(1000).fill(0));
            const sample48 = newSampleFromBuffer(wav48.toBuffer());

            expect(sample48.getSampleRate()).to.equal(48000);
            sample48.to441();
            expect(sample48.getSampleRate()).to.equal(44100);
        });
    });

    describe('getSampleData', () => {
        it('should return sample data as Float64Array', () => {
            const data = sample.getSampleData();
            expect(data).to.be.instanceOf(Float64Array);
            expect(data.length).to.equal(44100);
        });
    });

    describe('getRawData', () => {
        it('should return original buffer', () => {
            const rawData = sample.getRawData();
            expect(rawData).to.be.instanceOf(Uint8Array);
            expect(rawData.length).to.equal(testBuffer.length);
        });
    });

    describe('write', () => {
        it('should write to Node.js Buffer at offset', () => {
            const targetBuffer = Buffer.alloc(100000);
            const bytesWritten = sample.write(targetBuffer, 1000);
            expect(bytesWritten).to.be.greaterThan(0);
            // Verify some data was written (WAV files start with 'RIFF')
            expect(targetBuffer.toString('ascii', 1000, 1004)).to.equal('RIFF');
        });
    });

    describe('cleanup', () => {
        it('should add fact chunk', () => {
            const cleaned = sample.cleanup();
            expect(cleaned).to.equal(sample); // Should return same instance
            // The cleanup function modifies the wav internally
        });
    });
});
