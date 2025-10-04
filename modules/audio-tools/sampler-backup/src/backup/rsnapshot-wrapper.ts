/**
 * Rsnapshot Wrapper
 *
 * Executes rsnapshot commands for sampler backups
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, statSync, readFileSync } from "fs";
import { dirname, join } from "pathe";
import {
    getDefaultRsnapshotConfig,
    writeRsnapshotConfig,
    getDefaultConfigPath,
} from "@/config/rsnapshot-config.js";
import type {
    BackupOptions,
    BackupResult,
    RsnapshotInterval,
    RsnapshotConfig,
} from "@/types/index.js";

/**
 * Execute rsnapshot command
 */
async function executeRsnapshot(
    args: string[],
    configPath: string
): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
        const proc = spawn("rsnapshot", ["-c", configPath, ...args]);

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
            const output = data.toString();
            stdout += output;
            process.stdout.write(output); // Stream to console
        });

        proc.stderr?.on("data", (data) => {
            const output = data.toString();
            stderr += output;
            process.stderr.write(output); // Stream to console
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout });
            } else {
                resolve({
                    success: false,
                    output: stdout,
                    error: `rsnapshot exited with code ${code}: ${stderr}`,
                });
            }
        });

        proc.on("error", (err) => {
            resolve({
                success: false,
                output: stdout,
                error: `Failed to execute rsnapshot: ${err.message}`,
            });
        });
    });
}

/**
 * Check if snapshot should be rotated or resumed
 * Returns true if snapshot is from a previous day (should rotate)
 * Returns false if snapshot is from today (should resume)
 */
function shouldRotateSnapshot(snapshotRoot: string, interval: RsnapshotInterval): boolean {
    const intervalDir = join(snapshotRoot, `${interval}.0`);

    if (!existsSync(intervalDir)) {
        return true; // No existing snapshot, create new one
    }

    try {
        const stats = statSync(intervalDir);
        const snapshotDate = new Date(stats.mtime);
        const today = new Date();

        // Compare dates (ignoring time)
        const snapshotDay = snapshotDate.toISOString().split('T')[0];
        const currentDay = today.toISOString().split('T')[0];

        return snapshotDay !== currentDay; // Rotate if different day
    } catch (err) {
        return true; // On error, safer to rotate
    }
}

/**
 * Parse rsnapshot config to get snapshot root
 */
function parseSnapshotRoot(configPath: string): string {
    try {
        const configContent = readFileSync(configPath, 'utf-8');
        const match = configContent.match(/^snapshot_root\s+(.+?)\/?$/m);
        if (match) {
            return match[1].trim();
        }
    } catch (err) {
        // Fall back to default
    }
    return getDefaultRsnapshotConfig().snapshotRoot;
}

/**
 * Execute rsync directly to existing snapshot (bypass rotation)
 */
async function executeDirectRsync(
    configPath: string,
    interval: RsnapshotInterval
): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
        const snapshotRoot = parseSnapshotRoot(configPath);
        const intervalDir = join(snapshotRoot, `${interval}.0`);

        // Parse config to get backup sources
        const configContent = readFileSync(configPath, 'utf-8');
        const backupLines = configContent.split('\n').filter(line => line.match(/^backup\s+/));

        if (backupLines.length === 0) {
            resolve({
                success: false,
                output: '',
                error: 'No backup sources found in config'
            });
            return;
        }

        // Get rsync options from config
        const rsyncShortMatch = configContent.match(/^rsync_short_args\s+(.+)$/m);
        const rsyncLongMatch = configContent.match(/^rsync_long_args\s+(.+)$/m);
        const sshArgsMatch = configContent.match(/^ssh_args\s+(.+)$/m);

        const rsyncArgs: string[] = [];
        if (rsyncShortMatch) rsyncArgs.push(rsyncShortMatch[1].trim());
        if (rsyncLongMatch) rsyncArgs.push(...rsyncLongMatch[1].trim().split(/\s+/));

        // Parse first backup line (for now, handle single source)
        const backupMatch = backupLines[0].match(/^backup\s+(\S+)\s+(\S+)/);
        if (!backupMatch) {
            resolve({
                success: false,
                output: '',
                error: 'Failed to parse backup source'
            });
            return;
        }

        const [, source, destSubdir] = backupMatch;
        const destination = join(intervalDir, destSubdir);

        // Build rsync command
        const args = [...rsyncArgs, '--partial'];
        if (sshArgsMatch) {
            args.push(`--rsh=ssh ${sshArgsMatch[1].trim()}`);
        } else {
            args.push('--rsh=/usr/bin/ssh');
        }
        args.push(source, destination);

        console.log(`Resuming backup to existing snapshot: ${intervalDir}`);

        const proc = spawn('rsync', args);

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
            const output = data.toString();
            stdout += output;
            process.stdout.write(output);
        });

        proc.stderr?.on("data", (data) => {
            const output = data.toString();
            stderr += output;
            process.stderr.write(output);
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout });
            } else {
                resolve({
                    success: false,
                    output: stdout,
                    error: `rsync exited with code ${code}: ${stderr}`,
                });
            }
        });

        proc.on("error", (err) => {
            resolve({
                success: false,
                output: stdout,
                error: `Failed to execute rsync: ${err.message}`,
            });
        });
    });
}

/**
 * Test rsnapshot configuration
 */
export async function testRsnapshotConfig(
    configPath: string
): Promise<{ valid: boolean; error?: string }> {
    console.log(`Testing rsnapshot configuration: ${configPath}`);

    const result = await executeRsnapshot(["configtest"], configPath);

    if (result.success) {
        console.log("✓ Configuration is valid");
        return { valid: true };
    } else {
        console.error("✗ Configuration is invalid");
        return { valid: false, error: result.error };
    }
}

/**
 * Run rsnapshot backup
 */
export async function runBackup(
    options: BackupOptions = {}
): Promise<BackupResult> {
    const {
        interval = "daily" as RsnapshotInterval,
        configPath = getDefaultConfigPath(),
        configOnly = false,
        test = false,
    } = options;

    const result: BackupResult = {
        success: false,
        interval,
        configPath,
        errors: [],
    };

    try {
        // Ensure config directory exists
        const configDir = dirname(configPath);
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }

        // Generate or verify config
        if (!existsSync(configPath) || configOnly) {
            console.log(`Generating rsnapshot configuration: ${configPath}`);
            const config: RsnapshotConfig = getDefaultRsnapshotConfig();
            writeRsnapshotConfig(config, configPath);

            result.snapshotPath = config.snapshotRoot;

            if (configOnly) {
                console.log("✓ Configuration generated");
                result.success = true;
                return result;
            }
        }

        // Test configuration
        if (test) {
            const testResult = await testRsnapshotConfig(configPath);
            if (!testResult.valid) {
                result.errors.push(testResult.error || "Config test failed");
                return result;
            }
            result.success = true;
            return result;
        }

        // Run backup with smart rotation
        const snapshotRoot = parseSnapshotRoot(configPath);
        const shouldRotate = shouldRotateSnapshot(snapshotRoot, interval);

        console.log(`\nRunning rsnapshot ${interval} backup...`);
        console.log(`Config: ${configPath}`);

        let backupResult;

        if (shouldRotate) {
            console.log(`Creating new snapshot (rotating previous backups)\n`);
            backupResult = await executeRsnapshot([interval], configPath);
        } else {
            console.log(`Resuming today's backup (no rotation)\n`);
            backupResult = await executeDirectRsync(configPath, interval);
        }

        if (!backupResult.success) {
            result.errors.push(backupResult.error || "Backup failed");
            return result;
        }

        console.log(`\n✓ Backup complete: ${interval}`);
        result.success = true;
    } catch (err: any) {
        result.errors.push(`Backup failed: ${err.message}`);
    }

    return result;
}

/**
 * Get the latest snapshot directory
 */
export function getLatestSnapshotDir(
    snapshotRoot: string,
    interval: RsnapshotInterval = "daily"
): string {
    // rsnapshot creates directories like: daily.0, daily.1, etc.
    // daily.0 is the most recent
    return `${snapshotRoot}/${interval}.0`;
}
