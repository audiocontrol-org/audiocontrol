import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'pathe';
import { tmpdir } from 'os';
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  addBackupSource,
  updateBackupSource,
  removeBackupSource,
  getEnabledBackupSources,
  toggleBackupSource,
  updateExportConfig,
  enableSourceForExport,
  disableSourceForExport,
  getEnabledExportSources,
  getToolConfig,
  setToolConfig,
} from '@/config.js';
import type { AudioToolsConfig, BackupSource } from '@/types.js';

describe('config', () => {
  let testConfigPath: string;

  beforeEach(async () => {
    const testDir = join(tmpdir(), `audiotools-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, 'config.json');
  });

  afterEach(async () => {
    const testDir = join(testConfigPath, '..');
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = getDefaultConfig();

      expect(config.version).toBe('1.0');
      expect(config.backup).toBeDefined();
      expect(config.backup?.backupRoot).toContain('.audiotools/backup');
      expect(config.backup?.sources).toEqual([]);
      expect(config.export).toBeDefined();
      expect(config.export?.outputRoot).toContain('.audiotools/sampler-export/extracted');
      expect(config.export?.formats).toEqual(['sfz', 'decentsampler']);
      expect(config.export?.skipUnchanged).toBe(true);
      expect(config.export?.enabledSources).toEqual([]);
    });
  });

  describe('saveConfig and loadConfig', () => {
    it('should save and load configuration correctly', async () => {
      const config = getDefaultConfig();

      await saveConfig(config, testConfigPath);
      const loaded = await loadConfig(testConfigPath);

      expect(loaded).toEqual(config);
    });

    it('should create parent directories if they do not exist', async () => {
      const nestedPath = join(tmpdir(), `audiotools-test-${Date.now()}`, 'nested', 'config.json');
      const config = getDefaultConfig();

      await saveConfig(config, nestedPath);
      const loaded = await loadConfig(nestedPath);

      expect(loaded).toEqual(config);

      // Cleanup
      await rm(join(nestedPath, '../..'), { recursive: true, force: true });
    });

    it('should return default config when loading non-existent config', async () => {
      const loaded = await loadConfig(testConfigPath);
      expect(loaded).toEqual(getDefaultConfig());
    });

    it('should throw error when loading invalid JSON', async () => {
      await writeFile(testConfigPath, 'invalid json', 'utf-8');
      await expect(loadConfig(testConfigPath)).rejects.toThrow();
    });
  });

  describe('addBackupSource', () => {
    it('should add a backup source to config', () => {
      let config = getDefaultConfig();

      const source: BackupSource = {
        name: 'test-source',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);

      expect(config.backup?.sources).toHaveLength(1);
      expect(config.backup?.sources[0]).toEqual(source);
    });

    it('should add multiple backup sources', () => {
      let config = getDefaultConfig();

      const source1: BackupSource = {
        name: 'source-1',
        type: 'remote',
        source: 'host1:~/images/',
        device: 'images',
        enabled: true,
      };

      const source2: BackupSource = {
        name: 'source-2',
        type: 'local',
        source: '/Volumes/GOTEK',
        device: 'floppy',
        sampler: 's5k-studio',
        enabled: false,
      };

      config = addBackupSource(config, source1);
      config = addBackupSource(config, source2);

      expect(config.backup?.sources).toHaveLength(2);
      expect(config.backup?.sources[0]).toEqual(source1);
      expect(config.backup?.sources[1]).toEqual(source2);
    });

    it('should replace existing source when adding duplicate source name', () => {
      let config = getDefaultConfig();

      const source: BackupSource = {
        name: 'duplicate',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);
      expect(config.backup?.sources).toHaveLength(1);

      const updatedSource: BackupSource = {
        name: 'duplicate',
        type: 'local',
        source: '/Volumes/USB',
        device: 'usb',
        enabled: false,
      };

      config = addBackupSource(config, updatedSource);
      expect(config.backup?.sources).toHaveLength(1);
      expect(config.backup?.sources[0]).toEqual(updatedSource);
    });
  });

  describe('updateBackupSource', () => {
    it('should update an existing backup source', () => {
      let config = getDefaultConfig();

      const source: BackupSource = {
        name: 'test-source',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);
      config = updateBackupSource(config, 'test-source', { enabled: false, device: 'scsi0' });

      expect(config.backup?.sources[0].enabled).toBe(false);
      expect(config.backup?.sources[0].device).toBe('scsi0');
      expect(config.backup?.sources[0].source).toBe('host:~/images/');
    });

    it('should throw error when updating non-existent source', () => {
      const config = getDefaultConfig();

      expect(() => updateBackupSource(config, 'non-existent', { enabled: false }))
        .toThrow('Backup source not found: non-existent');
    });
  });

  describe('removeBackupSource', () => {
    it('should remove a backup source', () => {
      let config = getDefaultConfig();

      const source: BackupSource = {
        name: 'test-source',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);
      expect(config.backup?.sources).toHaveLength(1);

      config = removeBackupSource(config, 'test-source');
      expect(config.backup?.sources).toHaveLength(0);
    });

    it('should return config unchanged when removing non-existent source', () => {
      const config = getDefaultConfig();

      const result = removeBackupSource(config, 'non-existent');
      expect(result).toEqual(config);
      expect(result.backup?.sources).toHaveLength(0);
    });
  });

  describe('getEnabledBackupSources', () => {
    it('should return only enabled backup sources', () => {
      let config = getDefaultConfig();

      const source1: BackupSource = {
        name: 'enabled-1',
        type: 'remote',
        source: 'host1:~/images/',
        device: 'images',
        enabled: true,
      };

      const source2: BackupSource = {
        name: 'disabled',
        type: 'remote',
        source: 'host2:~/images/',
        device: 'images',
        enabled: false,
      };

      const source3: BackupSource = {
        name: 'enabled-2',
        type: 'local',
        source: '/Volumes/USB',
        device: 'usb',
        sampler: 's5k',
        enabled: true,
      };

      config = addBackupSource(config, source1);
      config = addBackupSource(config, source2);
      config = addBackupSource(config, source3);

      const enabled = getEnabledBackupSources(config);

      expect(enabled).toHaveLength(2);
      expect(enabled[0].name).toBe('enabled-1');
      expect(enabled[1].name).toBe('enabled-2');
    });

    it('should return empty array when no sources are enabled', () => {
      const config = getDefaultConfig();
      const enabled = getEnabledBackupSources(config);

      expect(enabled).toEqual([]);
    });
  });

  describe('toggleBackupSource', () => {
    it('should toggle source from enabled to disabled', () => {
      let config = getDefaultConfig();

      const source: BackupSource = {
        name: 'test-source',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source);
      expect(config.backup?.sources[0].enabled).toBe(true);

      config = toggleBackupSource(config, 'test-source');
      expect(config.backup?.sources[0].enabled).toBe(false);
    });

    it('should toggle source from disabled to enabled', () => {
      let config = getDefaultConfig();

      const source: BackupSource = {
        name: 'test-source',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: false,
      };

      config = addBackupSource(config, source);
      expect(config.backup?.sources[0].enabled).toBe(false);

      config = toggleBackupSource(config, 'test-source');
      expect(config.backup?.sources[0].enabled).toBe(true);
    });
  });

  describe('updateExportConfig', () => {
    it('should update export configuration', () => {
      let config = getDefaultConfig();

      config = updateExportConfig(config, {
        formats: ['sfz'],
        skipUnchanged: false,
      });

      expect(config.export?.formats).toEqual(['sfz']);
      expect(config.export?.skipUnchanged).toBe(false);
      expect(config.export?.outputRoot).toContain('.audiotools/sampler-export/extracted');
    });

    it('should partially update export configuration', () => {
      let config = getDefaultConfig();

      config = updateExportConfig(config, {
        outputRoot: '/custom/path',
      });

      expect(config.export?.outputRoot).toBe('/custom/path');
      expect(config.export?.formats).toEqual(['sfz', 'decentsampler']);
      expect(config.export?.skipUnchanged).toBe(true);
    });
  });

  describe('enableSourceForExport', () => {
    it('should enable a source for export', () => {
      let config = getDefaultConfig();

      config = enableSourceForExport(config, 'test-source');

      expect(config.export?.enabledSources).toContain('test-source');
    });

    it('should not add duplicate source names', () => {
      let config = getDefaultConfig();

      config = enableSourceForExport(config, 'test-source');
      config = enableSourceForExport(config, 'test-source');

      expect(config.export?.enabledSources).toEqual(['test-source']);
    });
  });

  describe('disableSourceForExport', () => {
    it('should disable a source for export', () => {
      let config = getDefaultConfig();

      config = enableSourceForExport(config, 'source-1');
      config = enableSourceForExport(config, 'source-2');

      expect(config.export?.enabledSources).toEqual(['source-1', 'source-2']);

      config = disableSourceForExport(config, 'source-1');

      expect(config.export?.enabledSources).toEqual(['source-2']);
    });

    it('should handle disabling non-existent source', () => {
      let config = getDefaultConfig();

      config = disableSourceForExport(config, 'non-existent');

      expect(config.export?.enabledSources).toEqual([]);
    });
  });

  describe('getEnabledExportSources', () => {
    it('should return backup sources enabled for export', () => {
      let config = getDefaultConfig();

      const source1: BackupSource = {
        name: 'source-1',
        type: 'remote',
        source: 'host1:~/images/',
        device: 'images',
        enabled: true,
      };

      const source2: BackupSource = {
        name: 'source-2',
        type: 'remote',
        source: 'host2:~/images/',
        device: 'images',
        enabled: true,
      };

      config = addBackupSource(config, source1);
      config = addBackupSource(config, source2);
      config = enableSourceForExport(config, 'source-1');

      const enabled = getEnabledExportSources(config);

      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('source-1');
    });

    it('should return empty array when no sources enabled for export', () => {
      const config = getDefaultConfig();
      const enabled = getEnabledExportSources(config);

      expect(enabled).toEqual([]);
    });
  });

  describe('getToolConfig', () => {
    it('should retrieve tool-specific configuration', () => {
      let config = getDefaultConfig();

      config = setToolConfig(config, 'custom-tool', { setting1: 'value1', setting2: 42 });

      const toolConfig = getToolConfig<{ setting1: string; setting2: number }>(config, 'custom-tool');

      expect(toolConfig).toEqual({ setting1: 'value1', setting2: 42 });
    });

    it('should return undefined for non-existent tool config', () => {
      const config = getDefaultConfig();
      const toolConfig = getToolConfig(config, 'non-existent');

      expect(toolConfig).toBeUndefined();
    });
  });

  describe('setToolConfig', () => {
    it('should set tool-specific configuration', () => {
      let config = getDefaultConfig();

      config = setToolConfig(config, 'custom-tool', { enabled: true, value: 123 });

      expect(config['custom-tool']).toEqual({ enabled: true, value: 123 });
    });

    it('should overwrite existing tool configuration', () => {
      let config = getDefaultConfig();

      config = setToolConfig(config, 'custom-tool', { old: 'value' });
      config = setToolConfig(config, 'custom-tool', { new: 'value' });

      expect(config['custom-tool']).toEqual({ new: 'value' });
    });
  });
});
