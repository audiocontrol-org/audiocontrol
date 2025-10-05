import { expect } from "chai";
import { CHUNK_LENGTH, RAW_LEADER, newAkaiToolsConfig } from "@/io/akaitools-core.js";

describe('akaitools-core', () => {
    describe('Constants', () => {
        it('should define CHUNK_LENGTH', () => {
            expect(CHUNK_LENGTH).to.equal(384);
        });

        it('should define RAW_LEADER', () => {
            expect(RAW_LEADER).to.equal(7);
        });
    });

    describe('newAkaiToolsConfig', () => {
        it('should create a configuration object', async () => {
            const config = await newAkaiToolsConfig();
            expect(config).to.have.property('piscsiHost');
            expect(config).to.have.property('scsiId');
            expect(config).to.have.property('akaiToolsPath');
            expect(config).to.have.property('diskFile');
        });
    });
});
