import {NextRequest, NextResponse} from "next/server";
import {getSessionId} from "@/lib/lib-session";
import {getProgress} from "@/lib/lib-jobs";


export async function POST(request: NextRequest) {
    try {
        const data = await request.json()
        const jobId = data.jobId
        const sessionId = await getSessionId();
        const progress = await getProgress(sessionId, jobId)
        return NextResponse.json({
            sessionId: sessionId,
            jobId: jobId,
            progress: progress
        })
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: "Invalid", status: 403})
    }
}

// export async function PUT(request: NextRequest) {
//     const sessionId = await getSessionId()
//     const jobId = enqueue(sessionId, async (p: Progress) => {
//         const total = 60
//         p.incrementTotal(total)
//         for (let i = 0; i < total; i++) {
//             await new Promise(resolve => setTimeout(resolve, 1000))
//             p.incrementCompleted(1)
//         }
//     })
//     return NextResponse.json({jobId: jobId})
// }