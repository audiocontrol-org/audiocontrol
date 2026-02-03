import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMcopyBinary, isMcopyAvailable } from "@/utils/mtools-binary.js";
import * as fs from "fs";
import * as child_process from "child_process";

// Mock modules
vi.mock("fs");
vi.mock("child_process");

describe("MTools Binary Management", () => {
  let originalPlatform: string;
  let originalArch: string;

  beforeEach(() => {
    // Store original values
    originalPlatform = process.platform;
    originalArch = process.arch;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "arch", { value: originalArch });
  });

  function setPlatform(platform: string, arch: string) {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
    Object.defineProperty(process, "arch", { value: arch, configurable: true });
  }

  describe("detectPlatform via getMcopyBinary errors", () => {
    it("should detect darwin-arm64", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      try {
        getMcopyBinary();
      } catch (err: any) {
        expect(err.message).toContain("darwin-arm64");
      }
    });

    it("should detect darwin-x64", () => {
      setPlatform("darwin", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      try {
        getMcopyBinary();
      } catch (err: any) {
        expect(err.message).toContain("darwin-x64");
      }
    });

    it("should detect linux-x64", () => {
      setPlatform("linux", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      try {
        getMcopyBinary();
      } catch (err: any) {
        expect(err.message).toContain("linux-x64");
      }
    });

    it("should detect linux-arm64", () => {
      setPlatform("linux", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      try {
        getMcopyBinary();
      } catch (err: any) {
        expect(err.message).toContain("linux-arm64");
      }
    });

    it("should detect win32-x64", () => {
      setPlatform("win32", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      try {
        getMcopyBinary();
      } catch (err: any) {
        expect(err.message).toContain("win32-x64");
      }
    });

    it("should throw error for unsupported platform", () => {
      setPlatform("freebsd", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => getMcopyBinary()).toThrow("Unsupported platform");
    });

    it("should throw error for unsupported architecture", () => {
      setPlatform("darwin", "ia32");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => getMcopyBinary()).toThrow("Unsupported platform");
    });
  });

  describe("getBundledBinaryPath via getMcopyBinary", () => {
    it("should return bundled binary path when it exists (darwin)", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = getMcopyBinary();
      expect(result).toBeTruthy();
      expect(result).toContain("bin/mtools/darwin-arm64/mcopy");
      expect(vi.mocked(fs.existsSync)).toHaveBeenCalled();
    });

    it("should return bundled binary path when it exists (linux)", () => {
      setPlatform("linux", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = getMcopyBinary();
      expect(result).toBeTruthy();
      expect(result).toContain("bin/mtools/linux-x64/mcopy");
    });

    it("should use .exe extension on Windows", () => {
      setPlatform("win32", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = getMcopyBinary();
      expect(result).toBeTruthy();
      expect(result).toContain("bin/mtools/win32-x64/mcopy.exe");
    });

    it("should fallback to system when bundled not found", () => {
      setPlatform("darwin", "arm64");

      // First call to existsSync (bundled path) returns false
      // Second call to existsSync (system path verification) returns true
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      vi.mocked(child_process.execSync).mockReturnValue("/usr/local/bin/mcopy\n");

      const result = getMcopyBinary();
      expect(result).toBe("/usr/local/bin/mcopy");
      expect(vi.mocked(child_process.execSync)).toHaveBeenCalledWith(
        "which mcopy",
        expect.any(Object)
      );
    });
  });

  describe("getSystemBinaryPath via getMcopyBinary", () => {
    beforeEach(() => {
      // Bundled binary doesn't exist, so we test system fallback
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // Return false for bundled paths, true for system paths
        return typeof path === "string" && !path.includes("bin/mtools");
      });
    });

    it("should use 'which' command on Unix", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(child_process.execSync).mockReturnValue("/usr/local/bin/mcopy\n");

      const result = getMcopyBinary();
      expect(result).toBe("/usr/local/bin/mcopy");
      expect(vi.mocked(child_process.execSync)).toHaveBeenCalledWith(
        "which mcopy",
        expect.objectContaining({ encoding: "utf-8" })
      );
    });

    it("should use 'where' command on Windows", () => {
      setPlatform("win32", "x64");
      vi.mocked(child_process.execSync).mockReturnValue("C:\\mtools\\mcopy.exe\n");

      const result = getMcopyBinary();
      expect(result).toBe("C:\\mtools\\mcopy.exe");
      expect(vi.mocked(child_process.execSync)).toHaveBeenCalledWith(
        "where mcopy.exe",
        expect.objectContaining({ encoding: "utf-8" })
      );
    });

    it("should handle multiple paths from 'which'", () => {
      setPlatform("linux", "x64");
      vi.mocked(child_process.execSync).mockReturnValue(
        "/usr/local/bin/mcopy\n/usr/bin/mcopy\n"
      );

      const result = getMcopyBinary();
      expect(result).toBe("/usr/local/bin/mcopy");
    });

    it("should return null when 'which' throws error", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("command not found");
      });

      expect(() => getMcopyBinary()).toThrow("mcopy binary not found");
    });

    it("should return null when path doesn't exist", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockReturnValue("/usr/local/bin/mcopy\n");

      expect(() => getMcopyBinary()).toThrow("mcopy binary not found");
    });
  });

  describe("getMcopyBinary error messages", () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });
    });

    it("should provide installation instructions in error", () => {
      setPlatform("darwin", "arm64");

      try {
        getMcopyBinary();
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.message).toContain("brew install mtools");
        expect(err.message).toContain("apt install mtools");
        expect(err.message).toContain("gnu.org/software/mtools");
      }
    });

    it("should include platform in error message", () => {
      setPlatform("linux", "x64");

      try {
        getMcopyBinary();
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.message).toContain("linux-x64");
      }
    });
  });

  describe("isMcopyAvailable", () => {
    it("should return true when mcopy is found", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(isMcopyAvailable()).toBe(true);
    });

    it("should return false when mcopy is not found", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      expect(isMcopyAvailable()).toBe(false);
    });

    it("should return false on unsupported platform", () => {
      setPlatform("aix", "ppc64");
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(isMcopyAvailable()).toBe(false);
    });

    it("should handle bundled binary", () => {
      setPlatform("win32", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(isMcopyAvailable()).toBe(true);
    });

    it("should handle system binary", () => {
      setPlatform("linux", "arm64");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return typeof path === "string" && !path.includes("bin/mtools");
      });
      vi.mocked(child_process.execSync).mockReturnValue("/usr/bin/mcopy\n");

      expect(isMcopyAvailable()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string from execSync", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockReturnValue("");

      expect(() => getMcopyBinary()).toThrow("mcopy binary not found");
    });

    it("should handle whitespace-only string from execSync", () => {
      setPlatform("linux", "x64");
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockReturnValue("   \n  \n  ");

      expect(() => getMcopyBinary()).toThrow("mcopy binary not found");
    });

    it("should handle path with trailing whitespace", () => {
      setPlatform("darwin", "arm64");
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === "/usr/local/bin/mcopy";
      });
      vi.mocked(child_process.execSync).mockReturnValue("/usr/local/bin/mcopy  \n");

      const result = getMcopyBinary();
      expect(result).toBe("/usr/local/bin/mcopy");
    });
  });
});
