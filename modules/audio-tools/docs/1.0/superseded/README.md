# Superseded Implementation Plans

This directory contains implementation plans that were created but superseded by better architectural approaches.

## Superseded Plans

### sampler-backup-cli-config/
**Created**: October 2025
**Superseded by**: [unified-config-and-cli](../unified-config-and-cli/)
**Reason**: Individual config systems for backup and export would drift over time. Unified approach ensures both tools stay in sync and provides foundation for future tools.

### sampler-export-cli-config/
**Created**: October 2025
**Superseded by**: [unified-config-and-cli](../unified-config-and-cli/)
**Reason**: Export config should share the same config file as backup config since they work as a pipeline (backup → extract).

## Current Implementation

See [unified-config-and-cli](../unified-config-and-cli/) for the current implementation plan, which provides:

- **Single config file**: `~/.audiotools/config.json` for all tools
- **Shared config library**: `@oletizi/audiotools-config`
- **Unified CLI**: `audiotools` command with subcommands
- **Backward compatibility**: Legacy commands still work
- **Future-proof**: Easy to add new tools to the ecosystem

## Why These Plans Were Superseded

The original approach had each tool manage its own configuration:
- `akai-backup config` → `~/.audiotools/backup-config.json`
- `akai-export config` → `~/.audiotools/export-config.json`

This would have led to:
1. **Configuration drift**: Two config files could get out of sync
2. **Duplicate logic**: Config management code duplicated across tools
3. **Poor integration**: Tools wouldn't naturally work together
4. **Scalability issues**: Each new tool would need its own config system

The unified approach solves all of these issues by providing a single source of truth that all tools share.
