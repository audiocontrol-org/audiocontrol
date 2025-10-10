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

/**
 * Standard chunk length for Akai program/sample data in nibbles.
 *
 * @remarks
 * Akai S3000XL uses 384-nibble chunks for program headers and keygroup data.
 * Each chunk represents one logical unit of data (program header or keygroup).
 *
 * @public
 */
export const CHUNK_LENGTH = 384;

/**
 * Number of bytes before header start in raw data backing each header.
 *
 * @remarks
 * This is an artifact of auto-generated code assuming a SysEx environment which has
 * 7 bytes of MIDI and housekeeping data in the raw MIDI data. This offset should be
 * accounted for when parsing or writing Akai data structures.
 *
 * @public
 */
export const RAW_LEADER = 7;

/**
 * Result of executing an external command (akaitools utilities).
 *
 * @public
 */
export interface ExecutionResult {
    /** Array of errors encountered during execution */
    errors: Error[];
    /** Exit code from the external command (0 = success) */
    code: number;
}

/**
 * Core Akaitools interface defining all operations for working with Akai disks.
 *
 * @remarks
 * This interface provides a complete API for interacting with Akai S3000/S5000/S6000
 * samplers including disk I/O, program/sample operations, and remote PiSCSI operations.
 *
 * @public
 */
export interface Akaitools {
    /**
     * Read complete Akai disk structure including partitions and volumes.
     *
     * @returns Promise resolving to disk structure with all partitions and volumes
     */
    readAkaiDisk: () => Promise<AkaiDiskResult>;

    /**
     * Format an Akai disk with specified partition configuration.
     *
     * @param partitionSize - Size of each partition in MB (default: 60)
     * @param partitionCount - Number of partitions to create (default: 1)
     * @returns Promise resolving to execution result
     */
    akaiFormat: (partitionSize?: number, partitionCount?: number) => Promise<ExecutionResult>;

    /**
     * Write a file from local filesystem to Akai disk.
     *
     * @param sourcePath - Path to source file on local filesystem
     * @param targetPath - Path on Akai disk
     * @param partition - Partition number (default: 1)
     * @returns Promise resolving to execution result
     */
    akaiWrite: (sourcePath: string, targetPath: string, partition?: number) => Promise<ExecutionResult>;

    /**
     * Read a file from Akai disk to local filesystem.
     *
     * @param sourcePath - Path on Akai disk
     * @param targetPath - Path to write on local filesystem
     * @param partition - Partition number (default: 1)
     * @param recursive - Whether to read recursively (default: true)
     * @returns Promise resolving to execution result
     */
    akaiRead: (sourcePath: string, targetPath: string, partition?: number, recursive?: boolean) => Promise<ExecutionResult>;

    /**
     * List contents of an Akai disk partition.
     *
     * @param akaiPath - Path within the Akai disk
     * @param partition - Partition number (default: 1)
     * @returns Promise resolving to list of records (programs, samples, volumes)
     */
    akaiList: (akaiPath: string, partition?: number) => Promise<AkaiRecordResult>;

    /**
     * Read and parse an Akai program file (.a3p).
     *
     * @param file - Path to program file
     * @returns Promise resolving to parsed program with keygroups
     */
    readAkaiProgram: (file: string) => Promise<AkaiProgramFile>;

    /**
     * Write an Akai program file (.a3p).
     *
     * @param file - Path to write to
     * @param p - Program file data with keygroups
     * @returns Promise that resolves when write is complete
     */
    writeAkaiProgram: (file: string, p: AkaiProgramFile) => Promise<void>;

    /**
     * Write an Akai sample file (.a3s).
     *
     * @param file - Path to write to
     * @param s - Sample header data
     * @returns Promise that resolves when write is complete
     */
    writeAkaiSample: (file: string, s: SampleHeader) => Promise<void>;

    /**
     * Convert WAV file to Akai sample format.
     *
     * @param sourcePath - Path to WAV file
     * @param targetPath - Path to output directory (local filesystem, NOT Akai disk)
     * @param targetName - Name for sample (must follow Akai naming: ≤12 chars, alphanumeric)
     * @returns Promise resolving to execution result
     */
    wav2Akai: (sourcePath: string, targetPath: string, targetName: string) => Promise<ExecutionResult>;

    /**
     * Convert Akai sample (.a3s) to WAV format.
     *
     * @param sourcePath - Path to .a3s file
     * @returns Promise resolving to execution result
     */
    akai2Wav: (sourcePath: string) => Promise<ExecutionResult>;

    /**
     * Synchronize local disk image to remote PiSCSI and mount it.
     *
     * @returns Promise resolving to execution result
     */
    remoteSync: () => Promise<ExecutionResult>;

    /**
     * List remote volumes on PiSCSI.
     *
     * @returns Promise resolving to list of remote volumes with SCSI IDs
     */
    remoteVolumes(): Promise<RemoteVolumeResult>;

    /**
     * Unmount a remote volume on PiSCSI.
     *
     * @param v - Remote disk to unmount
     * @returns Promise resolving to execution result
     */
    remoteUnmount(v: RemoteDisk): Promise<ExecutionResult>;

    /**
     * Mount a remote volume on PiSCSI.
     *
     * @param v - Remote disk to mount
     * @returns Promise resolving to execution result
     */
    remoteMount(v: RemoteDisk): Promise<ExecutionResult>;

    /**
     * Parse raw akailist output into structured records.
     *
     * @param data - Raw output from akailist command
     * @returns Array of parsed Akai records
     */
    parseAkaiList(data: string): import("@/index.js").AkaiRecord[];

    /**
     * Parse remote volumes output from scsictl command.
     *
     * @param data - Raw output from scsictl -l command
     * @returns Array of remote disks with SCSI IDs
     */
    parseRemoteVolumes(data: string): RemoteDisk[];
}

/**
 * Create a new AkaiToolsConfig from server configuration.
 *
 * @remarks
 * This function loads configuration from the sampler-lib server config and maps
 * it to the AkaiToolsConfig format needed for disk operations.
 *
 * @returns Promise resolving to configuration object
 * @throws {Error} If server configuration cannot be loaded
 *
 * @public
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
