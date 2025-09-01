import {NextRequest, NextResponse} from "next/server";
import {getSessionData, getSessionId} from "@/lib/lib-session";
import path from "path";
import {newServerConfig} from "@/lib/config-server";
import {chop} from "@/lib/lib-translate-s3k";
import {akaiFormat, newAkaiToolsConfig, readAkaiDisk, remoteSync} from "@/akaitools/akaitools";
import fs from "fs/promises";
import {AkaiToolsConfig} from "@/model/akai";

export async function GET(request: NextRequest) {
    try {
        return NextResponse.json(await readAkaiDisk(await newAkaiToolsConfig()))
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: `Not Found`, status: 404})
    }

}