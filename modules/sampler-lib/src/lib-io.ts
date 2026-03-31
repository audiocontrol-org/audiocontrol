/**
 * Node.js I/O utilities for sampler-lib.
 *
 * This module contains Node.js-only code (fs, process.stdout).
 * For browser-safe output abstractions, see lib-output.ts.
 *
 * Re-exports everything from lib-output.ts for backward compatibility
 * so that existing Node.js consumers importing from lib-io continue to work.
 *
 * @packageDocumentation
 */

import { Result, timestamp } from "@/lib-core";
import fs from "fs/promises";

// Re-export all browser-safe output types and factories for backward compatibility
export * from "./lib-output"

import { type ProcessOutput } from "./lib-output";

/**
 * Creates a ProcessOutput instance for server/Node.js environments.
 *
 * @param debug - Whether to enable debug logging (default: true)
 * @param prefix - Prefix for log messages (default: '')
 * @returns ProcessOutput instance configured for server output
 *
 * @example
 * ```typescript
 * const output = newServerOutput(true, 'Server');
 * output.log('Server started');
 * output.write('Response data\n');
 * ```
 */
export function newServerOutput(debug = true, prefix = ''): ProcessOutput {
    return {
        write(msg: string | Object) {
            process.stdout.write(String(msg));
        },
        error(msg: string | Error | Object) {
            console.error(String(msg));
        },
        log(msg: string | Object) {
            if (debug) {
                process.stdout.write(timestamp() + ': ' + prefix + ': ' + msg + '\n');
            }
        }
    };
}

/**
 * Reads and parses a JSON file into an object.
 *
 * @param filename - Path to the JSON file
 * @returns Result object containing parsed data or errors
 *
 * @example
 * ```typescript
 * const result = await objectFromFile('config.json');
 * if (result.errors.length === 0) {
 *   console.log('Config:', result.data);
 * } else {
 *   console.error('Failed to load config:', result.errors);
 * }
 * ```
 *
 * @remarks
 * Returns a Result object with either parsed JSON data or file/parse errors.
 * Does not throw exceptions - errors are captured in the result.
 */
export async function objectFromFile(filename: string) {
    const rv: Result = {
        errors: [],
        data: null
    } as Result
    try {
        rv.data = JSON.parse((await fs.readFile(filename)).toString())
    } catch (e) {
        rv.errors.push(e)
    }
    return rv
}
