import {saveClientConfig} from "@oletizi/sampler-lib"
import {NextResponse} from "next/server"

export async function POST(request) {
    const cfg = await request.json()
    try {
        await saveClientConfig(cfg)
        return NextResponse.json({data: {message: "Ok", status: 200}})
    } catch (e) {
        console.error(e)
        return NextResponse.json({data: {message: "Error", status: 500}})
    }
}