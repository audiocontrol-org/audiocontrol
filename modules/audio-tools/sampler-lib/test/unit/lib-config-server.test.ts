import {newServerConfig} from "@/lib-config-server";
import {expect} from "chai";
import * as os from "os";
import fs from "fs/promises";

describe(`Server-side configuration tests`, () => {
    it(`Gets a server config.`, async () => {
        const dataDir = os.tmpdir()
        expect((await fs.stat(dataDir)).isDirectory())
        const cfg = await newServerConfig(dataDir)
        expect(cfg).exist
        expect((await fs.stat(cfg.sourceRoot)).isDirectory())
        expect((await fs.stat(cfg.targetRoot)).isDirectory())
        expect((await fs.stat(cfg.s3k)).isDirectory())
        expect(cfg.s3kScsiId).exist
        expect(cfg.akaiDisk).exist
        expect(cfg.akaiTools).exist
        expect(cfg.piscsiHost).exist
    })
})