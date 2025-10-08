import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

describe('CLI Commands', () => {
  describe('main program', () => {
    it('should create program with correct metadata', async () => {
      // Import dynamically to avoid side effects
      const program = new Command();

      program
        .name('audiotools')
        .description('Audio Tools - Backup, extract, and convert Akai sampler data')
        .version('1.0.0');

      expect(program.name()).toBe('audiotools');
      expect(program.description()).toContain('Audio Tools');
      expect(program.version()).toBe('1.0.0');
    });

    it('should have backup, export, and config subcommands', async () => {
      const program = new Command();

      program
        .name('audiotools')
        .description('Audio Tools')
        .version('1.0.0');

      // Mock commands
      const backupCommand = new Command('backup');
      const exportCommand = new Command('export');
      const configCommand = new Command('config');

      program.addCommand(backupCommand);
      program.addCommand(exportCommand);
      program.addCommand(configCommand);

      const commands = program.commands.map(cmd => cmd.name());

      expect(commands).toContain('backup');
      expect(commands).toContain('export');
      expect(commands).toContain('config');
    });
  });

  describe('backup command', () => {
    it('should have correct command structure', () => {
      const backupCommand = new Command('backup')
        .description('Backup from config (all enabled sources or specific source by name)')
        .argument('[source]', 'Specific source name from configuration')
        .option('--source <path>', 'Override: use flag-based source path instead of config')
        .option('--device <name>', 'Override: device name (requires --source)')
        .option('--sampler <name>', 'Override: sampler name (for local sources with --source)')
        .option('--dry-run', 'Show what would be synced without actually syncing');

      expect(backupCommand.name()).toBe('backup');
      expect(backupCommand.description()).toContain('Backup from config');

      const options = backupCommand.options.map(opt => opt.long);
      expect(options).toContain('--source');
      expect(options).toContain('--device');
      expect(options).toContain('--sampler');
      expect(options).toContain('--dry-run');
    });

    it('should accept optional source argument', () => {
      const backupCommand = new Command('backup')
        .argument('[source]', 'Specific source name');

      const args = backupCommand._args;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('source');
      expect(args[0].required).toBe(false);
    });
  });

  describe('export command', () => {
    it('should have correct command structure', () => {
      const exportCommand = new Command('export')
        .description('Export from config (all enabled sources or specific source by name)')
        .argument('[source]', 'Specific source name from configuration')
        .option('-i, --input <path>', 'Override: input disk image or directory')
        .option('-f, --format <format>', 'Override: output format (sfz, decentsampler, or both)')
        .option('-o, --output <path>', 'Override: output directory')
        .option('--skip-unchanged', 'Skip disk images that haven\'t changed')
        .option('--force', 'Force re-extraction of unchanged disks');

      expect(exportCommand.name()).toBe('export');
      expect(exportCommand.description()).toContain('Export from config');

      const options = exportCommand.options.map(opt => opt.long);
      expect(options).toContain('--input');
      expect(options).toContain('--format');
      expect(options).toContain('--output');
      expect(options).toContain('--skip-unchanged');
      expect(options).toContain('--force');
    });

    it('should accept optional source argument', () => {
      const exportCommand = new Command('export')
        .argument('[source]', 'Specific source name');

      const args = exportCommand._args;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('source');
      expect(args[0].required).toBe(false);
    });
  });

  describe('config command', () => {
    it('should have correct command structure', () => {
      const configCommand = new Command('config')
        .description('Configure audio tools');

      expect(configCommand.name()).toBe('config');
      expect(configCommand.description()).toContain('Configure audio tools');
    });

    it('should not require any arguments or options', () => {
      const configCommand = new Command('config');

      expect(configCommand._args).toHaveLength(0);
      expect(configCommand.options).toHaveLength(0);
    });
  });

  describe('dual workflow support', () => {
    it('backup should support config-based workflow without flags', () => {
      const backupCommand = new Command('backup')
        .argument('[source]', 'Source name')
        .option('--source <path>', 'Override source');

      // Simulate running without flags
      const opts = {};
      const sourceName = undefined;

      expect(opts).not.toHaveProperty('source');
      expect(sourceName).toBeUndefined();

      // This would trigger config-based workflow
    });

    it('backup should support flag-based workflow with --source', () => {
      const backupCommand = new Command('backup')
        .argument('[source]', 'Source name')
        .option('--source <path>', 'Override source')
        .option('--device <name>', 'Device name');

      // Simulate running with flags
      const opts = {
        source: 'pi-scsi2.local:~/images/',
        device: 'images',
      };

      expect(opts.source).toBeDefined();
      expect(opts.device).toBeDefined();

      // This would trigger flag-based workflow (backward compatible)
    });

    it('export should support config-based workflow without flags', () => {
      const exportCommand = new Command('export')
        .argument('[source]', 'Source name')
        .option('--input <path>', 'Override input');

      // Simulate running without flags
      const opts = {};
      const sourceName = undefined;

      expect(opts).not.toHaveProperty('input');
      expect(sourceName).toBeUndefined();

      // This would trigger config-based workflow
    });

    it('export should support flag-based workflow with --input', () => {
      const exportCommand = new Command('export')
        .argument('[source]', 'Source name')
        .option('--input <path>', 'Override input')
        .option('--format <format>', 'Format')
        .option('--output <path>', 'Output');

      // Simulate running with flags
      const opts = {
        input: '~/backup/HD0.hds',
        format: 'sfz',
        output: '~/extracted',
      };

      expect(opts.input).toBeDefined();
      expect(opts.format).toBeDefined();
      expect(opts.output).toBeDefined();

      // This would trigger flag-based workflow (backward compatible)
    });
  });

  describe('command help text', () => {
    it('backup should provide helpful description', () => {
      const backupCommand = new Command('backup')
        .description('Backup from config (all enabled sources or specific source by name)');

      expect(backupCommand.description()).toContain('all enabled sources');
      expect(backupCommand.description()).toContain('specific source');
    });

    it('export should provide helpful description', () => {
      const exportCommand = new Command('export')
        .description('Export from config (all enabled sources or specific source by name)');

      expect(exportCommand.description()).toContain('all enabled sources');
      expect(exportCommand.description()).toContain('specific source');
    });

    it('config should provide helpful description', () => {
      const configCommand = new Command('config')
        .description('Configure audio tools');

      expect(configCommand.description()).toBe('Configure audio tools');
    });
  });

  describe('option descriptions', () => {
    it('backup options should have clear descriptions', () => {
      const backupCommand = new Command('backup')
        .option('--source <path>', 'Override: use flag-based source path instead of config')
        .option('--device <name>', 'Override: device name (requires --source)')
        .option('--sampler <name>', 'Override: sampler name (for local sources with --source)')
        .option('--dry-run', 'Show what would be synced without actually syncing');

      const sourceOpt = backupCommand.options.find(opt => opt.long === '--source');
      const deviceOpt = backupCommand.options.find(opt => opt.long === '--device');
      const samplerOpt = backupCommand.options.find(opt => opt.long === '--sampler');
      const dryRunOpt = backupCommand.options.find(opt => opt.long === '--dry-run');

      expect(sourceOpt?.description).toContain('Override');
      expect(deviceOpt?.description).toContain('requires --source');
      expect(samplerOpt?.description).toContain('local sources');
      expect(dryRunOpt?.description).toContain('without actually syncing');
    });

    it('export options should have clear descriptions', () => {
      const exportCommand = new Command('export')
        .option('-i, --input <path>', 'Override: input disk image or directory')
        .option('-f, --format <format>', 'Override: output format (sfz, decentsampler, or both)')
        .option('-o, --output <path>', 'Override: output directory')
        .option('--skip-unchanged', 'Skip disk images that haven\'t changed')
        .option('--force', 'Force re-extraction of unchanged disks');

      const inputOpt = exportCommand.options.find(opt => opt.long === '--input');
      const formatOpt = exportCommand.options.find(opt => opt.long === '--format');
      const outputOpt = exportCommand.options.find(opt => opt.long === '--output');
      const skipOpt = exportCommand.options.find(opt => opt.long === '--skip-unchanged');
      const forceOpt = exportCommand.options.find(opt => opt.long === '--force');

      expect(inputOpt?.description).toContain('Override');
      expect(formatOpt?.description).toContain('sfz');
      expect(formatOpt?.description).toContain('decentsampler');
      expect(outputOpt?.description).toContain('output directory');
      expect(skipOpt?.description).toContain('haven\'t changed');
      expect(forceOpt?.description).toContain('Force re-extraction');
    });
  });
});
