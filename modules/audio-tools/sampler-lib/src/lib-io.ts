import {timestamp} from "@/lib-core";
import {Result} from "@/lib-core";
import fs from "fs/promises";

/**
 * Interface for process output handling.
 *
 * @remarks
 * Provides a unified interface for logging, error reporting, and data output
 * across different execution contexts (server/client, streams, etc.).
 */
export interface ProcessOutput {
    /**
     * Logs a message (debug/info level).
     *
     * @param msg - Message string or object to log
     */
    log(msg: string | Object): void

    /**
     * Reports an error.
     *
     * @param msg - Error message, Error object, or object to report
     */
    error(msg: string | Error | Object): void

    /**
     * Writes output data.
     *
     * @param data - Data string or object to write
     */
    write(data: string | Object): void
}

/**
 * Function type for writing output data.
 */
export type WriteFunction = (v: string | Object) => void

/**
 * Function type for error reporting.
 */
export type ErrorFunction = (v: string | Object | Error) => void

/**
 * Basic implementation of ProcessOutput with configurable output functions.
 *
 * @internal
 */
class BasicOutput implements ProcessOutput {
    private readonly debug: boolean;

    private readonly writeFunction: WriteFunction
    private readonly errorFunction: ErrorFunction
    private readonly newline: string;
    private readonly prefix: string;

    constructor(writeFunction: WriteFunction, errorFunction: ErrorFunction, newline = '\n', debug = true, prefix: string) {
        this.newline = newline
        this.writeFunction = writeFunction
        this.errorFunction = errorFunction
        this.debug = debug
        this.prefix = prefix
    }

    write(msg: string | Buffer) {
        this.writeFunction(msg)
    }

    error(msg: string | Error) {
        this.errorFunction(msg)
    }

    log(msg: string | Buffer) {
        if (this.debug) {
            this.writeFunction(timestamp() + ': ' + this.prefix + ': ' + msg + this.newline)
        }
    }
}

/**
 * Minimal writable interface for stream output.
 */
export interface Writeable {
    /**
     * Writes data to the stream.
     *
     * @param v - Data to write
     */
    write(v: string | Object): void
}

/**
 * Creates a ProcessOutput instance that writes to streams.
 *
 * @param outstream - Stream for normal output
 * @param errstream - Stream for error output
 * @param debug - Whether to enable debug logging (default: true)
 * @param prefix - Prefix for log messages (default: '')
 * @returns ProcessOutput instance configured for stream output
 *
 * @example
 * ```typescript
 * const output = newStreamOutput(process.stdout, process.stderr, true, 'MyApp');
 * output.log('Starting process...');
 * output.error(new Error('Something failed'));
 * ```
 */
export function newStreamOutput(outstream: Writeable, errstream: Writeable, debug = true, prefix = ''): ProcessOutput {
    return new BasicOutput((msg: string | Object) => outstream.write(msg), (msg) => errstream.write(msg), '\n', debug, prefix)
}

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
    return new BasicOutput((msg: string | Object) => process.stdout.write(String(msg)), (msg: string | Object) => console.error(String(msg)), '\n', debug, prefix)
}

/**
 * Creates a ProcessOutput instance for client/browser environments.
 *
 * @param debug - Whether to enable debug logging (default: true)
 * @param prefix - Prefix for log messages (default: '')
 * @returns ProcessOutput instance configured for client output
 *
 * @example
 * ```typescript
 * const output = newClientOutput(true, 'UI');
 * output.log('UI component mounted');
 * output.error('Validation failed');
 * ```
 *
 * @remarks
 * Uses console.info and console.error. Does not append newlines (browser consoles handle this).
 */
export function newClientOutput(debug = true, prefix = ''): ProcessOutput {
    return new BasicOutput(console.info, console.error, '', debug, prefix)
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
