import {newServerConfig, objectFromFile} from "@oletizi/sampler-lib";
import fs from "fs/promises";
import {SESSION_COOKIE_NAME} from "@/middleware";
import {cookies} from "next/headers";

export type SessionId = string

export interface SessionData {
    progress: number
    translate: {
        source: string[],
        target: string[]
    }
}


export async function getSessionId():Promise<SessionId> {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(SESSION_COOKIE_NAME)
    return (cookie ? cookie.value : '') as SessionId
}

async function sessionDataFile(sessionId: SessionId) {
    return (await newServerConfig()).sessionRoot + '/' + sessionId + '.json'
}

export async function getSessionData(sessionId: SessionId): Promise<SessionData> {
    let rv: SessionData = {progress: 1, translate: {source: [], target: []}}
    try {
        const result = await objectFromFile(await sessionDataFile(sessionId))
        if (result.errors.length == 0) {
            rv = result.data
        }
    } catch (e) {
    }
    return rv
}

export async function saveSessionData(sessionId: SessionId, data: SessionData) {
    await fs.writeFile(await sessionDataFile(sessionId), JSON.stringify(data))
}