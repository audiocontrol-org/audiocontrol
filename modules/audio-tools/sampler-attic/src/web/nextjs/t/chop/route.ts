import {NextRequest, NextResponse} from "next/server";
import {getSessionData, getSessionId} from "@/lib/lib-session";
import path from "path";
import {newServerConfig} from "@/lib/config-server";
import {chop} from "@/lib/lib-translate-s3k";
import {akaiFormat, newAkaiToolsConfig, remoteSync} from "@/akaitools/akaitools";
import fs from "fs/promises";
import {AkaiToolsConfig} from "@/model/akai";

export async function POST(request: NextRequest) {
    try {
        const session = await getSessionData(await getSessionId())
        const cfg = await newServerConfig()
        const akaiToolsConfig: AkaiToolsConfig = await newAkaiToolsConfig() //{akaiToolsPath: cfg.akaiTools, diskFile: cfg.akaiDisk}
        // try {
        //     const stats = await fs.stat(cfg.akaiDisk)
        //     if (! stats.isFile()) {
        //         throw new Error(`Akai disk is not a regular file: ${cfg.akaiDisk}`)
        //     }
        // } catch (e) {
        //     const result = await akaiFormat(akaiToolsConfig, 60)
        //     if (result.errors.length > 0) {
        //         result.errors.forEach(e => console.error(e))
        //         throw new Error('Error formatting Akai disk.')
        //     }
        // }
        const data = await request.json();
        if (! data.samplesPerBeat) {
            throw new Error('Samples per beat undefined.')
        }
        if (!data.beatsPerChop) {
            throw new Error('Beats per chop undefined.')
        }
        if (!data.prefix) {
            throw new Error('Prefix undefined')
        }

        const normal = path.normalize(path.join(session.translate.source.join('/'), data.path))
        const absolute = path.normalize(path.join(cfg.sourceRoot, normal))
        if (!absolute.startsWith(cfg.sourceRoot)) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('Source path is outside source root.')
        }

        const target = path.normalize(path.join(cfg.s3k, data.prefix))
        if (! target.startsWith(cfg.targetRoot)) {
            throw new Error(`Target path is outside target root.
  target root: ${cfg.targetRoot}
  target path: ${target}`)
        }

        const opts = {
            source: absolute,
            target: target,
            partition: data.partition,
            prefix: data.prefix,
            samplesPerBeat: data.samplesPerBeat,
            beatsPerChop: data.beatsPerChop,
            wipeDisk: false
        }
        // const result = await chop(akaiToolsConfig, absolute, target, data.prefix, data.samplesPerBeat, data.beatsPerChop)
        const result = await chop(akaiToolsConfig, opts)
        console.log(`Done choppping.`)
        if (result.errors.length > 0) {
            result.errors.forEach(e => console.error(e))
            throw new Error('Barf!')
        }

        return NextResponse.json({
            errors: result.errors,
            code: result.code,
            message: result.errors.length === 0 ? 'Ok' : "Error",
            status: result.errors.length === 0 ? 200 : 500,
            normal: normal,
            absolute: absolute,
            prefix: data.prefix,
            samplesPerBeat: data.samplesPerBeat,
            beatsPerChop: data.beatsPerChop
        })
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: `Not Found`, status: 404})
    }

}