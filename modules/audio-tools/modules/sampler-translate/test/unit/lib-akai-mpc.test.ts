import { describe, it, expect } from 'vitest';
import { mpc } from '../../src/lib-akai-mpc';

describe("lib-akai-mpc", () => {
    describe("mpc.newSampleSliceDataFromBuffer", () => {
        it("should parse MPC sample slice data from RIFF atem chunk", () => {
            // Create a minimal RIFF file with atem chunk containing JSON slice data
            const jsonData = JSON.stringify({
                value0: {
                    Slice1: {
                        Start: 0,
                        End: 1000
                    },
                    Slice2: {
                        Start: 1000,
                        End: 2000
                    }
                }
            });

            // Create RIFF WAVE structure with atem chunk
            const riffHeader = Buffer.from('RIFF');
            const waveHeader = Buffer.from('WAVE');
            const atemHeader = Buffer.from('atem');

            const jsonBuffer = Buffer.from(jsonData);
            const atemSize = Buffer.alloc(4);
            atemSize.writeUInt32LE(jsonBuffer.length, 0);

            const totalSize = 4 + 4 + atemHeader.length + atemSize.length + jsonBuffer.length;
            const riffSize = Buffer.alloc(4);
            riffSize.writeUInt32LE(totalSize, 0);

            const buffer = Buffer.concat([
                riffHeader,
                riffSize,
                waveHeader,
                atemHeader,
                atemSize,
                jsonBuffer
            ]);

            const result = mpc.newSampleSliceDataFromBuffer(buffer);

            expect(result).toBeDefined();
            expect(result.slices).toHaveLength(2);
            expect(result.slices[0].name).toBe('Slice1');
            expect(result.slices[0].start).toBe(0);
            expect(result.slices[0].end).toBe(1000);
            expect(result.slices[1].name).toBe('Slice2');
            expect(result.slices[1].start).toBe(1000);
            expect(result.slices[1].end).toBe(2000);
        });

        it("should return empty slices if atem chunk not found", () => {
            // Create a basic RIFF WAVE without atem chunk
            const riffHeader = Buffer.from('RIFF');
            const riffSize = Buffer.alloc(4);
            riffSize.writeUInt32LE(4, 0);
            const waveHeader = Buffer.from('WAVE');

            const buffer = Buffer.concat([
                riffHeader,
                riffSize,
                waveHeader
            ]);

            const result = mpc.newSampleSliceDataFromBuffer(buffer);

            expect(result).toBeDefined();
            expect(result.slices).toHaveLength(0);
        });

        it("should initialize default values correctly", () => {
            const buffer = Buffer.from('RIFF\x04\x00\x00\x00WAVE');
            const result = mpc.newSampleSliceDataFromBuffer(buffer);

            expect(result.version).toBe(-1);
            expect(result.note).toBe("");
            expect(result.scale).toBe("");
            expect(result.barCount).toBe(-1);
            expect(result.slices).toEqual([]);
        });
    });

    describe("mpc.newProgramFromBuffer", () => {
        it("should parse MPC program XML with layers", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program>
  <programname>TestProgram</programname>
  <instrument>
    <layer number="1">
      <samplename>Kick.WAV</samplename>
      <slicestart>0</slicestart>
      <sliceend>1000</sliceend>
    </layer>
    <layer number="2">
      <samplename>Snare.WAV</samplename>
      <slicestart>0</slicestart>
      <sliceend>2000</sliceend>
    </layer>
  </instrument>
</program>`;

            const buffer = Buffer.from(xml);
            const program = mpc.newProgramFromBuffer(buffer);

            expect(program).toBeDefined();
            expect(program.programName).toBe('TestProgram');
            expect(program.layers).toHaveLength(2);

            expect(program.layers[0].number).toBe(1);
            expect(program.layers[0].sampleName).toBe('Kick.WAV');
            expect(program.layers[0].sliceStart).toBe(0);
            expect(program.layers[0].sliceEnd).toBe(1000);

            expect(program.layers[1].number).toBe(2);
            expect(program.layers[1].sampleName).toBe('Snare.WAV');
            expect(program.layers[1].sliceStart).toBe(0);
            expect(program.layers[1].sliceEnd).toBe(2000);
        });

        it("should only include layers with sample names", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program>
  <programname>TestProgram</programname>
  <instrument>
    <layer number="1">
      <samplename>Sample1.WAV</samplename>
    </layer>
    <layer number="2">
      <!-- This layer has no sample name -->
    </layer>
    <layer number="3">
      <samplename>Sample3.WAV</samplename>
    </layer>
  </instrument>
</program>`;

            const buffer = Buffer.from(xml);
            const program = mpc.newProgramFromBuffer(buffer);

            expect(program.layers).toHaveLength(2);
            expect(program.layers[0].sampleName).toBe('Sample1.WAV');
            expect(program.layers[1].sampleName).toBe('Sample3.WAV');
        });

        it("should handle empty program", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program>
  <programname>EmptyProgram</programname>
  <instrument>
  </instrument>
</program>`;

            const buffer = Buffer.from(xml);
            const program = mpc.newProgramFromBuffer(buffer);

            expect(program.programName).toBe('EmptyProgram');
            expect(program.layers).toHaveLength(0);
        });

        it("should handle layers without slice data", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program>
  <programname>NoSlices</programname>
  <instrument>
    <layer number="1">
      <samplename>Sample.WAV</samplename>
    </layer>
  </instrument>
</program>`;

            const buffer = Buffer.from(xml);
            const program = mpc.newProgramFromBuffer(buffer);

            expect(program.layers).toHaveLength(1);
            expect(program.layers[0].sampleName).toBe('Sample.WAV');
            expect(program.layers[0].sliceStart).toBeUndefined();
            expect(program.layers[0].sliceEnd).toBeUndefined();
        });

        it("should parse layer numbers correctly", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program>
  <programname>TestNumbers</programname>
  <instrument>
    <layer number="10">
      <samplename>Layer10.WAV</samplename>
    </layer>
    <layer number="25">
      <samplename>Layer25.WAV</samplename>
    </layer>
  </instrument>
</program>`;

            const buffer = Buffer.from(xml);
            const program = mpc.newProgramFromBuffer(buffer);

            expect(program.layers[0].number).toBe(10);
            expect(program.layers[1].number).toBe(25);
        });

        it("should handle multiple instruments", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<program>
  <programname>MultiInstrument</programname>
  <instrument>
    <layer number="1">
      <samplename>Inst1.WAV</samplename>
    </layer>
  </instrument>
  <instrument>
    <layer number="2">
      <samplename>Inst2.WAV</samplename>
    </layer>
  </instrument>
</program>`;

            const buffer = Buffer.from(xml);
            const program = mpc.newProgramFromBuffer(buffer);

            expect(program.layers).toHaveLength(2);
            expect(program.layers[0].sampleName).toBe('Inst1.WAV');
            expect(program.layers[1].sampleName).toBe('Inst2.WAV');
        });
    });

    describe("mpc.Slice interface", () => {
        it("should have correct structure", () => {
            const slice: mpc.Slice = {
                name: "TestSlice",
                start: 100,
                end: 200,
                loopStart: 150
            };

            expect(slice.name).toBe("TestSlice");
            expect(slice.start).toBe(100);
            expect(slice.end).toBe(200);
            expect(slice.loopStart).toBe(150);
        });
    });

    describe("mpc.MpcProgram interface", () => {
        it("should have correct structure", () => {
            const program: mpc.MpcProgram = {
                programName: "TestProgram",
                layers: [
                    {
                        number: 1,
                        sampleName: "Sample.WAV",
                        sliceStart: 0,
                        sliceEnd: 1000
                    }
                ]
            };

            expect(program.programName).toBe("TestProgram");
            expect(program.layers).toHaveLength(1);
        });
    });
});
