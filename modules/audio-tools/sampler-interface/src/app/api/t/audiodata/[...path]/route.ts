import {NextRequest, NextResponse} from 'next/server';
import {getSessionData, getSessionId} from '@/lib-session';
import {newServerConfig} from "@oletizi/sampler-lib"
import path from "path";
import fs from "fs/promises";

export async function GET(request: NextRequest, {params}: { params: Promise<{ path: string[] }> }) {
    try {
        const p = (await params).path.map(i => {
            return decodeURIComponent(i)
        }).join('/')
        const session = await getSessionData(await getSessionId())
        const cfg = await newServerConfig()

        const normal = path.normalize(path.join(session.translate.source.join('/'), p))
        const absolute = path.normalize(path.join(cfg.sourceRoot, normal))
        if (!absolute.startsWith(cfg.sourceRoot)) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('Source path outside of source root')
        }
        // const sample = newSampleFromBuffer(await fs.readFile(absolute))
        return new Response(await fs.readFile(absolute))
        // return NextResponse.json({
        //     message: 'Ok',
        //     status: 200,
        //     normal: normal,
        //     absolute: absolute,
        //     data: {meta: sample.getMetadata(), wav: }
        // })
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: `Not Found`, status: 404})
    }
}