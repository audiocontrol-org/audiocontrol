/**
 * Remote SSH-based backup source
 * Wraps existing rsnapshot functionality in BackupSource interface
 */

import { homedir } from 'os';
import { join } from 'pathe';
import { runBackup, testRsnapshotConfig } from '@/backup/rsnapshot-wrapper.js';
import { getDefaultRsnapshotConfig, writeRsnapshotConfig, getDefaultConfigPath } from '@/config/rsnapshot-config.js';
import type { BackupSource, RemoteSourceConfig } from '@/sources/backup-source.js';
import type { BackupResult, RsnapshotInterval, RsnapshotConfig, SamplerConfig } from '@/types/index.js';

/**
 * RemoteSource - SSH-based backup source using rsnapshot
 *
 * Wraps existing rsnapshot functionality to implement BackupSource interface.
 * Maintains backward compatibility with existing remote backup workflows.
 */
export class RemoteSource implements BackupSource {
  readonly type = 'remote' as const;

  constructor(
    private readonly config: RemoteSourceConfig,
    private readonly configPath: string = getDefaultConfigPath()
  ) {}

  /**
   * Execute remote backup using rsnapshot
   */
  async backup(interval: RsnapshotInterval): Promise<BackupResult> {
    // Generate rsnapshot config from RemoteSourceConfig
    const rsnapshotConfig = this.toRsnapshotConfig();

    // Write rsnapshot config
    writeRsnapshotConfig(rsnapshotConfig, this.configPath);

    // Run backup using existing rsnapshot wrapper
    const result = await runBackup({
      interval,
      configPath: this.configPath,
      configOnly: false,
      test: false,
    });

    return result;
  }

  /**
   * Test if remote source is accessible
   */
  async test(): Promise<boolean> {
    try {
      // Generate rsnapshot config
      const rsnapshotConfig = this.toRsnapshotConfig();
      writeRsnapshotConfig(rsnapshotConfig, this.configPath);

      // Test rsnapshot configuration
      const testResult = await testRsnapshotConfig(this.configPath);
      return testResult.valid;
    } catch (error: any) {
      console.error(`Remote source test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get source configuration
   */
  getConfig(): RemoteSourceConfig {
    return this.config;
  }

  /**
   * Convert RemoteSourceConfig to RsnapshotConfig
   */
  private toRsnapshotConfig(): RsnapshotConfig {
    const defaultConfig = getDefaultRsnapshotConfig();

    // Map RemoteSourceConfig to SamplerConfig format
    const samplerConfig: SamplerConfig = {
      type: 's5k', // Default sampler type, not critical for backup operation
      host: this.config.host,
      sourcePath: this.config.sourcePath,
      backupSubdir: this.config.backupSubdir,
    };

    return {
      ...defaultConfig,
      samplers: [samplerConfig],
    };
  }
}
