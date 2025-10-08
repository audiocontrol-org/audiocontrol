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

      expect(() => validateBackupSource(source)).toThrow('Backup source name cannot be empty');
    });

    it('should throw error for empty name', () => {
      const source: BackupSource = {
        name: '',
        type: 'remote',
        source: 'host:~/images/',
        device: 'images',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).toThrow('Backup source name cannot be empty');
    });

    it('should throw error for invalid type', () => {
      const source = {
        name: 'test',
        type: 'invalid',
        source: 'path',
        device: 'device',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('Invalid source type');
    });

    it('should throw error for missing source path', () => {
      const source = {
        name: 'test',
        type: 'remote',
        device: 'images',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('Source path cannot be empty');
    });

    it('should throw error for empty source path', () => {
      const source: BackupSource = {
        name: 'test',
        type: 'remote',
        source: '',
        device: 'images',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).toThrow('Source path cannot be empty');
    });

    it('should throw error for missing device', () => {
      const source = {
        name: 'test',
        type: 'remote',
        source: 'host:~/images/',
        enabled: true,
      } as any;

      expect(() => validateBackupSource(source)).toThrow('Device name cannot be empty');
    });

    it('should throw error for empty device', () => {
      const source: BackupSource = {
        name: 'test',
        type: 'remote',
        source: 'host:~/images/',
        device: '',
        enabled: true,
      };

      expect(() => validateBackupSource(source)).toThrow('Device name cannot be empty');
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

      expect(() => validateExportConfig(config)).toThrow('Export outputRoot cannot be empty');
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

      expect(() => validateExportConfig(config)).toThrow('Export formats array cannot be empty');
    });

    it('should throw error for invalid format', () => {
      const config = {
        outputRoot: '/path',
        formats: ['invalid'],
        skipUnchanged: true,
        enabledSources: [],
      } as any;

      expect(() => validateExportConfig(config)).toThrow('Invalid export formats');
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


    it('should throw error for missing enabledSources', () => {
      const config = {
        outputRoot: '/path',
        formats: ['sfz'],
        skipUnchanged: true,
      } as any;

      expect(() => validateExportConfig(config)).toThrow('Export enabledSources must be an array');
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

      expect(() => validateUnifiedConfig(config)).toThrow('Backup backupRoot cannot be empty');
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

      expect(() => validateUnifiedConfig(config)).toThrow('Export config: Export formats array cannot be empty');
    });
  });
});
