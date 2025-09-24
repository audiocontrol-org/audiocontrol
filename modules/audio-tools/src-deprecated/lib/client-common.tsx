import {newClientOutput, ProcessOutput} from "@/lib/process-output";
import {ClientConfig} from "@/lib/config-client";
import {Result, timestamp} from "@/lib/lib-core";

export interface ClientCommon {
    fetchConfig(): Promise<Result>

    saveConfig(cfg: ClientConfig): Promise<Result>

    getOutput(): ProcessOutput

    status(msg: string)

    post(url: string, obj: any): Promise<Result>

    get(url: string): Promise<Result>

}

export function newClientCommon(infoHandler: Function, errorHandler: Function) {
    return new BasicClientCommon(infoHandler, errorHandler)
}

class BasicClientCommon implements ClientCommon {
    private readonly out: ProcessOutput
    private readonly infoHandler: Function
    private readonly errorHandler: Function

    constructor(infoHandler: Function, errorHandler: Function) {
        this.infoHandler = infoHandler
        this.errorHandler = errorHandler
        this.out = newClientOutput()
    }

    status(msg) {
        this.infoHandler(timestamp() + ': ' + (msg ? msg : 'Unknown'))
    }

    error(err: string | Error | Error[]) {
        let msg = ''
        if (err instanceof Array && err.length > 0) {
            msg = err.join(', ')
        } else if (err instanceof String) {
            msg = err
        } else if (err instanceof Error) {
            msg = err.message
        } else {
            return
        }

        this.errorHandler(timestamp() + ': ' + (msg ? msg : 'Unknown'))
    }

    getOutput(): ProcessOutput {
        return this.out
    }

    fetchConfig(): Promise<Result> {
        return new Promise<Result>((resolve, reject) => {
            this.request('/api/config')
                .then((result) => resolve(result))
                .catch(err => reject(err))
        })
    }
    async saveConfig(cfg) {
        const result = await this.post('/api/config/save', cfg)
        if (result.errors.length > 0) {
            this.out.error(result.errors.join(','))
            this.status(result.errors)
        } else {
            this.status(result.data.message)
        }
        return result
    }

    get(url): Promise<Result> {
        return this.request(url, 'GET')
    }

    post(url, obj: any): Promise<Result> {
        return this.request(url, 'POST', obj)
    }

    private async request(url, method: string = 'GET', body: any = {}): Promise<Result> {
        const options: any = {method: method}
        if (method === 'POST') {
            options.body = JSON.stringify(body)
            options.headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }
        this.out.log(`options.body: ${options.body}`)
        const rv: Result = {errors: [], data: {}}
        try {
            const res = await fetch(url, options)
            let statusMessage = `${res.status}: ${res.statusText}: ${url}`;
            if (res.status == 200) {
                try {
                    this.status(statusMessage)
                    rv.data = (await res.json()).data
                    console.log(`request returning result: ${JSON.stringify(rv)}`)
                } catch (err) {
                    this.status(`Error: ${err.message}`)
                    this.out.error(err)
                    rv.errors.push(err.message)
                }

            } else {
                this.status(statusMessage)
                this.out.error(statusMessage)
                rv.errors.push(new Error(statusMessage))
            }
        } catch (err) {
            console.error(err)
            this.status(err.message)
        }
        return rv
    }
}