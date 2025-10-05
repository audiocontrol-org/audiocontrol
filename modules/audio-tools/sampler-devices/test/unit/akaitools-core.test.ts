import { describe, it, expect } from "vitest";
import { CHUNK_LENGTH, RAW_LEADER, newAkaiToolsConfig } from "@/io/akaitools-core.js";

describe('akaitools-core', () => {
    describe('Constants', () => {
        it('should define CHUNK_LENGTH', () => {
            expect(CHUNK_LENGTH).toBe(384);
        });

        it('should define RAW_LEADER', () => {
            expect(RAW_LEADER).toBe(7);
        });
    });

    describe('newAkaiToolsConfig', () => {
        it('should create a configuration object', async () => {
            const config = await newAkaiToolsConfig();
            expect(config).toHaveProperty('piscsiHost');
            expect(config).toHaveProperty('scsiId');
            expect(config).toHaveProperty('akaiToolsPath');
            expect(config).toHaveProperty('diskFile');
        });
    });
});
