/**
 * Akaitools - Main module for Akai disk operations
 *
 * This module provides a unified interface for working with Akai sampler disks.
 * It has been refactored into focused submodules while maintaining backward compatibility.
 *
 * Submodules:
 * - akaitools-core: Core interfaces, types, and configuration
 * - akaitools-disk: Disk read/write/format operations
 * - akaitools-remote: PiSCSI remote operations
 * - akaitools-program: Program and sample file operations
 * - akaitools-process: Shared child process utilities
 */

// Re-export all public APIs for backward compatibility
export * from '@/io/akaitools-core.js';
export * from '@/io/akaitools-disk.js';
export * from '@/io/akaitools-remote.js';
export * from '@/io/akaitools-program.js';

// Import necessary types and functions for the implementation
import {
    Akaitools,
    ExecutionResult
} from '@/io/akaitools-core.js';
import {
    readAkaiDisk,
    parseAkaiList,
    akaiList,
    akaiFormat,
    akaiWrite,
    akaiRead
} from '@/io/akaitools-disk.js';
import {
    parseRemoteVolumes,
    remoteVolumes,
    remoteUnmount,
    remoteMount,
    remoteSync
} from '@/io/akaitools-remote.js';
import {
    readAkaiProgram,
    writeAkaiProgram,
    writeAkaiSample,
    wav2Akai,
    akai2Wav
} from '@/io/akaitools-program.js';
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
 * Basic implementation of the Akaitools interface
 * Delegates to focused submodule functions
 */
class BasicAkaiTools implements Akaitools {
    private c: AkaiToolsConfig;

    constructor(c: AkaiToolsConfig) {
        this.c = c;
    }

    // Remote operations
    remoteMount(v: RemoteDisk): Promise<ExecutionResult> {
        return remoteMount(this.c, v);
    }

    remoteUnmount(v: RemoteDisk): Promise<ExecutionResult> {
        return remoteUnmount(this.c, v);
    }

    remoteVolumes(): Promise<RemoteVolumeResult> {
        return remoteVolumes(this.c);
    }

    parseRemoteVolumes(data: string): RemoteDisk[] {
        return parseRemoteVolumes(data);
    }

    remoteSync(): Promise<ExecutionResult> {
        return remoteSync(this.c);
    }

    // Disk operations
    readAkaiDisk(): Promise<AkaiDiskResult> {
        return readAkaiDisk(this.c, this.akaiList.bind(this));
    }

    akaiFormat(partitionSize: number = 60, partitionCount: number = 1): Promise<ExecutionResult> {
        return akaiFormat(this.c, partitionSize, partitionCount);
    }

    akaiWrite(sourcePath: string, targetPath: string, partition?: number): Promise<ExecutionResult> {
        return akaiWrite(this.c, sourcePath, targetPath, partition);
    }

    akaiRead(sourcePath: string, targetPath: string, partition?: number, recursive?: boolean): Promise<ExecutionResult> {
        return akaiRead(this.c, sourcePath, targetPath, partition, recursive);
    }

    akaiList(akaiPath: string, partition?: number): Promise<AkaiRecordResult> {
        return akaiList(this.c, akaiPath, partition);
    }

    parseAkaiList(data: string): import("@/index.js").AkaiRecord[] {
        return parseAkaiList(data);
    }

    // Program/sample operations
    readAkaiProgram(file: string): Promise<AkaiProgramFile> {
        return readAkaiProgram(file);
    }

    writeAkaiProgram(file: string, p: AkaiProgramFile): Promise<void> {
        return writeAkaiProgram(file, p);
    }

    writeAkaiSample(file: string, s: SampleHeader): Promise<void> {
        return writeAkaiSample(file, s);
    }

    wav2Akai(sourcePath: string, targetPath: string, targetName: string): Promise<ExecutionResult> {
        return wav2Akai(this.c, sourcePath, targetPath, targetName);
    }

    akai2Wav(sourcePath: string): Promise<ExecutionResult> {
        return akai2Wav(this.c, sourcePath);
    }
}

/**
 * Factory function to create a new Akaitools instance
 * @param c Configuration for Akai tools
 * @returns New Akaitools instance
 */
export function newAkaitools(c: AkaiToolsConfig): Akaitools {
    return new BasicAkaiTools(c);
}
