/**
 * Type definitions for sampler backup functionality using rsnapshot
 */

export type SamplerType = "s5k" | "s3k";

export type RsnapshotInterval = "daily" | "weekly" | "monthly";

export interface SamplerConfig {
    /**
     * Sampler type identifier
     */
    type: SamplerType;

    /**
     * Remote host (e.g., "pi-scsi2.local")
     */
    host: string;

    /**
     * Remote source path to backup (e.g., "/home/pi/images/")
     */
    sourcePath: string;

    /**
     * Local backup subdirectory name (e.g., "pi-scsi2")
     */
    backupSubdir: string;
}

export interface RsnapshotConfig {
    /**
     * Root directory for snapshots
     */
    snapshotRoot: string;

    /**
     * Retention policy: interval => count
     * e.g., { daily: 7, weekly: 4, monthly: 12 }
     */
    retain: Record<RsnapshotInterval, number>;

    /**
     * Samplers to backup
     */
    samplers: SamplerConfig[];

    /**
     * Additional rsnapshot options
     */
    options?: {
        rsyncShortArgs?: string;
        rsyncLongArgs?: string;
        sshArgs?: string;
        verbose?: number;
    };
}

export interface BackupOptions {
    /**
     * Rsnapshot interval to run (default: "daily")
     */
    interval?: RsnapshotInterval;

    /**
     * Config file path (default: ~/.audiotools/rsnapshot.conf)
     */
    configPath?: string;

    /**
     * Generate config only, don't run backup
     */
    configOnly?: boolean;

    /**
     * Test mode (rsnapshot configtest)
     */
    test?: boolean;
}

export interface BackupResult {
    success: boolean;
    interval: RsnapshotInterval;
    configPath: string;
    snapshotPath?: string;
    errors: string[];
}
