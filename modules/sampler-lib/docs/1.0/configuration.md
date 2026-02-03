## Configuration

### Default Data Directory

The library uses `~/.audiotools` as the default data directory for configuration and session files.

### Server Configuration

```typescript
import { newServerConfig } from '@audiocontrol/sampler-lib';

const config = await newServerConfig();
// Defaults:
// - piscsiHost: "pi-scsi2.local"
// - s3kScsiId: 4
// - sourceRoot: ~/.audiotools/source
// - targetRoot: ~/.audiotools/target
// - sessionRoot: ~/.audiotools/sessions
```

### Client Configuration

```typescript
import { loadClientConfig, saveClientConfig } from '@audiocontrol/sampler-lib';

// Load existing config
const config = await loadClientConfig();

// Modify and save
config.midiInput = 'My MIDI Input';
config.midiOutput = 'My MIDI Output';
await saveClientConfig(config);
```

## Examples
