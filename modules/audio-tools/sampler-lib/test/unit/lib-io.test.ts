import {newClientOutput, newServerOutput, newStreamOutput} from "@/lib-io";
import {expect} from "chai";

describe(`Input output functions`, () => {
    it(`stream output`, () => {
        const stdoutWrites = []
        const stdout = {
            write: (v) => {
                stdoutWrites.push(v)
            }
        }

        const stderrWrites = []
        const stderr = {
            write: (v) => {
                stderrWrites.push(v)
            }
        }

        const out = newStreamOutput(stdout, stderr)
        expect(out).to.exist

        expect(stdoutWrites.length).eq(0)
        out.log(`Test`)
        expect(stdoutWrites[0].endsWith('Test\n'))

        out.write(`Test 2`)
        expect(stdoutWrites[1].endsWith('Test 2'))

        expect(stderrWrites.length).eq(0)
        out.error('Error')
        expect(stderrWrites[0].endsWith('Error'))

        stdoutWrites.length = 0
        const outNoDebug = newStreamOutput(stdout, stderr, false)
        outNoDebug.log('Test')
        expect(stdoutWrites.length).eq(0)

        outNoDebug.write('Test')
        expect(stdoutWrites.length).eq(1)
        expect(stdoutWrites[0]).eq('Test')

        const serverOut = newServerOutput()
        expect(serverOut).to.exist

        const clientOut = newClientOutput()
        expect(clientOut).to.exist
    })
})