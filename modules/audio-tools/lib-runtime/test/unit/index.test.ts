import {execute} from '@/index'
import {expect} from 'chai'

describe('lib-runtime', async () => {
    it('Executes processes', async () => {
        let onStart = false
        let output = ''
        let result = await execute('echo', ['Hello'], {
            onStart: () => {
                onStart = true
            },
            onData: (buf) => {
                output += buf.toString()
            }
        })
        expect(result).to.exist
        expect(result.errors).to.exist
        expect(result.errors.length).to.eq(0)
        expect(result.code).to.eq(0)
        expect(onStart)
        expect(output).eq('Hello\n')

    })
})