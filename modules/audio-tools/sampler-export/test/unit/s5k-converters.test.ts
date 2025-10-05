import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertAKPToDecentSampler } from "@/converters/s5k-to-decentsampler.js";
import { convertAKPToSFZ } from "@/converters/s5k-to-sfz.js";
import * as fs from "fs";
import * as s5k from "@oletizi/sampler-devices/s5k";

// Mock modules
vi.mock("fs");
vi.mock("@oletizi/sampler-devices/s5k", () => ({
  newProgramFromBuffer: vi.fn(),
}));

describe("S5K Converters", () => {
  const mockProgram = {
    getTune: vi.fn().mockReturnValue({ semiToneTune: 0, fineTune: 0 }),
    getOutput: vi.fn().mockReturnValue({ loudness: 85, ampVelocity: 0 }),
    getKeygroups: vi.fn().mockReturnValue([
      {
        kloc: { lowNote: 36, highNote: 48, fixedPitch: false },
        ampEnvelope: { attack: 0, decay: 0, sustain: 100, release: 10 },
        filter: { cutoff: 127, resonance: 0 },
        zone1: {
          sampleName: "KICK",
          lowVelocity: 0,
          highVelocity: 127,
          tuneOffset: 0,
          level: 99,
          pan: 0,
          sampleStart: 0,
          sampleEnd: 44100,
          loopStart: 0,
          loopEnd: 44100,
        },
        zone2: { sampleName: "", lowVelocity: 0, highVelocity: 0 },
        zone3: { sampleName: "", lowVelocity: 0, highVelocity: 0 },
        zone4: { sampleName: "", lowVelocity: 0, highVelocity: 0 },
      },
    ]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.alloc(1000));
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(s5k.newProgramFromBuffer).mockReturnValue(mockProgram as any);
  });

  describe("s5k-to-decentsampler", () => {
    it("should convert AKP to DecentSampler preset", () => {
      const result = convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      expect(result).toBe("/output/test.dspreset");
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith("/source/test.akp");
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce();
    });

    it("should create valid DecentSampler XML", () => {
      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const [path, xml] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(xml).toContain("<?xml version");
      expect(xml).toContain("<DecentSampler>");
      expect(xml).toContain("<groups>");
      expect(xml).toContain("<sample");
    });

    it("should include UI elements", () => {
      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain("<ui");
      expect(xml).toContain("labeled-knob");
    });

    it("should include sample paths", () => {
      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain("path=");
      expect(xml).toContain(".wav");
    });

    it("should set correct note ranges", () => {
      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loNote="36"');
      expect(xml).toContain('hiNote="48"');
    });

    it("should handle tuning offsets", () => {
      const tunedProgram = {
        ...mockProgram,
        getTune: vi.fn().mockReturnValue({ semiToneTune: 2, fineTune: 50 }),
      };
      vi.mocked(s5k.newProgramFromBuffer).mockReturnValue(tunedProgram as any);

      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('tuning="2"');
    });

    it("should skip zones with empty sample names", () => {
      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const sampleCount = (xml.match(/<sample/g) || []).length;
      expect(sampleCount).toBe(1); // Only zone1 has a sample
    });

    it("should handle multiple keygroups", () => {
      const multiKeygroup = {
        ...mockProgram,
        getKeygroups: vi.fn().mockReturnValue([
          mockProgram.getKeygroups()[0],
          {
            ...mockProgram.getKeygroups()[0],
            kloc: { lowNote: 49, highNote: 60, fixedPitch: false },
            zone1: {
              sampleName: "SNARE",
              lowVelocity: 0,
              highVelocity: 127,
              tuneOffset: 0,
              level: 99,
              pan: 0,
              sampleStart: 0,
              sampleEnd: 44100,
              loopStart: 0,
              loopEnd: 44100,
            },
            zone2: { sampleName: "", lowVelocity: 0, highVelocity: 0 },
            zone3: { sampleName: "", lowVelocity: 0, highVelocity: 0 },
            zone4: { sampleName: "", lowVelocity: 0, highVelocity: 0 },
          },
        ]),
      };
      vi.mocked(s5k.newProgramFromBuffer).mockReturnValue(multiKeygroup as any);

      convertAKPToDecentSampler("/source/test.akp", "/output", "/samples");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loNote="36"');
      expect(xml).toContain('loNote="49"');
    });
  });

  describe("s5k-to-sfz", () => {
    it("should convert AKP to SFZ format", () => {
      const result = convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      expect(result).toBe("/output/test.sfz");
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith("/source/test.akp");
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce();
    });

    it("should create valid SFZ content", () => {
      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const [path, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(typeof content).toBe("string");
      expect(content).toContain("<region>");
      expect(content).toContain("sample=");
      expect(content).toContain(".wav");
    });

    it("should include key mappings", () => {
      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("lokey=36");
      expect(content).toContain("hikey=48");
    });

    it("should include velocity ranges when not full range", () => {
      const velocityProgram = {
        ...mockProgram,
        getKeygroups: vi.fn().mockReturnValue([
          {
            ...mockProgram.getKeygroups()[0],
            zone1: {
              ...mockProgram.getKeygroups()[0].zone1,
              lowVelocity: 64,
              highVelocity: 127,
            },
          },
        ]),
      };
      vi.mocked(s5k.newProgramFromBuffer).mockReturnValue(velocityProgram as any);

      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("lovel=64");
      expect(content).toContain("hivel=127");
    });

    it("should handle tuning offsets", () => {
      const tunedProgram = {
        ...mockProgram,
        getTune: vi.fn().mockReturnValue({ semiToneTune: 2, fineTune: 0 }),
      };
      vi.mocked(s5k.newProgramFromBuffer).mockReturnValue(tunedProgram as any);

      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("tune=");
    });

    it("should create relative sample paths", () => {
      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("sample=../samples/");
    });

    it("should skip zones with empty sample names", () => {
      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const regionCount = (content.match(/<region>/g) || []).length;
      expect(regionCount).toBe(1); // Only zone1 has a sample
    });

    it("should handle amplitude envelope settings", () => {
      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("ampeg_");
    });

    it("should handle filter settings", () => {
      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("cutoff");
    });

    it("should handle multiple zones per keygroup", () => {
      const multiZoneProgram = {
        ...mockProgram,
        getKeygroups: vi.fn().mockReturnValue([
          {
            ...mockProgram.getKeygroups()[0],
            zone2: {
              sampleName: "KICK_LAYER",
              lowVelocity: 0,
              highVelocity: 63,
              tuneOffset: 0,
              level: 50,
              pan: 0,
              sampleStart: 0,
              sampleEnd: 44100,
              loopStart: 0,
              loopEnd: 44100,
            },
          },
        ]),
      };
      vi.mocked(s5k.newProgramFromBuffer).mockReturnValue(multiZoneProgram as any);

      convertAKPToSFZ("/source/test.akp", "/output", "/samples");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      const regionCount = (content.match(/<region>/g) || []).length;
      expect(regionCount).toBe(2); // zone1 and zone2
    });
  });
});
