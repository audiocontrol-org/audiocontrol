import {NextRequest, NextResponse} from "next/server";
import {getSessionData, getSessionId} from "@/lib/lib-session";
import path from "path";
import {newServerConfig} from "@/lib/config-server";
import {chop} from "@/lib/lib-translate-s3k";
import {akaiFormat, newAkaiToolsConfig, readAkaiDisk, remoteSync} from "@/akaitools/akaitools";
import fs from "fs/promises";
import {AkaiToolsConfig} from "@/model/akai";
import {syncRemote} from "@/lib/client-translator";

export async function POST(request: NextRequest) {
    try {
        const result = await remoteSync(await newAkaiToolsConfig())
        if (result.errors.length > 0) {
            result.errors.forEach(e => console.error(e))
            return NextResponse.json({message: 'Not Found', status: 404})
        } else {
            return NextResponse.json({data: result.code})
        }
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: `Not Found`, status: 404})
    }

}