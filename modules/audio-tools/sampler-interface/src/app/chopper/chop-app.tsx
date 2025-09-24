import {ClientConfig} from "@/lib/config-client";
import {ProcessOutput} from "@/lib/process-output";
import {chopSample, getAkaiDisk, syncRemote} from "@/lib/client-translator";

type AkaiDiskListener = (AkaiDisk) => void

export class ChopApp {
    private readonly config: ClientConfig;
    private readonly out: ProcessOutput;
    private readonly diskListeners: AkaiDiskListener[] = []
    constructor(config: ClientConfig, out: ProcessOutput) {
        this.config = config;
        this.out = out;
    }

    addDiskListener(l: AkaiDiskListener) {
        this.diskListeners.push(l)
    }

    fetchDisk() {
        getAkaiDisk().then(r => {
            if (r.errors.length === 0) {
                this.diskListeners.forEach(l => l(r.data))
            }
        })
    }

    chop(file: string, partition: number, prefix: string, samplesPerBeat: number, beatsPerChop: number) {
        return chopSample(file, partition, prefix, samplesPerBeat, beatsPerChop)
    }

    syncRemote() {
        return syncRemote()
    }

}