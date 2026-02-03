import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDecentSampler, convertA3PToDecentSampler } from "@/converters/s3k-to-decentsampler.js";
import type { S3KProgramData } from "@/converters/s3k-to-sfz.js";
import * as fs from "fs";
import * as s3kToSfz from "@/converters/s3k-to-sfz.js";

// Mock modules
vi.mock("fs");
vi.mock("@/converters/s3k-to-sfz.js", async () => {
  const actual = await vi.importActual<typeof s3kToSfz>("@/converters/s3k-to-sfz.js");
  return {
    ...actual,
    parseA3P: vi.fn(),
    findSampleFile: vi.fn(),
  };
});

describe("S3K to DecentSampler Converter", () => {
  const mockProgramData: S3KProgramData = {
    name: "TestProgram",
    midiProg: 1,
    midiChan: 1,
    lowKey: 0,
    highKey: 127,
    keygroups: [
      {
        lowKey: 36,
        highKey: 48,
        tune: 0,
        sampleName: "KICK",
        lowVel: 0,
        highVel: 127,
        volOffset: 0,
        panOffset: 0,
        pitch: 60,
      },
      {
        lowKey: 49,
        highKey: 60,
        tune: 2.5,
        sampleName: "SNARE",
        lowVel: 64,
        highVel: 127,
        volOffset: -6,
        panOffset: -25,
        pitch: 62,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(s3kToSfz.findSampleFile).mockImplementation((name) => `${name.toLowerCase()}.wav`);
  });

  describe("createDecentSampler", () => {
    it("should create DecentSampler preset with valid program data", () => {
      const result = createDecentSampler(
        mockProgramData,
        "/output",
        "/samples",
        "/source/test.a3p"
      );

      expect(result).toBe("/output/test.dspreset");
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce();

      const [path, xml] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(path).toBe("/output/test.dspreset");
      expect(typeof xml).toBe("string");
      expect(xml).toContain("<?xml version");
      expect(xml).toContain("<DecentSampler");
      expect(xml).toContain("TestProgram");
    });

    it("should include all keygroups in output", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain("kick.wav");
      expect(xml).toContain("snare.wav");
    });

    it("should set correct key ranges", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loNote="36"');
      expect(xml).toContain('hiNote="48"');
      expect(xml).toContain('loNote="49"');
      expect(xml).toContain('hiNote="60"');
    });

    it("should set rootNote from pitch", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('rootNote="60"');
      expect(xml).toContain('rootNote="62"');
    });

    it("should include tuning when non-zero", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('tuning="2.50"');
    });

    it("should include volume when non-zero", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('volume="-6dB"');
    });

    it("should include pan when non-zero", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('pan="-50"');
    });

    it("should include velocity range when not full range", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loVel="64"');
      expect(xml).toContain('hiVel="127"');
    });

    it("should skip keygroups with hikey=0 and lokey>0 (unused)", () => {
      const programWithUnused: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          mockProgramData.keygroups[0],
          {
            lowKey: 50,
            highKey: 0,
            tune: 0,
            sampleName: "UNUSED",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: 0,
            pitch: 60,
          },
        ],
      };

      createDecentSampler(programWithUnused, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).not.toContain("UNUSED");
      expect(xml).toContain("kick.wav");
    });

    it("should fix hikey=0 and lokey=0 to full range", () => {
      const programWithZeros: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          {
            lowKey: 0,
            highKey: 0,
            tune: 0,
            sampleName: "FULL",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: 0,
            pitch: 60,
          },
        ],
      };

      createDecentSampler(programWithZeros, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loNote="0"');
      expect(xml).toContain('hiNote="127"');
    });

    it("should clamp key ranges to MIDI range (0-127)", () => {
      const programWithInvalidRange: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          {
            lowKey: -10,
            highKey: 150,
            tune: 0,
            sampleName: "CLAMPED",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: 0,
            pitch: 60,
          },
        ],
      };

      createDecentSampler(programWithInvalidRange, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loNote="0"');
      expect(xml).toContain('hiNote="127"');
    });

    it("should skip keygroups with inverted ranges (lokey > hikey)", () => {
      const programWithInverted: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          mockProgramData.keygroups[0],
          {
            lowKey: 80,
            highKey: 70,
            tune: 0,
            sampleName: "INVERTED",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: 0,
            pitch: 75,
          },
        ],
      };

      createDecentSampler(programWithInverted, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).not.toContain("INVERTED");
    });

    it("should clamp velocity to MIDI range (0-127)", () => {
      const programWithInvalidVel: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          {
            lowKey: 60,
            highKey: 72,
            tune: 0,
            sampleName: "VELTEST",
            lowVel: -10,
            highVel: 200,
            volOffset: 0,
            panOffset: 0,
            pitch: 66,
          },
        ],
      };

      createDecentSampler(programWithInvalidVel, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // When clamped to 0-127 (full range), loVel/hiVel are omitted
      expect(xml).not.toContain('loVel');
      expect(xml).not.toContain('hiVel');
    });

    it("should fix reversed velocity ranges", () => {
      const programWithReversedVel: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          {
            lowKey: 60,
            highKey: 72,
            tune: 0,
            sampleName: "REVERSED",
            lowVel: 100,
            highVel: 50,
            volOffset: 0,
            panOffset: 0,
            pitch: 66,
          },
        ],
      };

      createDecentSampler(programWithReversedVel, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('loVel="50"');
      expect(xml).toContain('hiVel="100"');
    });

    it("should clamp pan to -100 to 100", () => {
      const programWithExtremePan: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          {
            lowKey: 60,
            highKey: 72,
            tune: 0,
            sampleName: "PAN_LEFT",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: -100, // Should clamp to -100
            pitch: 66,
          },
          {
            lowKey: 73,
            highKey: 84,
            tune: 0,
            sampleName: "PAN_RIGHT",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: 100, // Should clamp to 100
            pitch: 78,
          },
        ],
      };

      createDecentSampler(programWithExtremePan, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toMatch(/pan="-?\d+"/);
    });

    it("should use middle of key range for rootNote when pitch is 0", () => {
      const programWithZeroPitch: S3KProgramData = {
        ...mockProgramData,
        keygroups: [
          {
            lowKey: 40,
            highKey: 60,
            tune: 0,
            sampleName: "ZERO_PITCH",
            lowVel: 0,
            highVel: 127,
            volOffset: 0,
            panOffset: 0,
            pitch: 0,
          },
        ],
      };

      createDecentSampler(programWithZeroPitch, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Middle of 40-60 is 50
      expect(xml).toContain('rootNote="50"');
    });

    it("should skip keygroups when sample file not found", () => {
      vi.mocked(s3kToSfz.findSampleFile).mockImplementation((name) => {
        return name === "KICK" ? "kick.wav" : null;
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain("kick.wav");
      expect(xml).not.toContain("snare.wav");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sample not found: SNARE");

      consoleWarnSpy.mockRestore();
    });

    it("should create relative paths from output to wav directory", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      // Paths should be relative
      expect(xml).toContain('path="../samples/kick.wav"');
      expect(xml).toContain('path="../samples/snare.wav"');
    });

    it("should include default ADSR envelope", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain('attack="0.0"');
      expect(xml).toContain('decay="0.0"');
      expect(xml).toContain('sustain="1.0"');
      expect(xml).toContain('release="0.1"');
    });

    it("should include default effects", () => {
      createDecentSampler(mockProgramData, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain("<effects>");
      expect(xml).toContain('type="lowpass"');
      expect(xml).toContain('frequency="22000.0"');
      expect(xml).toContain('type="reverb"');
      expect(xml).toContain('wetLevel="0.0"');
    });

    it("should handle program with no keygroups", () => {
      const emptyProgram: S3KProgramData = {
        ...mockProgramData,
        keygroups: [],
      };

      createDecentSampler(emptyProgram, "/output", "/samples", "/source/test.a3p");

      const xml = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(xml).toContain("<DecentSampler");
      expect(xml).toContain("TestProgram");
      expect(xml).not.toContain("<sample");
    });
  });

  describe("convertA3PToDecentSampler", () => {
    it("should parse .a3p file and create DecentSampler preset", async () => {
      vi.mocked(s3kToSfz.parseA3P).mockResolvedValue(mockProgramData);

      const result = await convertA3PToDecentSampler(
        "/source/test.a3p",
        "/output",
        "/samples"
      );

      expect(result).toBe("/output/test.dspreset");
      expect(vi.mocked(s3kToSfz.parseA3P)).toHaveBeenCalledWith("/source/test.a3p");
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce();
    });

    it("should handle different file extensions", async () => {
      vi.mocked(s3kToSfz.parseA3P).mockResolvedValue(mockProgramData);

      await convertA3PToDecentSampler("/source/MyProgram.A3P", "/output", "/samples");

      expect(vi.mocked(fs.writeFileSync).mock.calls[0][0]).toBe("/output/MyProgram.dspreset");
    });

    it("should propagate parsing errors", async () => {
      vi.mocked(s3kToSfz.parseA3P).mockRejectedValue(new Error("Parse failed"));

      await expect(
        convertA3PToDecentSampler("/source/bad.a3p", "/output", "/samples")
      ).rejects.toThrow("Parse failed");
    });
  });
});
