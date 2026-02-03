import {ChildProcess, spawn} from 'child_process'

/**
 * Result of child process execution
 * @public
 */
export interface ExecutionResult {
    /** Array of errors encountered during execution */
    errors: Error[];
    /** Exit code from child process */
    code: number;
}

/**
 * Execute a binary with arguments in a child process.
 *
 * Spawns a child process, captures stdout/stderr, and returns execution result
 * with any errors and the exit code. Includes a 30-second timeout.
 *
 * @param bin - Path to binary to execute
 * @param args - Array of command-line arguments
 * @param opts - Optional callbacks for process lifecycle events
 * @param opts.onData - Called when stdout data is received
 * @param opts.onStart - Called when child process starts
 * @returns Promise resolving to ExecutionResult with errors and exit code
 * @public
 *
 * @example
 * ```typescript
 * const result = await execute('/usr/bin/ls', ['-la', '/tmp'], {
 *   onData: (data) => console.log(data.toString()),
 *   onStart: (child) => console.log(`Started PID: ${child.pid}`)
 * });
 *
 * if (result.code === 0) {
 *   console.log('Success!');
 * } else {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 *
 * @throws Rejects promise if process terminates without exit code or on timeout
 *
 * @remarks
 * - stdout is UTF-8 encoded
 * - stderr is piped to process.stderr and collected in errors array
 * - 30-second timeout applies to entire execution
 * - Exit code null is treated as an error condition
 * - All stderr output is wrapped in Error objects
 */
export function execute(bin: string, args: readonly string[],
                        opts: {
                            onData?: (buf: Buffer, child: ChildProcess) => void,
                            onStart?: (child: ChildProcess) => void
                        } = {}) {
    return new Promise<ExecutionResult>((resolve, reject) => {
        const rv: ExecutionResult = {errors: [], code: -1}
        console.log(`execute: ${bin} ${args.join(' ')}`)
        const child = spawn(bin, args)
        child.stdout.setEncoding('utf8')
        opts.onStart?.(child)
        child.stdout.on('data', data => {
            opts.onData?.(data, child)
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
