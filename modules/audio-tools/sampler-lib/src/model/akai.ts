import { KeygroupHeader, ProgramHeader } from "@oletizi/sampler-devices";
import { Result } from "@/lib-core";

/**
 * Configuration for Akai sampler tools operations.
 */
export interface AkaiToolsConfig {
    /** Path to the disk image file */
    diskFile: string
    /** Path to the akaitools executable */
    akaiToolsPath: string
    /** PiSCSI host address (optional) */
    piscsiHost?: string
    /** SCSI ID of the target device (optional) */
    scsiId?: number
}

/**
 * Complete Akai program file structure.
 *
 * @remarks
 * Contains the program header with global settings and
 * an array of keygroup headers defining sample mapping.
 */
export interface AkaiProgramFile {
    /** Program header with global parameters */
    program: ProgramHeader
    /** Array of keygroup headers (up to 99 keygroups) */
    keygroups: KeygroupHeader[]
}

/**
 * Types of records found in Akai disk images.
 */
export enum AkaiRecordType {
    /** Null/invalid record */
    NULL = 'NULL',
    /** S3000 partition record */
    PARTITION = 'S3000 PARTITION',
    /** S3000 volume record */
    VOLUME = 'S3000 VOLUME',
    /** S3000 program file */
    PROGRAM = 'S3000 PROGRAM',
    /** S3000 sample file */
    SAMPLE = 'S3000 SAMPLE'
}

/**
 * Base record structure for Akai disk entries.
 */
export interface AkaiRecord {
    /** Type of record */
    type: AkaiRecordType
    /** Name of the record */
    name: string
    /** Starting block number on disk */
    block: number
    /** Size in blocks */
    size: number
}

/**
 * Volume record containing files and subdirectories.
 *
 * @remarks
 * A volume is a logical container on an Akai partition
 * that holds program and sample files.
 */
export interface AkaiVolume extends AkaiRecord {
    /** Records (files) contained in this volume */
    records: AkaiRecord[]
}

/**
 * Partition record containing volumes.
 *
 * @remarks
 * Akai disks can have multiple partitions, each containing
 * multiple volumes. S3000 typically uses a single partition.
 */
export interface AkaiPartition extends AkaiRecord {
    /** Volumes contained in this partition */
    volumes: AkaiVolume[]
}

/**
 * Complete Akai disk structure.
 *
 * @remarks
 * Represents the full hierarchy of an Akai disk image:
 * disk -> partitions -> volumes -> records (files).
 */
export interface AkaiDisk {
    /** Timestamp when disk was scanned */
    timestamp: number
    /** Disk name/label */
    name: string
    /** Partitions on the disk */
    partitions: AkaiPartition[]
}

/**
 * Result type for Akai disk operations.
 */
export interface AkaiDiskResult extends Result {
    /** The disk structure data */
    data: AkaiDisk
}

/**
 * Result type for Akai record operations.
 */
export interface AkaiRecordResult extends Result {
    /** Array of record data */
    data: AkaiRecord[]
}

/**
 * Remote disk configuration for PiSCSI operations.
 *
 * @remarks
 * Used to reference disk images mounted on a PiSCSI device
 * for remote sampler communication.
 */
export interface RemoteDisk {
    /** SCSI ID of the device (0-7) */
    scsiId: number
    /** Logical Unit Number (optional, default: 0) */
    lun?: number
    /** Path to the disk image file on PiSCSI */
    image: string
}

/**
 * Result type for remote volume operations.
 */
export interface RemoteVolumeResult {
    /** Array of errors encountered */
    errors: Error[]
    /** Array of remote disk configurations */
    data: RemoteDisk[]
}
