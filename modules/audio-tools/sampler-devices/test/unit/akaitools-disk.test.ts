import { describe, it, expect } from "vitest";
import { parseAkaiList } from "@/io/akaitools-disk.js";
import { AkaiRecordType } from "@/index.js";

describe('akaitools-disk', () => {
    describe('parseAkaiList', () => {
        it('should parse empty data', () => {
            const result = parseAkaiList('');
            expect(result).toBeInstanceOf(Array);
            expect(result).toHaveLength(0);
        });

        it('should skip empty lines', () => {
            const data = '\n\n\n';
            const result = parseAkaiList(data);
            expect(result).toBeInstanceOf(Array);
            expect(result).toHaveLength(0);
        });

        it('should parse valid volume record', () => {
            // Format: type (0-14), block (15-24), size (25-33), name (35+)
            const data = 'S3000 VOLUME           0        60 TEST_VOL';
            const result = parseAkaiList(data);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe(AkaiRecordType.VOLUME);
            expect(result[0].block).toBe(0);
            expect(result[0].size).toBe(60);
            expect(result[0].name).toBe('TEST_VOL');
        });

        it('should parse multiple records', () => {
            const data = 'S3000 VOLUME           0        60 VOL1\nS3000 PROGRAM         10         5 PROG1';
            const result = parseAkaiList(data);
            expect(result).toHaveLength(2);
            expect(result[0].type).toBe(AkaiRecordType.VOLUME);
            expect(result[1].type).toBe(AkaiRecordType.PROGRAM);
        });

        it('should handle whitespace correctly', () => {
            const data = 'S3000 VOLUME           0        60 VOL1   ';
            const result = parseAkaiList(data);
            expect(result[0].name).toBe('VOL1');
        });

        it('should parse sample record', () => {
            const data = 'S3000 SAMPLE          10       100 SAMPLE01';
            const result = parseAkaiList(data);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe(AkaiRecordType.SAMPLE);
            expect(result[0].block).toBe(10);
            expect(result[0].size).toBe(100);
            expect(result[0].name).toBe('SAMPLE01');
        });

        it('should parse partition record', () => {
            const data = 'S3000 PARTITION        0      1000 PART1';
            const result = parseAkaiList(data);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe(AkaiRecordType.PARTITION);
        });
    });
});
