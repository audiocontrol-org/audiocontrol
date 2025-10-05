## CLI Commands

### `akai-backup config`

Generate rsnapshot configuration file.

```bash
akai-backup config [options]
```

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)
- `--test` - Test the configuration after generating

**Example:**
```bash
# Generate and test configuration
akai-backup config --test

# Generate to custom location
akai-backup config -c ~/my-backup.conf
```

### `akai-backup test`

Test rsnapshot configuration validity.

```bash
akai-backup test [options]
```

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)

**Example:**
```bash
# Test default configuration
akai-backup test

# Test custom configuration
akai-backup test -c ~/my-backup.conf
```

### `akai-backup backup`

Run rsnapshot backup with specified interval.

```bash
akai-backup backup [interval] [options]
```

**Arguments:**
- `interval` - Backup interval: `daily`, `weekly`, `monthly` (default: `daily`)

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)

**Example:**
```bash
# Run daily backup
akai-backup backup daily

# Run weekly backup (promotes daily.6 → weekly.0)
akai-backup backup weekly

# Run monthly backup (promotes weekly.3 → monthly.0)
akai-backup backup monthly

# Use custom config
akai-backup backup daily -c ~/my-backup.conf
```

### `akai-backup batch`

Alias for `backup daily`. Designed for easy one-click operation.

```bash
akai-backup batch [options]
```

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)

**Example:**
```bash
# Quick daily backup
akai-backup batch

# Perfect for cron jobs or scheduled tasks
```

