/**
 * Type definitions for the audio-tools unified configuration system.
 *
 * This module provides TypeScript interfaces for the shared configuration
 * used across all audio-tools packages (backup, export, and future tools).
 *
 * @module audiotools-config/types
 */

/**
 * Main audio-tools configuration structure.
 *
 * This is the root configuration object stored in `~/.audiotools/config.json`.
 * It contains settings for all audio-tools and is extensible for future tools.
 *
 * @example
 * ```typescript
 * const config: AudioToolsConfig = {
 *   version: '1.0',
 *   backup: {
 *     backupRoot: '~/.audiotools/backup',
 *     sources: [...]
 *   },
 *   export: {
 *     outputRoot: '~/.audiotools/sampler-export/extracted',
 *     formats: ['sfz', 'decentsampler'],
 *     skipUnchanged: true,
 *     enabledSources: ['pi-scsi2']
 *   }
 * };
 * ```
 */
export interface AudioToolsConfig {
  /** Configuration schema version */
  version: string;

  /** Backup tool configuration */
  backup?: BackupConfig;

  /** Export tool configuration */
  export?: ExportConfig;

  /** Extensibility: future tools can add their config sections */
  [key: string]: any;
}

/**
 * Backup source definition.
 *
 * Represents a single backup source (remote SSH host or local media).
 * Each source has a unique name and can be independently enabled/disabled.
 *
 * @example
 * ```typescript
 * // Remote backup source
 * const remoteSource: BackupSource = {
 *   name: 'pi-scsi2',
 *   type: 'remote',
 *   source: 'pi-scsi2.local:~/images/',
 *   device: 'images',
 *   sampler: 's5000',
 *   enabled: true
 * };
 *
 * // Local backup source
 * const localSource: BackupSource = {
 *   name: 'sd-card',
 *   type: 'local',
 *   source: '/Volumes/AKAI_SD',
 *   device: 'sd-card',
 *   sampler: 's5000',
 *   enabled: true
 * };
 * ```
 */
export interface BackupSource {
  /** Unique identifier for this source (used in CLI and export config) */
  name: string;

  /** Source type: 'remote' for SSH/PiSCSI, 'local' for SD cards/USB drives */
  type: 'remote' | 'local';

  /**
   * Source path.
   * - For remote: SSH path in format 'host:path' (e.g., 'pi-scsi2.local:~/images/')
   * - For local: absolute path to mounted volume (e.g., '/Volumes/AKAI_SD')
   */
  source: string;

  /** Device/volume name for organization (e.g., 'images', 'floppy', 'sd-card') */
  device: string;

  /** Optional: Sampler model this source is associated with (e.g., 's5000', 's3000xl') */
  sampler?: string;

  /** Whether this source is enabled for backup operations */
  enabled: boolean;
}

/**
 * Backup configuration.
 *
 * Contains all backup-related settings including the backup root directory
 * and the list of configured sources.
 *
 * @example
 * ```typescript
 * const backupConfig: BackupConfig = {
 *   backupRoot: '~/.audiotools/backup',
 *   sources: [
 *     {
 *       name: 'pi-scsi2',
 *       type: 'remote',
 *       source: 'pi-scsi2.local:~/images/',
 *       device: 'images',
 *       enabled: true
 *     }
 *   ]
 * };
 * ```
 */
export interface BackupConfig {
  /** Root directory for all backups (contains subdirectories per source) */
  backupRoot: string;

  /** List of configured backup sources */
  sources: BackupSource[];
}

/**
 * Export configuration.
 *
 * Contains settings for disk image extraction and sample format conversion.
 * Controls which sources to export and what output formats to generate.
 *
 * @example
 * ```typescript
 * const exportConfig: ExportConfig = {
 *   outputRoot: '~/.audiotools/sampler-export/extracted',
 *   formats: ['sfz', 'decentsampler'],
 *   skipUnchanged: true,
 *   enabledSources: ['pi-scsi2', 'sd-card']
 * };
 * ```
 */
export interface ExportConfig {
  /** Root directory for exported/extracted content */
  outputRoot: string;

  /**
   * Output formats to generate during conversion.
   * - 'sfz': SFZ sampler format
   * - 'decentsampler': DecentSampler format
   */
  formats: ('sfz' | 'decentsampler')[];

  /**
   * Whether to skip extraction of unchanged disk images.
   * Uses modification time and checksum to detect changes.
   */
  skipUnchanged: boolean;

  /**
   * List of source names (from BackupConfig.sources) that are enabled for export.
   * Allows independent control of which sources to back up vs. export.
   */
  enabledSources: string[];
}

/**
 * Auto-discovered backup result.
 *
 * Represents a backup directory discovered during automatic scanning.
 * Used by the configuration wizard to import existing backups.
 *
 * @example
 * ```typescript
 * const discovered: DiscoveredBackup = {
 *   sampler: 's5000',
 *   device: 'images',
 *   path: '~/.audiotools/backup/s5000/images',
 *   fileCount: 15,
 *   totalSize: 3221225472, // 3 GB in bytes
 *   lastModified: new Date('2024-10-07T12:00:00Z'),
 *   inferredType: 'remote'
 * };
 * ```
 */
export interface DiscoveredBackup {
  /** Inferred sampler model (from directory structure or metadata) */
  sampler: string;

  /** Device/volume name (from directory structure) */
  device: string;

  /** Absolute path to the backup directory */
  path: string;

  /** Number of files in this backup */
  fileCount: number;

  /** Total size of all files in bytes */
  totalSize: number;

  /** Last modification time of the most recent file */
  lastModified: Date;

  /**
   * Inferred source type based on directory structure or naming.
   * - 'remote': Likely from SSH/PiSCSI backup
   * - 'local': Likely from local media backup
   */
  inferredType: 'remote' | 'local';
}
