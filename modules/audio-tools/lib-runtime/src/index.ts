import {ChildProcess, spawn} from 'child_process'

export interface ExecutionResult {
    errors: Error[];
    code: number;
}

function voidFunction() {
}

export function execute(bin: string, args: readonly string[],
                        opts: {
                            onData: (buf: Buffer, child: ChildProcess) => void,
                            onStart: (child: ChildProcess) => void
                        } = {onData: voidFunction, onStart: voidFunction}) {
    return new Promise<ExecutionResult>((resolve, reject) => {
        const rv: ExecutionResult = {errors: [], code: -1}
        console.log(`execute: ${bin} ${args.join(' ')}`)
        const child = spawn(bin, args, {shell: true})
        child.stdout.setEncoding('utf8')
        opts.onStart(child)
        child.stdout.on('data', data => {
            opts.onData(data, child)
        })

        child.on('error', (e) => {
            rv.errors.push(e)
            resolve(rv)
        })
        child.on('close', (code) => {
            if (code !== null) {
                rv.code = code
                resolve(rv)
            } else {
                reject(new Error('Process terminated without an exit code.'))
            }
        })
        child.stderr.on('data', data => {
            process.stderr.write(data)
            rv.errors.push(new Error(data))
        })

        setTimeout(() => reject(new Error(`Timout executing ${bin}.`)), 30 * 1000)
    })
}

