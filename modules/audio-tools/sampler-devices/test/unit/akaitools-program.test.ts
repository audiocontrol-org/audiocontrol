import { expect } from "chai";
import { readAkaiData, writeAkaiData } from "@/io/akaitools-program.js";
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('akaitools-program', () => {
    describe('readAkaiData and writeAkaiData', () => {
        let tempDir: string;
        let testFile: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akaitools-test-'));
            testFile = path.join(tempDir, 'test.a3s');
        });

        afterEach(async () => {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (e) {
                // Ignore cleanup errors
            }
        });

        it('should write and read nibbles correctly', async () => {
            const nibbles = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            await writeAkaiData(testFile, nibbles);

            const result = await readAkaiData(testFile);
            expect(result).to.deep.equal(nibbles);
        });

        it('should handle empty nibble array', async () => {
            const nibbles: number[] = [];
            await writeAkaiData(testFile, nibbles);

            const result = await readAkaiData(testFile);
            expect(result).to.be.an('array').with.length(0);
        });

        it('should preserve nibble values', async () => {
            const nibbles = [15, 14, 13, 12, 11, 10, 9, 8];
            await writeAkaiData(testFile, nibbles);

            const result = await readAkaiData(testFile);
            expect(result).to.deep.equal(nibbles);
        });

        it('should handle large nibble arrays', async () => {
            const nibbles = new Array(1000).fill(0).map((_, i) => i % 16);
            await writeAkaiData(testFile, nibbles);

            const result = await readAkaiData(testFile);
            expect(result).to.deep.equal(nibbles);
        });
    });
});
