/**
 * Audit Logger
 * 
 * Logs extraction and conversion activities for debugging and audit purposes.
 * Creates timestamped log files with detailed information about operations.
 * 
 * @module utils/audit-logger
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "pathe";
import { homedir } from "os";

export interface AuditEntry {
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    operation: string;
    disk?: string;
    message: string;
    details?: Record<string, any>;
}

export class AuditLogger {
    private logDir: string;
    private logFile: string;

    constructor(logDir?: string) {
        this.logDir = logDir || join(homedir(), '.audiotools', 'sampler-export', 'logs');
        
        // Ensure log directory exists
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }

        // Create daily log file
        const date = new Date().toISOString().split('T')[0];
        this.logFile = join(this.logDir, `extraction-${date}.log`);
    }

    private formatEntry(entry: AuditEntry): string {
        const parts = [
            entry.timestamp,
            entry.level.padEnd(5),
            `[${entry.operation}]`,
        ];

        if (entry.disk) {
            parts.push(`{${entry.disk}}`);
        }

        parts.push(entry.message);

        if (entry.details) {
            parts.push(JSON.stringify(entry.details));
        }

        return parts.join(' ') + '\n';
    }

    private log(entry: AuditEntry): void {
        const formattedEntry = this.formatEntry(entry);
        appendFileSync(this.logFile, formattedEntry);
    }

    info(operation: string, message: string, disk?: string, details?: Record<string, any>): void {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            operation,
            disk,
            message,
            details
        });
    }

    warn(operation: string, message: string, disk?: string, details?: Record<string, any>): void {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            operation,
            disk,
            message,
            details
        });
    }

    error(operation: string, message: string, disk?: string, details?: Record<string, any>): void {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            operation,
            disk,
            message,
            details
        });
    }

    conversionFailure(disk: string, programFile: string, error: string, fileHeader?: string): void {
        this.error('CONVERSION', `Failed to convert program: ${error}`, disk, {
            file: programFile,
            error,
            fileHeader
        });
    }

    diskFormatAnomaly(disk: string, anomaly: string, details?: Record<string, any>): void {
        this.warn('DISK_FORMAT', anomaly, disk, details);
    }

    extractionSummary(disk: string, stats: {
        programsFound: number;
        programsConverted: number;
        programsFailed: number;
        samplesFound: number;
        samplesConverted: number;
    }): void {
        this.info('SUMMARY', 'Extraction complete', disk, stats);
    }
}

// Singleton instance
let loggerInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
    if (!loggerInstance) {
        loggerInstance = new AuditLogger();
    }
    return loggerInstance;
}
