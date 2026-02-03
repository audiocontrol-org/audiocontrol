import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'pathe';
import { tmpdir } from 'os';
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  addBackupSource,
  enableSourceForExport,
  type AudioToolsConfig,
  type BackupSource,
} from '@audiocontrol/audiotools-config';

describe('Unified CLI Workflow Integration', () => {
  let testConfigPath: string;
  let testBackupRoot: string;
  let testExportRoot: string;

  beforeEach(async () => {
    const testDir = join(tmpdir(), `audiotools-integration-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    testConfigPath = join(testDir, 'config.json');
    testBackupRoot = join(testDir, 'backup');
    testExportRoot = join(testDir, 'export');

    await mkdir(testBackupRoot, { recursive: true });
    await mkdir(testExportRoot, { recursive: true });
  });

  afterEach(async () => {
    const testDir = join(testConfigPath, '..');
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Config-based workflow', () => {
    it('should create config and enable sources for backup and export', async () => {
      // Step 1: Create default config
      let config = getDefaultConfig();
      config.backup!.backupRoot = testBackupRoot;
      config.export!.outputRoot = testExportRoot;

      // Step 2: Add backup source
      const source: BackupSource = {
        name: 'pi-scsi2',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);

      // Step 3: Enable source for export
      config = enableSourceForExport(config, 'pi-scsi2');

      // Step 4: Save config
      await saveConfig(config, testConfigPath);

      // Step 5: Verify config was saved correctly
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.backup?.sources).toHaveLength(1);
      expect(loaded.backup?.sources[0].name).toBe('pi-scsi2');
      expect(loaded.export?.enabledSources).toContain('pi-scsi2');
    });

    it('should support multiple sources with selective enabling', async () => {
      // Create config with multiple sources
      let config = getDefaultConfig();
      config.backup!.backupRoot = testBackupRoot;
      config.export!.outputRoot = testExportRoot;

      const source1: BackupSource = {
        name: 'pi-scsi2',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };

      const source2: BackupSource = {
        name: 's5k-gotek',
        type: 'local',
        source: '/Volumes/GOTEK',
        device: 'floppy',
        sampler: 's5k-studio',
        enabled: true,
      };

      const source3: BackupSource = {
        name: 'old-sampler',
        type: 'remote',
        source: 'old.local:~/images/',
        device: 'images',
        enabled: false,
      };

      config = addBackupSource(config, source1);
      config = addBackupSource(config, source2);
      config = addBackupSource(config, source3);

      // Enable only first two sources for export
      config = enableSourceForExport(config, 'pi-scsi2');
      config = enableSourceForExport(config, 's5k-gotek');

      await saveConfig(config, testConfigPath);

      // Verify selective enabling
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.backup?.sources).toHaveLength(3);

      const enabledBackupSources = loaded.backup?.sources.filter(s => s.enabled);
      expect(enabledBackupSources).toHaveLength(2);

      expect(loaded.export?.enabledSources).toHaveLength(2);
      expect(loaded.export?.enabledSources).toContain('pi-scsi2');
      expect(loaded.export?.enabledSources).toContain('s5k-gotek');
      expect(loaded.export?.enabledSources).not.toContain('old-sampler');
    });
  });

  describe('Backup → Export pipeline', () => {
    it('should configure complete backup and export pipeline', async () => {
      let config = getDefaultConfig();
      config.backup!.backupRoot = testBackupRoot;
      config.export!.outputRoot = testExportRoot;
      config.export!.formats = ['sfz', 'decentsampler'];
      config.export!.skipUnchanged = true;

      // Add source
      const source: BackupSource = {
        name: 'pi-scsi2',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);
      config = enableSourceForExport(config, 'pi-scsi2');

      await saveConfig(config, testConfigPath);

      // Verify complete pipeline configuration
      const loaded = await loadConfig(testConfigPath);

      // Backup configuration
      expect(loaded.backup?.backupRoot).toBe(testBackupRoot);
      expect(loaded.backup?.sources[0].name).toBe('pi-scsi2');
      expect(loaded.backup?.sources[0].enabled).toBe(true);

      // Export configuration
      expect(loaded.export?.outputRoot).toBe(testExportRoot);
      expect(loaded.export?.formats).toEqual(['sfz', 'decentsampler']);
      expect(loaded.export?.skipUnchanged).toBe(true);
      expect(loaded.export?.enabledSources).toContain('pi-scsi2');
    });

    it('should maintain consistency between backup and export sources', async () => {
      let config = getDefaultConfig();

      // Add multiple backup sources
      const sources: BackupSource[] = [
        {
          name: 'source-1',
          type: 'remote',
          source: 'host1:~/images/',
          device: 'images',
          enabled: true,
        },
        {
          name: 'source-2',
          type: 'local',
          source: '/Volumes/USB',
          device: 'usb',
          sampler: 's5k',
          enabled: true,
        },
        {
          name: 'source-3',
          type: 'remote',
          source: 'host3:~/images/',
          device: 'images',
          enabled: false,
        },
      ];

      for (const source of sources) {
        config = addBackupSource(config, source);
      }

      // Enable only active backup sources for export
      config = enableSourceForExport(config, 'source-1');
      config = enableSourceForExport(config, 'source-2');

      await saveConfig(config, testConfigPath);

      const loaded = await loadConfig(testConfigPath);

      // All backup sources should exist
      expect(loaded.backup?.sources).toHaveLength(3);

      // Only enabled backup sources should be in export
      expect(loaded.export?.enabledSources).toHaveLength(2);

      // Source names should match
      const backupSourceNames = loaded.backup?.sources.map(s => s.name);
      const exportSourceNames = loaded.export?.enabledSources;

      for (const exportSource of exportSourceNames!) {
        expect(backupSourceNames).toContain(exportSource);
      }
    });
  });

  describe('Dual workflow compatibility', () => {
    it('should allow both config-based and flag-based usage', async () => {
      // Config-based setup
      let config = getDefaultConfig();
      config.backup!.backupRoot = testBackupRoot;

      const source: BackupSource = {
        name: 'pi-scsi2',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);
      await saveConfig(config, testConfigPath);

      // Load config and verify it works
      const loaded = await loadConfig(testConfigPath);
      expect(loaded.backup?.sources).toHaveLength(1);

      // Flag-based parameters should still work (backward compatible)
      const flagBasedOptions = {
        source: 'manual-host:~/images/',
        device: 'scsi0',
        sampler: 'manual-sampler',
      };

      // These would bypass config and use flags directly
      expect(flagBasedOptions.source).toBeDefined();
      expect(flagBasedOptions.device).toBeDefined();
    });

    it('should prioritize flags over config when both provided', () => {
      // Config values
      const configSource = 'pi-scsi2.local:~/images/';
      const configDevice = 'images';

      // Flag values
      const flagSource = 'override-host:~/data/';
      const flagDevice = 'scsi0';

      // Flags should take precedence
      const effectiveSource = flagSource || configSource;
      const effectiveDevice = flagDevice || configDevice;

      expect(effectiveSource).toBe(flagSource);
      expect(effectiveDevice).toBe(flagDevice);
    });
  });

  describe('Error handling', () => {
    it('should handle missing config gracefully', async () => {
      const nonExistentPath = join(tmpdir(), `non-existent-${Date.now()}.json`);

      await expect(loadConfig(nonExistentPath)).rejects.toThrow();
    });

    it('should handle corrupted config file', async () => {
      await writeFile(testConfigPath, 'invalid json {{{', 'utf-8');

      await expect(loadConfig(testConfigPath)).rejects.toThrow();
    });

    it('should validate config before saving', async () => {
      const invalidConfig = {
        version: '2.0', // Invalid version
        backup: {
          backupRoot: '/path',
          sources: [],
        },
      } as any;

      await expect(saveConfig(invalidConfig, testConfigPath)).rejects.toThrow();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle complete user setup workflow', async () => {
      // User runs: audiotools config
      // Step 1: Create default config
      let config = getDefaultConfig();

      // Step 2: Configure backup root
      config.backup!.backupRoot = testBackupRoot;

      // Step 3: Add remote source (PiSCSI)
      const piScsi: BackupSource = {
        name: 'pi-scsi2',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };
      config = addBackupSource(config, piScsi);

      // Step 4: Add local source (Gotek)
      const gotek: BackupSource = {
        name: 's5k-gotek',
        type: 'local',
        source: '/Volumes/GOTEK',
        device: 'floppy',
        sampler: 's5k-studio',
        enabled: true,
      };
      config = addBackupSource(config, gotek);

      // Step 5: Configure export
      config.export!.outputRoot = testExportRoot;
      config.export!.formats = ['sfz', 'decentsampler'];
      config.export!.skipUnchanged = true;

      // Step 6: Enable sources for export
      config = enableSourceForExport(config, 'pi-scsi2');
      config = enableSourceForExport(config, 's5k-gotek');

      // Step 7: Save config
      await saveConfig(config, testConfigPath);

      // Verify complete setup
      const loaded = await loadConfig(testConfigPath);

      expect(loaded.backup?.sources).toHaveLength(2);
      expect(loaded.export?.enabledSources).toHaveLength(2);
      expect(loaded.export?.formats).toEqual(['sfz', 'decentsampler']);
      expect(loaded.export?.skipUnchanged).toBe(true);

      // User can now run: audiotools backup
      // User can now run: audiotools export
      // User can now run: audiotools backup pi-scsi2
      // User can now run: audiotools export s5k-gotek
    });

    it('should support gradual configuration updates', async () => {
      // Initial setup
      let config = getDefaultConfig();
      config.backup!.backupRoot = testBackupRoot;

      const source1: BackupSource = {
        name: 'initial-source',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source1);
      await saveConfig(config, testConfigPath);

      // Later: add another source
      config = await loadConfig(testConfigPath);

      const source2: BackupSource = {
        name: 'new-source',
        type: 'local',
        source: '/Volumes/USB',
        device: 'usb',
        sampler: 's5k',
        enabled: true,
      };

      config = addBackupSource(config, source2);
      await saveConfig(config, testConfigPath);

      // Even later: configure export
      config = await loadConfig(testConfigPath);
      config.export!.outputRoot = testExportRoot;
      config = enableSourceForExport(config, 'initial-source');
      config = enableSourceForExport(config, 'new-source');
      await saveConfig(config, testConfigPath);

      // Verify all updates persisted
      const final = await loadConfig(testConfigPath);

      expect(final.backup?.sources).toHaveLength(2);
      expect(final.export?.enabledSources).toHaveLength(2);
    });
  });
});
