// import type {NextRequest} from 'next/server'
import {newSequence} from "@oletizi/sampler-lib";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";

const seq = newSequence('smplr')
export const SESSION_COOKIE_NAME = 'smplr'

export async function middleware() {
    const cookieStore = await cookies()
    const res = NextResponse.next()
    if (!cookieStore.has(SESSION_COOKIE_NAME)) {
        console.log(`COOKIE NOT FOUND!!! Setting it`)
        let sessionId: string = seq();
        res.cookies.set(SESSION_COOKIE_NAME, sessionId)
    }
    return res
}