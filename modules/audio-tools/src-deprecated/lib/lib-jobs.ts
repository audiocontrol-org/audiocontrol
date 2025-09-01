import {newSequence} from "@/lib/lib-core";
import path from "path";
import {newServerConfig} from "@/lib/config-server"
import fs from "fs/promises";
import {SessionId} from '@/lib/lib-session'
import Queue from "queue";

const sequence = newSequence()
const queue = new Queue({results: [], autostart: true, concurrency: 1})

export type JobId = string

export interface Progress {

    getSessionId(): SessionId

    getJobId(): JobId

    getProgress(): number

    incrementTotal(total: number)

    setCompleted(completed: number)

    incrementCompleted(i: number)

    reset()
}

export const nullProgress: Progress = {
    getSessionId() {
        return ''
    },
    getJobId() {
        return ''
    },
    reset() {
    },
    getProgress(): number {
        return 1;
    }, incrementCompleted(i: number) {
    }, setCompleted(completed: number) {
    }, incrementTotal(total: number) {
    }
}

class BasicProgress implements Progress {
    private readonly listeners = []
    private readonly sessionId: SessionId;
    private readonly jobId: JobId;

    private total: number = 0
    private completed: number = 0

    constructor(sessionId: SessionId, jobId: JobId) {
        this.sessionId = sessionId
        this.jobId = jobId
    }

    getSessionId() {
        return this.sessionId
    }

    getJobId() {
        return this.jobId
    }

    addListener(fn: (progress: number) => void) {
        this.listeners.push(fn)
    }

    private notifyListeners() {
        for (const fn of this.listeners) {
            fn(this.getProgress())
        }
    }

    // XXX: There must be a cleaner way to do this
    getProgress(): number {
        if (this.completed < 0) {
            return 0
        }
        if (this.total < 0) {
            return 0
        }
        if (this.total > 0) {
            if (this.total >= this.completed) {
                return this.completed / this.total
            } else {
                return 1
            }
        } else {
            return 0
        }
    }

    incrementCompleted(i: number) {
        this.completed += i
        this.notifyListeners()
    }

    setCompleted(completed: number) {
        this.completed = completed
        this.notifyListeners()
    }

    incrementTotal(total: number) {
        this.total += total
    }

    reset() {
        this.total = 0
        this.completed = 0
        this.notifyListeners()
    }
}


export function enqueue(sessionId: string, fn: (p: Progress) => Promise<void>): JobId {
    const jobId = sequence()
    const progress = new BasicProgress(sessionId, jobId)
    progress.addListener((p: number) => {
        saveProgressData(progress).then().catch(console.error)
    })
    queue.push(() => {
        return (fn(progress))
    })
    return jobId
}

export async function getProgress(sessionId: SessionId, jobId: JobId) {
    return (await getProgressData(sessionId, jobId)).progress
}

async function saveProgressData(progress: Progress) {
    let file = await progressDataFile(progress.getSessionId(), progress.getJobId());
    let dir = path.parse(file).dir;
    try {
        await fs.stat(dir)
    } catch (e) {
        await fs.mkdir(dir, {recursive: true})
    }

    await fs.writeFile(file, JSON.stringify({progress: progress.getProgress()}))
}

async function getProgressData(sessionId: SessionId, jobId: JobId) {
    try {
        return JSON.parse((await fs.readFile(await progressDataFile(sessionId, jobId))).toString())
    } catch (e) {
        console.error(e)
        return {progress: 1}
    }
}

async function progressDataFile(sessionId: SessionId, jobId: JobId) {
    return path.join((await newServerConfig()).jobsRoot, sessionId + '-' + jobId + '.json')
}