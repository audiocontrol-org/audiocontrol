# Interactive UX Implementation Workplan

## Problem Statement

The current audiotools CLI follows an error-driven approach that creates a poor user experience:

### Current User Journey (Error-Driven)
```bash
$ audiotools backup
ERROR: No backup sources enabled. Run 'audiotools config' first.

$ audiotools config
[Complex configuration wizard - user must understand all concepts upfront]

$ audiotools backup
[Successful backup]

$ audiotools export
ERROR: Export not configured. Edit ~/.audiotools/config.json

$ [User manually edits JSON - error-prone, confusing]
```

### Specific Pain Points

1. **Crash on Missing Config** (Lines 320-333 in backup.ts)
   - `getEnabledBackupSources()` crashes when `config.backup` is undefined
   - No defensive programming, assumes config structure exists

2. **Disconnected Workflows**
   - Successfully backing up doesn't prepare for export
   - Export config must be manually initialized
   - No contextual guidance between related commands

3. **Error Messages Without Solutions**
   - "No backup sources enabled" - but how to enable?
   - "Export not configured" - but what to configure?
   - User must read docs to understand next steps

4. **Missing Interactive Fallbacks**
   - When config missing, throw error instead of offering to create it
   - No "just-in-time" configuration prompts
   - Forces user to context-switch to config wizard

## Proposed Interactive Workflows

### Backup Command - Interactive Flow
```bash
$ audiotools backup
⚠️  No backup sources configured yet.

? Would you like to set up a backup source now? (Y/n) y

? What type of device do you want to back up?
  ❯ SSH/Network Device (PiSCSI, network sampler)
    Local Media (SD card, USB drive, disk image)

? Enter the SSH connection (user@host): pi@piscsi.local
? Enter the device identifier (e.g., HD0): HD0

✅ Backup source configured!

Starting backup from pi@piscsi.local:HD0...
[Backup proceeds...]

✅ Backup complete! Disk images saved to: ~/.audiotools/sampler-export/disk-images/piscsi_HD0

💡 Export is now configured. Run 'audiotools export' to extract and convert samples.
```

### Export Command - Interactive Flow
```bash
$ audiotools export
⚠️  No export configuration found.

? Would you like to configure export now? (Y/n) y

? Which backup sources do you want to export? (Space to select)
  ◉ piscsi_HD0 (last backed up: 2 hours ago)
  ◯ piscsi_HD1 (never backed up)

? Select export formats: (Space to select)
  ◉ WAV (samples)
  ◉ SFZ (programs)
  ◯ DecentSampler (programs)

✅ Export configured!

Exporting from piscsi_HD0...
[Export proceeds...]

✅ Export complete! Files extracted to: ~/.audiotools/sampler-export/extracted/piscsi_HD0/
```

### Config Command - Enhanced Flow
```bash
$ audiotools config
? What would you like to configure?
  ❯ Add backup source
    Configure export
    View current configuration
    Reset configuration

? Select backup source to add:
  ❯ SSH/Network Device
    Local Media

[Interactive prompts follow...]

✅ Configuration saved!

💡 Next steps:
  • Run 'audiotools backup' to create your first backup
  • After backup, run 'audiotools export' to extract samples
```

## Implementation Phases

### Phase 1: Fix Critical Crash Bug ✅
**Priority**: CRITICAL
**Files**: `audiotools-config/src/config.ts`

**Tasks**:
1. Locate `getEnabledBackupSources()` function
2. Add defensive check for undefined config.backup:
   ```typescript
   const backup = config.backup ?? { backupRoot: '', sources: [] };
   const sources = backup.sources ?? [];
   ```
3. Ensure function never throws on missing config structure
4. Add unit test for undefined config.backup case

**Success Criteria**:
- No crash when backup config missing
- Returns empty array instead of throwing
- Graceful degradation

### Phase 2: Auto-Initialize Export Config
**Priority**: HIGH
**Files**:
- `audiotools-config/src/config.ts`
- `audiotools-cli/src/commands/backup.ts`

**Tasks**:
1. Create helper in config.ts:
   ```typescript
   export function initializeExportConfigIfNeeded(
     config: AudioToolsConfig,
     enabledSource?: string
   ): AudioToolsConfig {
     if (config.export) return config;

     return {
       ...config,
       export: {
         sources: enabledSource ? [enabledSource] : [],
         outputFormats: ['wav', 'sfz'],
         extractionRoot: path.join(config.dataRoot, 'sampler-export', 'extracted')
       }
     };
   }
   ```

2. Update backup.ts after successful backup:
   ```typescript
   // After backup completes successfully
   const updatedConfig = initializeExportConfigIfNeeded(
     config,
     sourceName
   );
   await saveConfig(updatedConfig);

   console.log('\n💡 Export is now configured. Run "audiotools export" to extract disk images.');
   ```

3. Add to both SSH backup (line ~110) and local backup (line ~132) flows

**Success Criteria**:
- Export config auto-created after first backup
- Backed-up source automatically enabled for export
- User sees helpful next-step message

### Phase 3: Interactive Backup Setup
**Priority**: HIGH
**Files**: `audiotools-cli/src/commands/backup.ts`

**Tasks**:
1. Create interactive setup function:
   ```typescript
   async function interactiveBackupSetup(): Promise<BackupSource> {
     const answers = await inquirer.prompt([
       {
         type: 'list',
         name: 'deviceType',
         message: 'What type of device do you want to back up?',
         choices: [
           { name: 'SSH/Network Device (PiSCSI, network sampler)', value: 'ssh' },
           { name: 'Local Media (SD card, USB drive)', value: 'local' }
         ]
       },
       {
         type: 'input',
         name: 'connection',
         message: 'Enter SSH connection (user@host):',
         when: (answers) => answers.deviceType === 'ssh',
         validate: (input) => input.includes('@') || 'Format: user@host'
       },
       {
         type: 'input',
         name: 'devicePath',
         message: 'Enter device path (e.g., /dev/sdb1):',
         when: (answers) => answers.deviceType === 'local'
       },
       {
         type: 'input',
         name: 'identifier',
         message: 'Enter device identifier (e.g., HD0):',
         validate: (input) => input.length > 0 || 'Identifier required'
       }
     ]);

     // Build BackupSource from answers
     // Save to config
     // Return source
   }
   ```

2. Replace error at line 325-333 with:
   ```typescript
   if (enabledSources.length === 0) {
     console.log('⚠️  No backup sources configured yet.\n');

     const { shouldSetup } = await inquirer.prompt([{
       type: 'confirm',
       name: 'shouldSetup',
       message: 'Would you like to set up a backup source now?',
       default: true
     }]);

     if (!shouldSetup) {
       console.log('💡 Run "audiotools config" to set up backup sources.');
       return;
     }

     const newSource = await interactiveBackupSetup();
     // Continue with backup using newSource
   }
   ```

**Success Criteria**:
- No more "no sources" error, interactive prompt instead
- User can configure and backup in one flow
- Graceful exit if user declines

### Phase 4: Interactive Export Setup
**Priority**: HIGH
**Files**: `audiotools-cli/src/commands/export.ts`

**Tasks**:
1. Create interactive setup function:
   ```typescript
   async function interactiveExportSetup(
     config: AudioToolsConfig
   ): Promise<void> {
     const backupSources = getEnabledBackupSources(config);

     const answers = await inquirer.prompt([
       {
         type: 'checkbox',
         name: 'sources',
         message: 'Which backup sources do you want to export?',
         choices: backupSources.map(s => ({
           name: `${s.name} (${s.type})`,
           value: s.name,
           checked: true
         })),
         validate: (input) => input.length > 0 || 'Select at least one source'
       },
       {
         type: 'checkbox',
         name: 'formats',
         message: 'Select export formats:',
         choices: [
           { name: 'WAV (samples)', value: 'wav', checked: true },
           { name: 'SFZ (programs)', value: 'sfz', checked: true },
           { name: 'DecentSampler (programs)', value: 'decentsampler' }
         ],
         validate: (input) => input.length > 0 || 'Select at least one format'
       }
     ]);

     // Update config with export settings
     // Save config
   }
   ```

2. Replace error at line 167-171 with:
   ```typescript
   if (!config.export) {
     console.log('⚠️  No export configuration found.\n');

     const { shouldSetup } = await inquirer.prompt([{
       type: 'confirm',
       name: 'shouldSetup',
       message: 'Would you like to configure export now?',
       default: true
     }]);

     if (!shouldSetup) {
       console.log('💡 Run "audiotools config" to configure export.');
       return;
     }

     await interactiveExportSetup(config);
     // Reload config and continue
   }
   ```

**Success Criteria**:
- No more "not configured" error
- Interactive source and format selection
- Graceful exit if user declines

### Phase 5: Enhanced Config Command
**Priority**: MEDIUM
**Files**: `audiotools-config/src/index.ts`

**Tasks**:
1. Add main menu to config command:
   ```typescript
   const { action } = await inquirer.prompt([{
     type: 'list',
     name: 'action',
     message: 'What would you like to configure?',
     choices: [
       { name: 'Add backup source', value: 'addBackup' },
       { name: 'Configure export', value: 'configExport' },
       { name: 'View configuration', value: 'view' },
       { name: 'Reset configuration', value: 'reset' }
     ]
   }]);
   ```

2. Route to appropriate sub-wizard
3. Show helpful next-steps after config

**Success Criteria**:
- Clear navigation between config sections
- Non-destructive config viewing
- Contextual next-step guidance

### Phase 6: Contextual Help Messages
**Priority**: LOW
**Files**: All command files

**Tasks**:
1. Add success messages with next steps:
   ```typescript
   console.log('\n✅ Backup complete!');
   console.log('📁 Disk images saved to:', diskImagePath);
   console.log('\n💡 Next steps:');
   console.log('  • Run "audiotools export" to extract and convert samples');
   console.log('  • Run "audiotools backup --help" for more options');
   ```

2. Add contextual tips for common scenarios
3. Link related commands in help text

**Success Criteria**:
- Users understand next steps without docs
- Common workflows are discoverable
- Help text cross-references related commands

## Expected User Experience

### First-Time User Journey
```bash
$ audiotools backup
⚠️  No backup sources configured yet.

? Would you like to set up a backup source now? Yes

? What type of device? SSH/Network Device
? SSH connection: pi@piscsi.local
? Device identifier: HD0

✅ Backup source configured!

Starting backup from pi@piscsi.local:HD0...
✅ Backup complete!

💡 Export is now configured. Run 'audiotools export' to extract disk images.

$ audiotools export
Found 1 backup to export: piscsi_HD0

Exporting piscsi_HD0...
✅ Export complete! Files at: ~/.audiotools/sampler-export/extracted/piscsi_HD0/
```

### Returning User Journey
```bash
$ audiotools backup
Found 2 configured backup sources:
  • piscsi_HD0 (last: 2 hours ago)
  • piscsi_HD1 (last: never)

Backing up all enabled sources...
✅ All backups complete!

$ audiotools export
Found 2 backups to export...
✅ Export complete!
```

## Technical Considerations

### Dependencies
- **inquirer**: Already installed, reuse existing patterns from audiotools-config
- **chalk**: For colored output (already used)
- **ora**: For spinners (already used)

### Error Handling
- Validate all user input before proceeding
- Provide clear error messages with recovery options
- Allow users to cancel operations gracefully
- Preserve config state on errors

### Testing Strategy
1. Unit tests for interactive functions (mock inquirer)
2. Integration tests for full workflows
3. Manual testing on macOS (primary platform)
4. Verify all error paths have interactive fallbacks

### Backward Compatibility
- Existing config files continue to work
- CLI flags override interactive prompts
- Non-interactive mode for scripts (--yes flag)
- Help text updated for all changes

## Timeline

### Week 1: Foundation (Phases 1-2)
- Day 1-2: Fix crash bug, add tests
- Day 3-4: Auto-initialize export config
- Day 5: Integration testing

### Week 2: Core Interactivity (Phases 3-4)
- Day 1-3: Interactive backup setup
- Day 4-5: Interactive export setup
- Day 5: End-to-end testing

### Week 3: Polish (Phases 5-6)
- Day 1-2: Enhanced config command
- Day 3-4: Contextual help messages
- Day 5: Documentation updates

## Success Criteria

### Quantitative Metrics
- Zero crashes on missing config (from crash bug fix)
- 100% of error messages have interactive fallbacks
- First-time user can backup+export in < 5 minutes
- CLI test coverage > 80%

### Qualitative Metrics
- User can complete workflows without reading docs
- Error messages suggest solutions, not just problems
- Related commands are discoverable through prompts
- Next steps are always clear

### User Feedback Goals
- "It just worked" - minimal friction
- "I didn't need the docs" - self-documenting
- "It guided me through it" - educational experience

## Risk Mitigation

### Risk: Breaking Existing Workflows
- **Mitigation**: Preserve CLI flag behavior, interactive only when flags missing
- **Mitigation**: Add --yes flag to skip all prompts for scripts

### Risk: Complex Dependency on inquirer
- **Mitigation**: Already used in codebase, proven stable
- **Mitigation**: Fallback to error messages if stdin not TTY

### Risk: User Confusion with Too Many Prompts
- **Mitigation**: Keep prompts focused and minimal
- **Mitigation**: Show defaults and current values
- **Mitigation**: Allow Ctrl+C to cancel gracefully

## Future Enhancements

### Post-1.0 Improvements
1. **Smart Defaults**: Learn from user patterns, suggest previous choices
2. **Validation**: Check SSH connectivity before saving backup source
3. **Progress Indicators**: Show detailed progress for long operations
4. **Undo/Redo**: Allow users to revert config changes
5. **Export Profiles**: Save common export configurations

### Integration Opportunities
1. **Web UI**: Interactive prompts could drive a web-based config tool
2. **Status Dashboard**: Show backup health, last run times
3. **Notifications**: Alert on backup failures or export completion

## Documentation Updates

After implementation, update:
1. **README.md**: Add "Quick Start" with interactive examples
2. **CLI Reference**: Document interactive mode vs flag mode
3. **Troubleshooting**: Remove "config required" errors from common issues
4. **Tutorial**: Show first-time user journey with screenshots

## Conclusion

This workplan transforms audiotools from an error-driven CLI to a guidance-driven tool that helps users succeed through interactive prompts and contextual help. The phased approach ensures stability while progressively improving user experience.

The key insight: **Users shouldn't need to understand the entire system upfront. Guide them through workflows just-in-time, with the information they need, when they need it.**
