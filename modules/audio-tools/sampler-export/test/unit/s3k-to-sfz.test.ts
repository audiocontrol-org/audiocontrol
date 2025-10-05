import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseA3P, findSampleFile, createSFZ, convertA3PToSFZ } from "@/converters/s3k-to-sfz.js";
import type { S3KProgramData } from "@/converters/s3k-to-sfz.js";
import * as fs from "fs";
import * as samplerDevices from "@oletizi/sampler-devices";
import * as s3k from "@oletizi/sampler-devices/s3k";
import { glob } from "glob";

// Mock modules
vi.mock("fs");
vi.mock("glob");
vi.mock("@oletizi/sampler-devices", () => ({
  readAkaiData: vi.fn(),
}));
vi.mock("@oletizi/sampler-devices/s3k", () => ({
  parseProgramHeader: vi.fn(),
  parseKeygroupHeader: vi.fn(),
}));

describe("S3K to SFZ Converter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseA3P", () => {
    it("should parse .a3p file and extract program data", async () => {
      const mockData = Buffer.alloc(1000);
      vi.mocked(samplerDevices.readAkaiData).mockResolvedValue(mockData);

      vi.mocked(s3k.parseProgramHeader).mockImplementation((data, offset, program: any) => {
        program.PRNAME = "TestProgram";
        program.GROUPS = 2;
        program.PRGNUM = 5;
        program.PMCHAN = 1;
        program.PLAYLO = 0;
        program.PLAYHI = 127;
      });

      vi.mocked(s3k.parseKeygroupHeader).mockImplementation((data, offset, keygroup: any) => {
        if (offset === 0xc0) {
          keygroup.SNAME1 = "KICK";
          keygroup.KGTUNO = 512; // 2.0 semitones (512/256)
          keygroup.LONOTE = 36;
          keygroup.HINOTE = 48;
          keygroup.LOVEL1 = 0;
          keygroup.HIVEL1 = 127;
          keygroup.VLOUD1 = 0;
          keygroup.VPANO1 = 0;
          keygroup.VTUNO1 = 60;
        } else {
          keygroup.SNAME1 = "SNARE";
          keygroup.KGTUNO = 0;
          keygroup.LONOTE = 49;
          keygroup.HINOTE = 60;
          keygroup.LOVEL1 = 64;
          keygroup.HIVEL1 = 127;
          keygroup.VLOUD1 = -6;
          keygroup.VPANO1 = -25;
          keygroup.VTUNO1 = 62;
        }
      });

      const result = await parseA3P("/path/test.a3p");

      expect(result.name).toBe("TestProgram");
      expect(result.midiProg).toBe(5);
      expect(result.midiChan).toBe(1);
      expect(result.lowKey).toBe(0);
      expect(result.highKey).toBe(127);
      expect(result.keygroups).toHaveLength(2);
      expect(result.keygroups[0].sampleName).toBe("KICK");
      expect(result.keygroups[0].tune).toBe(2.0);
      expect(result.keygroups[1].sampleName).toBe("SNARE");
    });

    it("should stop parsing when data length exceeded", async () => {
      const mockData = Buffer.alloc(200); // Too small for 2 keygroups
      vi.mocked(samplerDevices.readAkaiData).mockResolvedValue(mockData);

      vi.mocked(s3k.parseProgramHeader).mockImplementation((data, offset, program: any) => {
        program.PRNAME = "Test";
        program.GROUPS = 10; // More than can fit
        program.PRGNUM = 1;
        program.PMCHAN = 1;
        program.PLAYLO = 0;
        program.PLAYHI = 127;
      });

      const result = await parseA3P("/path/test.a3p");

      expect(result.keygroups).toHaveLength(0);
    });
  });

  describe("findSampleFile", () => {
    it("should find exact match", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = findSampleFile("KICK", "/samples", "program");

      expect(result).toBe("kick.wav");
      expect(vi.mocked(fs.existsSync)).toHaveBeenCalledWith("/samples/kick.wav");
    });

    it("should convert spaces to underscores", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/samples/my_sample.wav";
      });

      const result = findSampleFile("My Sample", "/samples", "program");

      expect(result).toBe("my_sample.wav");
    });

    it("should find stereo pair with -l suffix", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/samples/kick_-l.wav";
      });

      const result = findSampleFile("KICK", "/samples", "program");

      expect(result).toBe("kick_-l.wav");
    });

    it("should find stereo pair with -r suffix", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/samples/kick_-r.wav";
      });

      const result = findSampleFile("KICK", "/samples", "program");

      expect(result).toBe("kick_-r.wav");
    });

    it("should find samples using glob pattern", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(glob.sync).mockReturnValue(["/samples/myprog_kick_-l.wav"]);

      const result = findSampleFile("KICK", "/samples", "myprog");

      expect(result).toBe("myprog_kick_-l.wav");
      expect(vi.mocked(glob.sync)).toHaveBeenCalledWith("/samples/myprog*_-l.wav");
    });

    it("should return null when sample not found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(glob.sync).mockReturnValue([]);

      const result = findSampleFile("MISSING", "/samples", "program");

      expect(result).toBeNull();
    });
  });

  describe("createSFZ", () => {
    const mockProgram: S3KProgramData = {
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
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return typeof path === "string" && path.includes(".wav");
      });
    });

    it("should create SFZ file with all keygroups", () => {
      const result = createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      expect(result).toBe("/output/test.sfz");
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce();

      const [path, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(path).toBe("/output/test.sfz");
      expect(typeof content).toBe("string");
      expect(content).toContain("<region>");
      expect(content).toContain("kick.wav");
      expect(content).toContain("snare.wav");
    });

    it("should include key ranges", () => {
      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("lokey=36");
      expect(content).toContain("hikey=48");
      expect(content).toContain("lokey=49");
      expect(content).toContain("hikey=60");
    });

    it("should include velocity ranges when not full range", () => {
      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("lovel=64");
      expect(content).toContain("hivel=127");
    });

    it("should include tuning when non-zero", () => {
      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("tune=250");
    });

    it("should include volume when non-zero", () => {
      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("volume=-6");
    });

    it("should include pan when non-zero", () => {
      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("pan=-50");
    });

    it("should create relative paths to samples", () => {
      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("sample=../samples/");
    });

    it("should skip keygroups when sample not found", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return typeof path === "string" && path.includes("kick.wav");
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createSFZ(mockProgram, "/output", "/samples", "/source/test.a3p");

      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain("kick.wav");
      expect(content).not.toContain("snare.wav");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sample not found: SNARE");

      consoleWarnSpy.mockRestore();
    });
  });

  describe("convertA3PToSFZ", () => {
    beforeEach(() => {
      const mockData = Buffer.alloc(1000);
      vi.mocked(samplerDevices.readAkaiData).mockResolvedValue(mockData);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.existsSync).mockReturnValue(true);

      vi.mocked(s3k.parseProgramHeader).mockImplementation((data, offset, program: any) => {
        program.PRNAME = "Test";
        program.GROUPS = 1;
        program.PRGNUM = 1;
        program.PMCHAN = 1;
        program.PLAYLO = 0;
        program.PLAYHI = 127;
      });

      vi.mocked(s3k.parseKeygroupHeader).mockImplementation((data, offset, keygroup: any) => {
        keygroup.SNAME1 = "SAMPLE";
        keygroup.KGTUNO = 0;
        keygroup.LONOTE = 60;
        keygroup.HINOTE = 72;
        keygroup.LOVEL1 = 0;
        keygroup.HIVEL1 = 127;
        keygroup.VLOUD1 = 0;
        keygroup.VPANO1 = 0;
        keygroup.VTUNO1 = 66;
      });
    });

    it("should parse and convert .a3p to SFZ", async () => {
      const result = await convertA3PToSFZ("/source/test.a3p", "/output", "/samples");

      expect(result).toBe("/output/test.sfz");
      expect(vi.mocked(samplerDevices.readAkaiData)).toHaveBeenCalledWith("/source/test.a3p");
      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledOnce();
    });

    it("should propagate parsing errors", async () => {
      vi.mocked(samplerDevices.readAkaiData).mockRejectedValue(new Error("Read failed"));

      await expect(
        convertA3PToSFZ("/source/bad.a3p", "/output", "/samples")
      ).rejects.toThrow("Read failed");
    });
  });
});
