import {timestamp} from "@/lib-core";
import {Result} from "@/lib-core";
import fs from "fs/promises";

export interface ProcessOutput {
    log(msg: string | Object): void

    error(msg: string | Error | Object): void

    write(data: string | Object): void
}

export type WriteFunction = (v: string | Object) => void
export type ErrorFunction = (v: string | Object | Error) => void

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


export interface Writeable {
    write(v: string | Object): void
}

export function newStreamOutput(outstream: Writeable, errstream: Writeable, debug = true, prefix = ''): ProcessOutput {
    return new BasicOutput((msg: string | Object) => outstream.write(msg), (msg) => errstream.write(msg), '\n', debug, prefix)
}

export function newServerOutput(debug = true, prefix = ''): ProcessOutput {
    return new BasicOutput((msg: string | Object) => process.stdout.write(String(msg)), (msg: string | Object) => console.error(String(msg)), '\n', debug, prefix)
}

export function newClientOutput(debug = true, prefix = ''): ProcessOutput {
    return new BasicOutput(console.info, console.error, '', debug, prefix)
}

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
