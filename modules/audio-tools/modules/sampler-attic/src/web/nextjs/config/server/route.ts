import {NextResponse} from "next/server";
import {newServerConfig} from "@/server/config-server";
export async function GET(request) {
    const cfg = await newServerConfig()
    return NextResponse.json( {data: cfg});
}