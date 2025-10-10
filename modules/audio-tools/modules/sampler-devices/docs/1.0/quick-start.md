## Quick Start

### Working with S3000XL

```typescript
import {newAkaitools, AkaiToolsConfig} from '@oletizi/sampler-devices/s3k';

// Create configuration for local disk
const config: AkaiToolsConfig = {
    diskPath: '/dev/disk4',  // Local disk or disk image
    verbose: true
};

const tools = newAkaitools(config);

// Read disk contents
const disk = await tools.readAkaiDisk();
console.log(`Volumes: ${disk.volumes.length}`);
console.log(`Programs: ${disk.programs.length}`);
console.log(`Samples: ${disk.samples.length}`);

// Read a program file
const program = await tools.readAkaiProgram('MYPROGRAM.AKP');
console.log(`Program: ${program.header.PRNAME}`);
console.log(`Keygroups: ${program.keygroups.length}`);
```

### Working with S5000/S6000

```typescript
import {parseS56kChunk, BasicProgram, Chunk} from '@oletizi/sampler-devices/s5k';

// Parse S5K/S6K chunk data
const chunk: Chunk = parseS56kChunk(rawData);
console.log(`Type: ${chunk.type}, Length: ${chunk.length}`);

// Work with program data
const program = new BasicProgram(data);
console.log(`Program name: ${program.getName()}`);
```

### Remote Operations (PiSCSI/SSH)

```typescript
import {newAkaitools} from '@oletizi/sampler-devices/s3k';

// Configure for remote sampler via SSH
const config = {
    serverConfig: {
        host: 'piscsi.local',
        user: 'pi',
        sshKeyPath: '~/.ssh/id_rsa'
    },
    remote: true,
    verbose: true
};

const tools = newAkaitools(config);

// List remote volumes
const volumes = await tools.remoteVolumes();
volumes.disks.forEach(disk => {
    console.log(`${disk.id}: ${disk.name} (${disk.mounted ? 'mounted' : 'unmounted'})`);
});

// Mount a volume
await tools.remoteMount(volumes.disks[0]);

// Sync changes
await tools.remoteSync();
```

## API Reference
