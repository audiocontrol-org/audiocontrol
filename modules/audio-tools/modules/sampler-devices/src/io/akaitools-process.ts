import { ChildProcess, spawn } from 'child_process';
import { ExecutionResult } from '@/io/akaitools-core.js';

/**
 * No-op function for optional callbacks
 */
function voidFunction(): void {
    // Intentionally empty
}

/**
 * Options for spawning a child process
 */
export interface SpawnOptions {
    onData: (buf: Buffer, child: ChildProcess) => void;
    onStart: (child: ChildProcess) => void;
}

/**
 * Spawn a child process and return execution results
 * @param bin Binary path to execute
 * @param args Command line arguments
 * @param opts Optional callbacks for data and start events
 * @returns Promise resolving to ExecutionResult with errors and exit code
 */
export function doSpawn(
    bin: string,
    args: readonly string[],
    opts: SpawnOptions = { onData: voidFunction, onStart: voidFunction }
): Promise<ExecutionResult> {
    return new Promise<ExecutionResult>((resolve, reject) => {
        const rv: ExecutionResult = { errors: [], code: -1 };
        console.log(`akaitools: ${bin} ${args.join(' ')}`);
        const child = spawn(bin, args as string[]);
        child.stdout.setEncoding('utf8');
        opts.onStart(child);

        child.stdout.on('data', data => {
            opts.onData(data, child);
        });

        child.on('error', (e) => {
            rv.errors.push(e);
            resolve(rv);
        });

        child.on('close', (code) => {
            if (code !== null) {
                rv.code = code;
                resolve(rv);
            } else {
                reject(new Error('Process terminated without an exit code.'));
            }
        });

        child.stderr.on('data', data => {
            process.stderr.write(data);
            rv.errors.push(new Error(data));
        });

        setTimeout(() => reject(new Error(`Timeout executing ${bin}.`)), 30 * 1000);
    });
}
