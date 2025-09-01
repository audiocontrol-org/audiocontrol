import {NextResponse} from "next/server";
import {newAkaiToolsConfig, readAkaiDisk} from "@oletizi/sampler-devices/s3k";

export async function GET() {
    try {
        return NextResponse.json(await readAkaiDisk(await newAkaiToolsConfig()))
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: `Not Found`, status: 404})
    }

}