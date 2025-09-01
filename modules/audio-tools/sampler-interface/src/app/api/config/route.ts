import {NextResponse} from "next/server";
import {loadClientConfig} from "@oletizi/sampler-lib"
export async function GET() {
    const cfg = await loadClientConfig()
    return NextResponse.json( {data: cfg});
}