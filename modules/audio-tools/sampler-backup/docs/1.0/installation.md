## Installation

### From Monorepo

```bash
# Install dependencies
pnpm install

# Build the package
pnpm --filter @oletizi/sampler-backup build
```

### From npm (when published)

```bash
npm install -g @oletizi/sampler-backup
```

## Requirements

- **rsnapshot** - Install via Homebrew: `brew install rsnapshot`
- **rsync** - Usually pre-installed on macOS/Linux
- **SSH access** to PiSCSI host (for remote backups)
- **Node.js** >= 18

