import {FileSetResult} from "@/lib/lib-fs-api";
import {newClientCommon} from "@/lib/client-common";
import {JobId} from "@/lib/lib-jobs";
import {WaveFile} from "wavefile";
import {Result} from "@/lib/lib-core";
import {newSampleFromBuffer, Sample} from "@/model/sample";

const root = '/api/t'
const client = newClientCommon((msg) => console.log(msg), (msg) => console.error(msg))

export async function getProgress(jobId: JobId) {
    return await client.post(root + '/progress', {jobId: jobId})
}

export async function chopSample(path: string, partition: number, prefix: string, samplesPerBeat: number, beatsPerChop: number) {
    return await client.post(root + '/chop', {
        path: path, partition: partition, prefix: prefix, samplesPerBeat: samplesPerBeat, beatsPerChop: beatsPerChop
    })
}

export async function syncRemote() {
    return await client.post(root + '/syncremote', {})
}

export async function getAkaiDisk() {
    return client.get(root + '/akaidisk')
}

export async function getMeta(path: string) {
    return client.get(root + '/meta/' + path)
}

export interface AudioDataResult extends Result {
    data: ArrayBuffer
    sample: Sample
}

export async function getAudioData(path: string) {
    const r = await fetch(root + '/audiodata/' + path)
    const rv = {errors: [], data: null, sample: null} as AudioDataResult

    if (r.ok) {
        rv.data = await r.arrayBuffer()
        rv.sample = newSampleFromBuffer(new Uint8Array(rv.data))
        // r.blob().then(b => b.arrayBuffer().then(buf => wav.fromBuffer(new Uint8Array(buf))))
    } else {
        rv.errors.push(new Error(r.statusText))
    }
    return rv
}

export async function translate(path: string) {
    return client.post(root + '/translate', {path: path})
}

export async function cdSource(path: string) {
    await cd(root + '/cd/source', path)
}

export async function cdTarget(path: string) {
    await cd(root + '/cd/target', path)
}

async function cd(endpoint: string, path: string) {
    await client.post(endpoint, {path: path})
}

export async function listSource(filter: (f: File) => boolean = () => true): Promise<FileSetResult> {
    return list(root + '/list/source', filter)
}

export async function listTarget(filter: (f: File) => boolean = () => true) {
    return list(root + '/list/target', filter)
}

async function list(endpoint, filter: (f: File) => boolean) {

    const rv = await client.get(endpoint) as FileSetResult

    if (rv.data.directories) {
        rv.data.directories = rv.data.directories.filter((f) => filter(f as File))
    }
    if (rv.data.files) {
        rv.data.files = rv.data.files.filter(i => filter(i as File))
    }
    return rv
}

export async function mkdirSource(path) {
    await mkdir(root + '/mkdir/source', path)
}

export async function mkdirTarget(path) {
    await mkdir(root + '/mkdir/target', path)
}

async function mkdir(endpoint, path) {
    await client.post(endpoint, {path: path})
}

export async function rmTarget(path: string) {
    await rm(root + '/rm/target', path)
}

async function rm(endpoint, path) {
    await client.post(endpoint, {path: path})
}