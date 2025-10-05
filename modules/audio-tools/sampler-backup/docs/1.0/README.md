# sampler-backup v1.0 Documentation

## Overview

Version 1.0 provides rsnapshot-based incremental backups for Akai samplers. Supports both remote backup (via SSH/PiSCSI) and local media (SD cards, USB drives).

## Key Capabilities

- **Incremental Backups**: rsnapshot with hard-linking for space efficiency
- **Smart Rotation**: Same-day resume logic prevents duplicate backups
- **Remote & Local**: SSH-based remote backup or direct media access
- **Configurable Retention**: Daily/weekly/monthly snapshot intervals
- **Batch Processing**: One-command backup for multiple samplers

## Documentation

1. **[Installation](./installation.md)** - Package and rsnapshot setup
2. **[Quick Start](./quick-start.md)** - First backup in 5 minutes
3. **[CLI Commands](./cli-commands.md)** - Command-line interface reference
4. **[Configuration](./configuration.md)** - rsnapshot.conf customization
5. **[Examples](./examples.md)** - Common backup scenarios
6. **[API Reference](./api-reference.md)** - Programmatic usage
7. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Backup Strategy

v1.0 implements a traditional rsnapshot rotation strategy:

- **Daily backups**: 7 retained (daily.0 through daily.6)
- **Weekly backups**: 4 retained (weekly.0 through weekly.3)
- **Monthly backups**: 12 retained (monthly.0 through monthly.11)

Hard-linking ensures snapshots share unchanged files, minimizing disk usage.

## Getting Started

```bash
npm install -g @oletizi/sampler-backup
brew install rsnapshot
akai-backup batch
```

See [Quick Start](./quick-start.md) for detailed setup.

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

Apache-2.0
