import {KeygroupHeader, ProgramHeader} from "@/devices/s3000xl.js";
import {Result} from "@oletizi/sampler-lib";

export interface AkaiToolsConfig {
    diskFile: string
    akaiToolsPath: string
    piscsiHost?: string
    scsiId?: number
}

export interface AkaiProgramFile {
    program: ProgramHeader
    keygroups: KeygroupHeader[]
}

export enum AkaiRecordType {
    NULL = 'NULL',
    PARTITION = 'S3000 PARTITION',
    VOLUME = 'S3000 VOLUME',
    PROGRAM = 'S3000 PROGRAM',
    SAMPLE = 'S3000 SAMPLE'
}

export interface AkaiRecord {
    type: AkaiRecordType
    name: string
    block: number
    size: number
}

export interface AkaiVolume extends AkaiRecord {
    records: AkaiRecord[]
}

export interface AkaiPartition extends AkaiRecord {
    volumes: AkaiVolume[]
}

export interface AkaiDisk {
    timestamp: number
    name: string
    partitions: AkaiPartition[]
}

export interface AkaiDiskResult extends Result {
    data: AkaiDisk
}

export interface AkaiRecordResult extends Result {
    data: AkaiRecord[]
}

export interface RemoteDisk {
    scsiId: number
    lun?: number
    image: string
}

export interface RemoteVolumeResult {
    errors: Error[]
    data: RemoteDisk[]
}