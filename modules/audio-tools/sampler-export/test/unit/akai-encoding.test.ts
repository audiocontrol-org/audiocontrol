import { describe, it, expect } from "vitest";
import { akaiToAscii, asciiToAkai, akaiToFilename } from "@/utils/akai-encoding.js";

describe("Akai Encoding Utilities", () => {
    describe("akaiToAscii", () => {
        it("should convert space (0x0a)", () => {
            expect(akaiToAscii([0x0a])).toBe("");
            expect(akaiToAscii([0x1b, 0x0a, 0x1c])).toBe("A B");
        });

        it("should convert digits (0x11-0x1a)", () => {
            // 0x11 = '0', 0x12 = '1', etc.
            expect(akaiToAscii([0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a]))
                .toBe("0123456789");
        });

        it("should convert letters (0x1b-0x34)", () => {
            // 0x1b = 'A', 0x1c = 'B', etc.
            const bytes = Array.from({ length: 26 }, (_, i) => 0x1b + i);
            expect(akaiToAscii(bytes)).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        });

        it("should convert special characters", () => {
            expect(akaiToAscii([0x3c])).toBe("#");
            expect(akaiToAscii([0x3d])).toBe("+");
            expect(akaiToAscii([0x3e])).toBe("-");
            expect(akaiToAscii([0x3f])).toBe(".");
        });

        it("should convert unknown bytes to spaces and trim", () => {
            expect(akaiToAscii([0x00, 0x1b, 0x00])).toBe("A");
            expect(akaiToAscii([0xff, 0xff])).toBe("");
        });

        it("should handle Uint8Array input", () => {
            const bytes = new Uint8Array([0x1b, 0x1c, 0x1d]); // "ABC"
            expect(akaiToAscii(bytes)).toBe("ABC");
        });

        it("should convert typical sample name", () => {
            // Example: "KICK.01" encoded as:
            // K=0x25 (0x1b+10), I=0x23 (0x1b+8), C=0x1d (0x1b+2), K=0x25, .=0x3f, 0=0x11, 1=0x12
            const bytes = [0x25, 0x23, 0x1d, 0x25, 0x3f, 0x11, 0x12];
            expect(akaiToAscii(bytes)).toBe("KICK.01");
        });
    });

    describe("asciiToAkai", () => {
        it("should convert space to 0x0a", () => {
            expect(asciiToAkai(" ")).toEqual([0x0a]);
        });

        it("should convert digits", () => {
            expect(asciiToAkai("0123456789")).toEqual([
                0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a
            ]);
        });

        it("should convert lowercase letters to uppercase", () => {
            expect(asciiToAkai("abc")).toEqual([0x1b, 0x1c, 0x1d]);
        });

        it("should convert uppercase letters", () => {
            expect(asciiToAkai("ABC")).toEqual([0x1b, 0x1c, 0x1d]);
        });

        it("should convert special characters", () => {
            expect(asciiToAkai("#")).toEqual([0x3c]);
            expect(asciiToAkai("+")).toEqual([0x3d]);
            expect(asciiToAkai("-")).toEqual([0x3e]);
            expect(asciiToAkai(".")).toEqual([0x3f]);
        });

        it("should pad with spaces when length specified", () => {
            const result = asciiToAkai("AB", 5);
            expect(result).toEqual([0x1b, 0x1c, 0x0a, 0x0a, 0x0a]);
            expect(result.length).toBe(5);
        });

        it("should truncate when too long", () => {
            const result = asciiToAkai("ABCDEF", 3);
            expect(result).toEqual([0x1b, 0x1c, 0x1d]);
            expect(result.length).toBe(3);
        });

        it("should handle unknown characters as spaces", () => {
            expect(asciiToAkai("A@B")).toEqual([0x1b, 0x0a, 0x1c]);
        });

        it("should round-trip convert", () => {
            const original = "KICK.01";
            const akaiBytes = asciiToAkai(original);
            const converted = akaiToAscii(akaiBytes);
            expect(converted).toBe(original);
        });

        it("should round-trip with mixed case", () => {
            const original = "test-sample";
            const akaiBytes = asciiToAkai(original);
            const converted = akaiToAscii(akaiBytes);
            expect(converted).toBe("TEST-SAMPLE");
        });
    });

    describe("akaiToFilename", () => {
        it("should convert to lowercase", () => {
            const bytes = [0x1b, 0x1c, 0x1d]; // "ABC"
            expect(akaiToFilename(bytes)).toBe("abc");
        });

        it("should replace spaces with underscores", () => {
            const bytes = [0x1b, 0x0a, 0x1c]; // "A B"
            expect(akaiToFilename(bytes)).toBe("a_b");
        });

        it("should handle special characters safely", () => {
            const bytes = [0x25, 0x23, 0x1d, 0x25, 0x3f, 0x11, 0x12]; // "KICK.01"
            expect(akaiToFilename(bytes)).toBe("kick.01");
        });

        it("should remove invalid filename characters", () => {
            // If we somehow had invalid characters, they should be removed
            const bytes = [0x1b, 0x1c]; // "AB"
            expect(akaiToFilename(bytes)).toBe("ab");
        });

        it("should handle Uint8Array input", () => {
            const bytes = new Uint8Array([0x1b, 0x0a, 0x1c]); // "A B"
            expect(akaiToFilename(bytes)).toBe("a_b");
        });
    });
});
