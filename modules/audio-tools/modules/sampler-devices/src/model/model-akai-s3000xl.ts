import {KeygroupHeader, ProgramHeader} from "@/devices/s3000xl.js";
import {Result} from "@oletizi/sampler-lib";

/**
 * Configuration for Akai tools operations.
 *
 * @remarks
 * This configuration specifies the paths and connection details needed to interact
 * with Akai disk images, either locally or via PiSCSI remote connection.
 *
 * @public
 */
export interface AkaiToolsConfig {
    /** Path to Akai disk image file (.hds, .img) */
    diskFile: string
    /** Path to directory containing akaitools executables */
    akaiToolsPath: string
    /** Optional PiSCSI host for remote operations (format: user@host) */
    piscsiHost?: string
    /** Optional SCSI ID for remote mounting (0-7) */
    scsiId?: number
}

/**
 * Akai program file structure containing header and keygroups.
 *
 * @remarks
 * An Akai program (.a3p) consists of a program header with global settings and
 * up to 99 keygroups that define sample mappings and per-keygroup parameters.
 *
 * @public
 */
export interface AkaiProgramFile {
    /** Program header with global settings (name, MIDI channel, etc.) */
    program: ProgramHeader
    /** Array of keygroups defining sample mappings and envelopes */
    keygroups: KeygroupHeader[]
}

/**
 * Types of records that can exist on an Akai disk.
 *
 * @remarks
 * The Akai disk format uses a hierarchical structure: PARTITION → VOLUME → (PROGRAM | SAMPLE)
 *
 * @public
 */
export enum AkaiRecordType {
    /** Uninitialized or unknown record type */
    NULL = 'NULL',
    /** Disk partition (up to 50 per disk) */
    PARTITION = 'S3000 PARTITION',
    /** Volume within a partition (up to 99 per partition) */
    VOLUME = 'S3000 VOLUME',
    /** Program file (.a3p) containing keygroup mappings */
    PROGRAM = 'S3000 PROGRAM',
    /** Sample file (.a3s) containing audio data */
    SAMPLE = 'S3000 SAMPLE'
}

/**
 * Base record type for Akai disk entries.
 *
 * @remarks
 * All Akai disk entries (partitions, volumes, programs, samples) share these common fields.
 *
 * @public
 */
export interface AkaiRecord {
    /** Type of record (partition, volume, program, or sample) */
    type: AkaiRecordType
    /** Name of the record (max 12 characters for programs/samples) */
    name: string
    /** Block number where record starts on disk */
    block: number
    /** Size of record in blocks */
    size: number
}

/**
 * Volume record containing programs and samples.
 *
 * @remarks
 * Volumes are the organizational containers within partitions. Each volume can contain
 * up to 999 programs and samples combined.
 *
 * @public
 */
export interface AkaiVolume extends AkaiRecord {
    /** Programs and samples contained in this volume */
    records: AkaiRecord[]
}

/**
 * Partition record containing volumes.
 *
 * @remarks
 * Partitions are the top-level organizational units on an Akai disk. Each partition
 * can contain up to 99 volumes.
 *
 * @public
 */
export interface AkaiPartition extends AkaiRecord {
    /** Volumes contained in this partition */
    volumes: AkaiVolume[]
}

/**
 * Complete Akai disk structure.
 *
 * @remarks
 * Represents the entire disk hierarchy: DISK → PARTITION → VOLUME → (PROGRAM | SAMPLE)
 *
 * @public
 */
export interface AkaiDisk {
    /** Timestamp when disk was read (Unix epoch milliseconds) */
    timestamp: number
    /** Name of the disk image file */
    name: string
    /** Partitions on the disk (typically 1-50) */
    partitions: AkaiPartition[]
}

/**
 * Result of reading an Akai disk structure.
 *
 * @remarks
 * Extends the standard Result interface with typed data field.
 *
 * @public
 */
export interface AkaiDiskResult extends Result {
    /** Parsed disk structure */
    data: AkaiDisk
}

/**
 * Result of listing Akai disk records.
 *
 * @remarks
 * Used for akaiList operations that return multiple records.
 *
 * @public
 */
export interface AkaiRecordResult extends Result {
    /** Array of records found */
    data: AkaiRecord[]
}

/**
 * Remote disk mounted on PiSCSI.
 *
 * @remarks
 * PiSCSI allows mounting disk images as SCSI devices accessible to the sampler.
 * This interface represents a mounted or mountable disk image.
 *
 * @public
 */
export interface RemoteDisk {
    /** SCSI ID (0-7) */
    scsiId: number
    /** Logical unit number (optional, typically undefined) */
    lun?: number
    /** Path to disk image file on PiSCSI host */
    image: string
}

/**
 * Result of listing remote volumes on PiSCSI.
 *
 * @public
 */
export interface RemoteVolumeResult {
    /** Array of errors encountered during operation */
    errors: Error[]
    /** Remote disks currently mounted or available */
    data: RemoteDisk[]
}
