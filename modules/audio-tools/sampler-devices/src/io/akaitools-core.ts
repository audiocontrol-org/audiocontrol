import { newServerConfig } from "@oletizi/sampler-lib";
import {
    AkaiDiskResult,
    AkaiProgramFile,
    AkaiRecordResult,
    AkaiToolsConfig,
    RemoteDisk,
    RemoteVolumeResult,
    SampleHeader
} from "@/index.js";

// Constants for Akai data processing
export const CHUNK_LENGTH = 384;

// Number of bytes before header start in the raw data backing each header.
// This is an artifact of the auto-generated code assuming a sysex environment which has 7 bytes of midi and housekeeping
// data in the raw midi data. This should probably be sorted out in the auto-generated code.
export const RAW_LEADER = 7;

/**
 * Result of executing an external command
 */
export interface ExecutionResult {
    errors: Error[];
    code: number;
}

/**
 * Core Akaitools interface - defines all operations for working with Akai disks
 */
export interface Akaitools {
    // Disk operations
    readAkaiDisk: () => Promise<AkaiDiskResult>;
    akaiFormat: (partitionSize?: number, partitionCount?: number) => Promise<ExecutionResult>;
    akaiWrite: (sourcePath: string, targetPath: string, partition?: number) => Promise<ExecutionResult>;
    akaiRead: (sourcePath: string, targetPath: string, partition?: number, recursive?: boolean) => Promise<ExecutionResult>;
    akaiList: (akaiPath: string, partition?: number) => Promise<AkaiRecordResult>;

    // Program/sample operations
    readAkaiProgram: (file: string) => Promise<AkaiProgramFile>;
    writeAkaiProgram: (file: string, p: AkaiProgramFile) => Promise<void>;
    writeAkaiSample: (file: string, s: SampleHeader) => Promise<void>;
    wav2Akai: (sourcePath: string, targetPath: string, targetName: string) => Promise<ExecutionResult>;
    akai2Wav: (sourcePath: string) => Promise<ExecutionResult>;

    // Remote operations
    remoteSync: () => Promise<ExecutionResult>;
    remoteVolumes(): Promise<RemoteVolumeResult>;
    remoteUnmount(v: RemoteDisk): Promise<ExecutionResult>;
    remoteMount(v: RemoteDisk): Promise<ExecutionResult>;

    // Parsing operations
    parseAkaiList(data: string): import("@/index.js").AkaiRecord[];
    parseRemoteVolumes(data: string): RemoteDisk[];
}

/**
 * Create a new AkaiToolsConfig from server configuration
 */
export async function newAkaiToolsConfig(): Promise<AkaiToolsConfig> {
    const cfg = await newServerConfig();
    return {
        piscsiHost: cfg.piscsiHost,
        scsiId: cfg.s3kScsiId,
        akaiToolsPath: cfg.akaiTools,
        diskFile: cfg.akaiDisk
    };
}
