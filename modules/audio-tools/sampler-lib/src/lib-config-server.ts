import fs from "fs/promises";
import path from "pathe";
import {newServerOutput, ProcessOutput} from "@/lib-io";
import {ClientConfig, newClientConfig} from "@/lib-config-client";
import {objectFromFile} from "@/lib-io";
import {pad} from "@/lib-core";
import {mkdir} from "@/lib-fs-server"

const DEFAULT_DATA_DIR: string = path.join(process.env.HOME ? process.env.HOME : "/", '.audiotools')
const out: ProcessOutput = newServerOutput(false)

export interface ServerConfig {
    piscsiHost: string;
    s3kScsiId: number;
    akaiTools: string
    akaiDisk: string
    s3k: string
    sourceRoot: string
    targetRoot: string
    sessionRoot: string
    jobsRoot: string
    logfile: string

    getS3kDefaultProgramPath(keygroupCount: number): string;
}

async function validate(cfg: ServerConfig) {
    if (!cfg) {
        throw new Error('Config is undefined')
    }
    if (cfg.s3kScsiId === undefined) {
        throw new Error('S3000XL disk SCSI ID is undefined.')
    }
    if (!cfg.piscsiHost) {
        throw new Error('piscsi hostis undefined.')
    }
    await mkdir(cfg.sourceRoot)
    await mkdir(cfg.targetRoot)
    await mkdir(cfg.sessionRoot)
    await mkdir(cfg.s3k)
}

export async function newServerConfig(dataDir = DEFAULT_DATA_DIR): Promise<ServerConfig> {
    const targetDir = path.join(dataDir, 'target')
    const sourceDir = path.join(dataDir, 'source')
    const rv: ServerConfig = {
        piscsiHost: "pi-scsi2.local", s3kScsiId: 4,
        getS3kDefaultProgramPath(keygroupCount: number): string {
            return path.join('data', 's3000xl', 'defaults', `kg_${pad(keygroupCount, 2)}.a3p`)
        },
        sourceRoot: sourceDir,
        targetRoot: targetDir,
        jobsRoot: path.join(dataDir, 'jobs'),
        sessionRoot: path.join(dataDir, 'sessions'),
        logfile: path.join(dataDir, 'log.txt'),
        s3k: path.join(targetDir, 's3k'),
        akaiDisk: path.join(targetDir, 's3k', 'HD4.hds'),
        akaiTools: path.join(dataDir, 'akaitools-1.5')
    }
    const configPath = path.join(dataDir, 'server-config.json')
    try {
        const storedConfig = (await objectFromFile(configPath)).data
        rv.piscsiHost = storedConfig.piscsiHost
        rv.s3kScsiId = storedConfig.s3kScsiId
        rv.sourceRoot = storedConfig.sourceRoot
        rv.targetRoot = storedConfig.targetRoot
    } catch (e) {
    }
    await validate(rv)
    return rv
}

export function saveClientConfig(cfg: ClientConfig, dataDir = DEFAULT_DATA_DIR): Promise<string> {
    const configPath = path.join(dataDir, 'config.json')
    out.log(`Saving config to   : ${configPath}`)
    return new Promise((resolve, reject) => {
            ensureDataDir(dataDir)
                .then(() => fs.writeFile(configPath, JSON.stringify(cfg))
                    .then(() => resolve(configPath)))
                .catch((err) => reject(err))
                .catch((err) => reject(err))
        }
    )
}

export async function loadClientConfig(dataDir = DEFAULT_DATA_DIR): Promise<ClientConfig> {
    const rv: ClientConfig = newClientConfig()
    const configPath = path.join(dataDir, 'config.json');
    let storedConfig = null
    try {
        out.log(`Reading config from: ${configPath}`)
        storedConfig = JSON.parse((await fs.readFile(configPath)).toString())
        rv.midiOutput = storedConfig.midiOutput
        rv.midiInput = storedConfig.midiInput
    } catch (err) {
        out.log(`Error reading config from: ${configPath}: ${(err as Error).message}`)
    }
    return rv
}

function ensureDataDir(dataDir = DEFAULT_DATA_DIR) {
    return fs.stat(dataDir)
        .then(stats => {
            if (!stats.isDirectory()) {
                throw new Error(`${dataDir} is not a directory`)
            }
        })
        .catch(() => fs.mkdir(dataDir))
}
