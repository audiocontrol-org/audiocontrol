import { describe, it, expect } from 'vitest';
import {newClientOutput, newServerOutput, newStreamOutput} from "@/lib-io";

describe(`Input output functions`, () => {
    it(`stream output`, () => {
        const stdoutWrites: string[] = []
        const stdout = {
            write: (v: string) => {
                stdoutWrites.push(v)
            }
        }

        const stderrWrites: string[] = []
        const stderr = {
            write: (v: string) => {
                stderrWrites.push(v)
            }
        }

        const out = newStreamOutput(stdout, stderr)
        expect(out).toBeDefined()

        expect(stdoutWrites.length).toBe(0)
        out.log(`Test`)
        expect(stdoutWrites[0].endsWith('Test\n')).toBe(true)

        out.write(`Test 2`)
        expect(stdoutWrites[1].endsWith('Test 2')).toBe(true)

        expect(stderrWrites.length).toBe(0)
        out.error('Error')
        expect(stderrWrites[0].endsWith('Error')).toBe(true)

        stdoutWrites.length = 0
        const outNoDebug = newStreamOutput(stdout, stderr, false)
        outNoDebug.log('Test')
        expect(stdoutWrites.length).toBe(0)

        outNoDebug.write('Test')
        expect(stdoutWrites.length).toBe(1)
        expect(stdoutWrites[0]).toBe('Test')

        const serverOut = newServerOutput()
        expect(serverOut).toBeDefined()

        const clientOut = newClientOutput()
        expect(clientOut).toBeDefined()
    })
})
