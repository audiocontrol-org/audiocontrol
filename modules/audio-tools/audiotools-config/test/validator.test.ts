import { describe, it, expect } from 'vitest';
import {
  validateUnifiedConfig,
  validateBackupSource,
  validateExportConfig,
} from '@/validator.js';
import type { AudioToolsConfig, BackupSource, ExportConfig, BackupConfig } from '@/types.js';

describe('validator', () => {
  describe('validateBackupSource', () => {
    it('should validate valid remote source', () => {
      const source: BackupSource = {
        name: 'pi-scsi2',
        type: 'remote',
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).not.toThrow();
    });

    it('should validate valid local source', () => {
      const source: BackupSource = {
        name: 's5k-gotek',
        type: 'local',
        source: '/Volumes/GOTEK',
        device: 'floppy',
        sampler: 's5k-studio',
        enabled: false,
      };

      expect(() => validateBackupSource(source)).not.toThrow();
    });

    it('should throw error for missing name', () => {
      const source = {
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('name is required');
    });

    it('should throw error for empty name', () => {
      const source: BackupSource = {
        name: '',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).toThrow('name cannot be empty');
    });

    it('should throw error for invalid type', () => {
      const source = {
        name: 'test',
        type: 'invalid',
        source: 'path',
        device: 'device',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('type must be "remote" or "local"');
    });

    it('should throw error for missing source path', () => {
      const source = {
        name: 'test',
        type: 'remote',
        device: 'images',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('source path is required');
    });

    it('should throw error for empty source path', () => {
      const source: BackupSource = {
        name: 'test',
        type: 'remote',
        source: '',
        device: 'images',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).toThrow('source path cannot be empty');
    });

    it('should throw error for missing device', () => {
      const source = {
        name: 'test',
        type: 'remote',
        source: 'host:~/images/',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('device is required');
    });

    it('should throw error for empty device', () => {
      const source: BackupSource = {
        name: 'test',
        type: 'remote',
        source: 'host:~/images/',
        device: '',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).toThrow('device cannot be empty');
    });

    it('should throw error for missing enabled flag', () => {
      const source = {
        name: 'test',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
      } as any;

      expect(() => validateBackupSource(source)).toThrow('enabled must be a boolean');
    });

    it('should throw error for non-boolean enabled', () => {
      const source = {
        name: 'test',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: 'true',
      } as any;

      expect(() => validateBackupSource(source)).toThrow('enabled must be a boolean');
    });

    it('should validate local source with sampler name', () => {
      const source: BackupSource = {
        name: 'local-test',
        type: 'local',
        source: '/Volumes/USB',
        device: 'usb',
        sampler: 'my-sampler',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).not.toThrow();
    });
  });

  describe('validateExportConfig', () => {
    it('should validate valid export config', () => {
      const config: ExportConfig = {
        outputRoot: '~/.audiotools/sampler-export/extracted',
        formats: ['sfz', 'decentsampler'],
        skipUnchanged: true,
        enabledSources: ['source-1', 'source-2'],
      };

      expect(() => validateExportConfig(config)).not.toThrow();
    });

    it('should throw error for missing outputRoot', () => {
      const config = {
        formats: ['sfz'],
        skipUnchanged: true,
        enabledSources: [],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('outputRoot is required');
    });

    it('should throw error for empty outputRoot', () => {
      const config: ExportConfig = {
        outputRoot: '',
        formats: ['sfz'],
        skipUnchanged: true,
        enabledSources: [],
      };

      expect(() => validateExportConfig(config)).toThrow('outputRoot cannot be empty');
    });

    it('should throw error for missing formats', () => {
      const config = {
        outputRoot: '/path',
        skipUnchanged: true,
        enabledSources: [],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('formats must be an array');
    });

    it('should throw error for empty formats array', () => {
      const config: ExportConfig = {
        outputRoot: '/path',
        formats: [],
        skipUnchanged: true,
        enabledSources: [],
      };

      expect(() => validateExportConfig(config)).toThrow('formats cannot be empty');
    });

    it('should throw error for invalid format', () => {
      const config = {
        outputRoot: '/path',
        formats: ['invalid'],
        skipUnchanged: true,
        enabledSources: [],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('formats must only contain "sfz" or "decentsampler"');
    });

    it('should validate single format', () => {
      const config: ExportConfig = {
        outputRoot: '/path',
        formats: ['sfz'],
        skipUnchanged: true,
        enabledSources: [],
      };

      expect(() => validateExportConfig(config)).not.toThrow();
    });

    it('should throw error for missing skipUnchanged', () => {
      const config = {
        outputRoot: '/path',
        formats: ['sfz'],
        enabledSources: [],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('skipUnchanged must be a boolean');
    });

    it('should throw error for non-boolean skipUnchanged', () => {
      const config = {
        outputRoot: '/path',
        formats: ['sfz'],
        skipUnchanged: 'true',
        enabledSources: [],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('skipUnchanged must be a boolean');
    });

    it('should throw error for missing enabledSources', () => {
      const config = {
        outputRoot: '/path',
        formats: ['sfz'],
        skipUnchanged: true,
      } as any;

      expect(() => validateExportConfig(config)).toThrow('enabledSources must be an array');
    });

    it('should validate empty enabledSources array', () => {
      const config: ExportConfig = {
        outputRoot: '/path',
        formats: ['sfz'],
        skipUnchanged: true,
        enabledSources: [],
      };

      expect(() => validateExportConfig(config)).not.toThrow();
    });

    it('should throw error for non-string enabledSource', () => {
      const config = {
        outputRoot: '/path',
        formats: ['sfz'],
        skipUnchanged: true,
        enabledSources: [123],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('enabledSources must only contain strings');
    });
  });

  describe('validateUnifiedConfig', () => {
    it('should validate complete valid config', () => {
      const config: AudioToolsConfig = {
        version: '1.0',
        backup: {
          backupRoot: '~/.audiotools/backup',
          sources: [
            {
              name: 'pi-scsi2',
              type: 'remote',
              source: 'pi-scsi2.local:~/images/',
              device: 'images',
              enabled: true,
            },
          ],
        },
        export: {
          outputRoot: '~/.audiotools/sampler-export/extracted',
          formats: ['sfz', 'decentsampler'],
          skipUnchanged: true,
          enabledSources: ['pi-scsi2'],
        },
      };

      expect(() => validateUnifiedConfig(config)).not.toThrow();
    });

    it('should throw error for missing version', () => {
      const config = {
        backup: {
          backupRoot: '/path',
          sources: [],
        },
      } as any;

      expect(() => validateUnifiedConfig(config)).toThrow('version is required');
    });

    it('should throw error for invalid version', () => {
      const config: AudioToolsConfig = {
        version: '2.0',
        backup: {
          backupRoot: '/path',
          sources: [],
        },
      };

      expect(() => validateUnifiedConfig(config)).toThrow('version must be "1.0"');
    });

    it('should validate config with only backup section', () => {
      const config: AudioToolsConfig = {
        version: '1.0',
        backup: {
          backupRoot: '/path',
          sources: [],
        },
      };

      expect(() => validateUnifiedConfig(config)).not.toThrow();
    });

    it('should validate config with only export section', () => {
      const config: AudioToolsConfig = {
        version: '1.0',
        export: {
          outputRoot: '/path',
          formats: ['sfz'],
          skipUnchanged: true,
          enabledSources: [],
        },
      };

      expect(() => validateUnifiedConfig(config)).not.toThrow();
    });

    it('should validate config with custom tool sections', () => {
      const config: AudioToolsConfig = {
        version: '1.0',
        'custom-tool': {
          setting1: 'value1',
          setting2: 42,
        },
      };

      expect(() => validateUnifiedConfig(config)).not.toThrow();
    });

    it('should throw error for invalid backup config', () => {
      const config = {
        version: '1.0',
        backup: {
          sources: [],
        },
      } as any;

      expect(() => validateUnifiedConfig(config)).toThrow('backupRoot is required');
    });

    it('should throw error for invalid export config', () => {
      const config = {
        version: '1.0',
        export: {
          outputRoot: '/path',
          formats: [],
          skipUnchanged: true,
          enabledSources: [],
        },
      } as any;

      expect(() => validateUnifiedConfig(config)).toThrow('formats cannot be empty');
    });
  });
});
