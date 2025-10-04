import express from "express"
import path from "path"
import Queue from "queue";
import {PassThrough} from "stream";
import {newProgress} from "@/model/progress"
import {loadClientConfig, newServerConfig, saveClientConfig} from "@/lib/config-server";
import {newServerOutput} from "@/lib/process-output";
import {ClientConfig} from "@/lib/config-client";
import {Result} from "@/lib/lib-core"
import {Brain} from "@/app/brain";

const app = express()
const port = 3000
const out = newServerOutput()
const homeDir = path.join(process.env.HOME, 'Dropbox', 'Music', 'Sampler Programs')
const targetDir = path.join(process.env.HOME, 'tmp')
// const theBrain = new brain.Brain(homeDir, targetDir)
const workqueue = new Queue({results: [], autostart: true, concurrency: 1})
const progressqueue = new Queue({results: [], autostart: true, concurrency: 1})
const iostreamqueue = new Queue({results: [], autostart: true, concurrency: 1})
const iostream = new PassThrough()
const progress = newProgress()

function brain() {
    return app.get('brain')
}

iostream.pipe(process.stdout)

app.use(express.json())

app.use(express.static(path.join(process.cwd(), 'build', 'site', 'static'), {extensions: ['html']}))

app.get('/config', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    loadClientConfig().then((cfg) => {
        const result = {data: cfg}
        const body = JSON.stringify(result)
        out.log(`Sending config body: ${body}`)
        res.end(body)
    }).catch(err => {
        res.end(JSON.stringify({error: err.message}))
    })
})

app.post('/config/save', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    out.log(`Saving config...`)
    const cfg = req.body as ClientConfig
    out.log(`Config to save: ${JSON.stringify(cfg)}`)
    const result = {
        error: null,
        data: {}
    } as Result
    if (cfg && cfg.midiOutput) {
        try {
            console.log(`Trying to save config`)
            const configPath = await saveClientConfig(cfg)
            out.log(`Wrote config to: ${configPath}`)
            result.data.message = `Config saved.`
        } catch (err) {
            result.errors.push(err)
        }
    } else {
        result.data = {message: `Malformed config: ${JSON.stringify(cfg)}`}
    }
    res.end(JSON.stringify(result))
})

app.get('/list', async (req, res) => {
    let list = await brain().list();
    console.log(`Sending from list: ${list}`)
    res.send(list)
})

app.post('/cd/from', async (req, res) => {
    workqueue.push(async () => {
        iostream.write(`Moving to: ${req.query.dir}... `)
        await brain().cdFromDir(req.query.dir)
        iostream.write(`Done.\n`)
        res.send(await brain().list())
    })
})

app.post('/cd/to', async (req, res) => {
    workqueue.push(async () => {
        iostream.write(`Moving to: ${req.query.dir}... `)
        await brain().cdToDir(req.query.dir)
        iostream.write(`Done.\n`)
        res.send(await brain().list())
    })
})

app.post(`/mkdir`, async (req, res) => {
    workqueue.push(async () => {
        iostream.write(`New folder: ${req.query.dir}... `)
        await brain().newTargetDir(req.query.dir)
        iostream.write(`Done.\n`)
        res.send(await brain().list())
    })
})

app.post(`/program/translate`, async (req, res) => {
    workqueue.push(async () => {
        iostream.write(`Initiating translate... \n`)
        await brain().translate(req.query.name, iostream, progress)
        res.send(await brain().list())
        iostream.write(`Done translating ${req.query.name}.\n`)
        progress.reset()
    })
})

app.post('/rm/to', async (req, res) => {
    workqueue.push(async () => {
            iostream.write(`Removing: ${req.query.name}... `)
            await app.get('brain').rmTo(req.query.name)
            iostream.write(`Done.\n`)
            res.send(await brain().list())
        }
    )
})

app.get('/job/stream', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
    })
    iostreamqueue.shift()
    iostreamqueue.push(async () => {
        for await (const chunk of iostream) {
            res.write(chunk)
        }
        res.end()
    })
})

app.get('/job/progress', async (req, res) => {

    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
    })
    progress.addListener((currentProgress: number) => {
        progressqueue.push(async () => {
            res.write(currentProgress.toString() + '\n')
        })
    })
})

newServerConfig().then((serverConfig) => start(serverConfig))

function start(serverConfig) {
    app.set('serverConfig', serverConfig)
    app.set('brain', new Brain(serverConfig.sourceRoot, serverConfig.targetRoot))

    app.listen(port, () => {
        console.log(`Converter app listening on port ${port}`)
    })
}
