import { describe, it, expect } from 'vitest';
import {newServerConfig} from "@/lib-config-server";
import * as os from "os";
import fs from "fs/promises";

describe(`Server-side configuration tests`, () => {
    it(`Gets a server config.`, async () => {
        const dataDir = os.tmpdir()
        expect((await fs.stat(dataDir)).isDirectory()).toBe(true)
        const cfg = await newServerConfig(dataDir)
        expect(cfg).toBeDefined()
        expect((await fs.stat(cfg.sourceRoot)).isDirectory()).toBe(true)
        expect((await fs.stat(cfg.targetRoot)).isDirectory()).toBe(true)
        expect((await fs.stat(cfg.s3k)).isDirectory()).toBe(true)
        expect(cfg.s3kScsiId).toBeDefined()
        expect(cfg.akaiDisk).toBeDefined()
        expect(cfg.akaiTools).toBeDefined()
        expect(cfg.piscsiHost).toBeDefined()
    })
})
