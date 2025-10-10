import {NextResponse} from "next/server";
import {newServerConfig} from "@/lib/config-server";
import {list} from "@/lib/lib-fs-server";
import {getSessionData, getSessionId} from "@/lib/lib-session";
import path from "path";
import {newServerOutput} from "@/lib/process-output";
import {FileSet} from "@/lib/lib-fs-api";

const out = newServerOutput(true, ': /api/t/list/...path/route')

export async function GET(request, {params}: { params: Promise<{ path: string[] }> }) {
    const p = (await params).path
    if (p.length == 0) {
        return NextResponse.json({message: 'Not Found', status: 404})
    }

    const location = p.shift()

    if (location !== 'source' && location !== 'target') {
        return NextResponse.json({message: 'Invalid', status: 404})
    }
    const session = await getSessionData(await getSessionId())
    let root = (await newServerConfig())[location + 'Root'];
    let dir = path.normalize(root + '/' + session.translate[location].join('/'))
    if (!dir.startsWith(root)) {
        out.error(`GET list: Invalid directory: ${dir}`)
        throw new Error('Invalid directory')
    }
    const set: FileSet = {
        directories: [], files: [], path: [].concat(session.translate[location]?.map((i) => {
            return i === '.' ? '' : i
        }))
    }
    let result = await list(dir, set, (filename) => {
        return !filename.startsWith('.DS_Store') && !filename.startsWith('DSLibraryInfo') && !filename.startsWith('.git')
    });
    if (session.translate[location].length > 0) {
        // we're in a subdirectory. Add '..'
        result.data.directories.unshift({isDirectory: true, name: ".."})
    }

    return NextResponse.json(result)
}