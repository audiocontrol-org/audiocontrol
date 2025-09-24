import {NextResponse} from "next/server"
import {newServerConfig} from "@oletizi/sampler-lib"
export async function GET() {
    const cfg = await newServerConfig()
    return NextResponse.json( {data: cfg});
}