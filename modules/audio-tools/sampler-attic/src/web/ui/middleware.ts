import type {NextRequest} from 'next/server'
import {newSequence} from "@/lib/lib-core";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {getSessionData, saveSessionData} from "@/lib/lib-session";

const seq = newSequence('smplr')
export const SESSION_COOKIE_NAME:string = 'smplr'

export async function middleware(request: NextRequest) {
    const cookieStore = await cookies()
    const res = NextResponse.next()
    if (!cookieStore.has(SESSION_COOKIE_NAME)) {
        console.log(`COOOKIE NOT FOUND!!! Setting it`)
        let sessionId = seq();
        res.cookies.set(SESSION_COOKIE_NAME, sessionId)
    }
    return res
}