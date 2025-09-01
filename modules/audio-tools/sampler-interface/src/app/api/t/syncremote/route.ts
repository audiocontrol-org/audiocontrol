import {NextRequest, NextResponse} from 'next/server.js';
import {newAkaitools, newAkaiToolsConfig} from '@oletizi/sampler-devices'

export async function POST(_request: NextRequest) {
    try {
        const akaitools = newAkaitools(await newAkaiToolsConfig())
        const result = await akaitools.remoteSync()
        if (result.errors.length > 0) {
            result.errors.forEach(e => console.error(e))
            return NextResponse.json({message: 'Not Found', status: 404})
        } else {
            return NextResponse.json({data: result.code})
        }
    } catch (e) {
        console.error(e)
        return NextResponse.json({message: `Not Found`, status: 404})
    }

}