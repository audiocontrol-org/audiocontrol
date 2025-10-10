/**
 * @oletizi/audiotools-config
 *
 * Shared configuration system for audio-tools.
 * Provides unified configuration loading, saving, validation, and interactive wizards
 * for all audio-tools packages.
 */

// Export all type definitions
export type {
  AudioToolsConfig,
  BackupSource,
  BackupConfig,
  ExportConfig,
  DiscoveredBackup,
} from './types.js';

// Export configuration management functions
export {
  DEFAULT_CONFIG_PATH,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  // Backup source operations
  addBackupSource,
  updateBackupSource,
  removeBackupSource,
  getEnabledBackupSources,
  toggleBackupSource,
  // Export configuration operations
  updateExportConfig,
  enableSourceForExport,
  disableSourceForExport,
  getEnabledExportSources,
  // Generic tool configuration operations
  getToolConfig,
  setToolConfig,
} from './config.js';

// Export validation utilities
export {
  validateBackupSource,
  validateExportConfig,
  validateUnifiedConfig,
  testBackupSourceConnection,
} from './validator.js';

// Export auto-discovery functions
export {
  discoverExistingBackups,
  inferBackupType,
  importDiscoveredBackups,
} from './discovery.js';

// Export interactive wizard functions
export {
  runConfigWizard,
  mainMenu,
  addBackupSourceWizard,
  editBackupSourceWizard,
  removeBackupSourceWizard,
  editExportConfigWizard,
  importBackupsWizard,
} from './wizard.js';

// Export migration utilities
export {
  migrateConfig,
  hasDeviceIdentifier,
  getDeviceIdentifier,
} from './migration.js';

// Export path resolution utilities
export {
  resolveBackupPath,
  DEFAULT_BACKUP_ROOT,
} from './path-resolver.js';
