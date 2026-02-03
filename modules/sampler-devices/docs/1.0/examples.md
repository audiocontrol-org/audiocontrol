## Examples

### Example 1: Backup All Programs

```typescript
import {newAkaitools} from '@audiocontrol/sampler-devices/s3k';

async function backupAllPrograms(diskPath: string, outputDir: string) {
    const tools = newAkaitools({diskPath, verbose: true});
    const disk = await tools.readAkaiDisk();

    for (const program of disk.programs) {
        const filename = `${program.header.PRNAME}.akp`;
        await tools.akaiRead(
            filename,                    // Source: program on disk
            `${outputDir}/${filename}`,  // Target: local file
            1,                           // Partition
            false                        // Not recursive
        );
        console.log(`Backed up: ${filename}`);
    }
}

await backupAllPrograms('/dev/disk4', './backup');
```

### Example 2: Convert WAV to Akai Sample

```typescript
import {newAkaitools} from '@audiocontrol/sampler-devices/s3k';

async function importWavSample(wavPath: string, diskPath: string, sampleName: string) {
    const tools = newAkaitools({diskPath, verbose: true});

    const result = await tools.wav2Akai(
        wavPath,           // Source WAV file
        diskPath,          // Target disk
        sampleName         // Akai sample name (8.3 format)
    );

    if (result.code === 0) {
        console.log(`Imported ${sampleName} successfully`);
    } else {
        console.error(`Import failed: ${result.errors.join(', ')}`);
    }
}

await importWavSample('./samples/kick.wav', '/dev/disk4', 'KICK001');
```

### Example 3: List Remote Volumes

```typescript
import {newAkaitools} from '@audiocontrol/sampler-devices/s3k';

async function listRemoteVolumes() {
    const tools = newAkaitools({
        serverConfig: {
            host: 'piscsi.local',
            user: 'pi',
            sshKeyPath: '~/.ssh/id_rsa'
        },
        remote: true,
        verbose: true
    });

    const volumes = await tools.remoteVolumes();

    console.log('Available volumes:');
    volumes.disks.forEach(disk => {
        console.log(`  ${disk.id}: ${disk.name}`);
        console.log(`    Mounted: ${disk.mounted ? 'Yes' : 'No'}`);
        console.log(`    Device: ${disk.devicePath || 'N/A'}`);
    });
}

await listRemoteVolumes();
```

### Example 4: Parse S5K/S6K Data

```typescript
import {parseS56kChunk, BasicProgram} from '@audiocontrol/sampler-devices/s5k';

async function parseS6KProgram(data: Uint8Array) {
    const chunk = parseS56kChunk(data);

    if (chunk.type === 'PROGRAM') {
        const program = new BasicProgram(chunk.data);
        console.log(`Program: ${program.getName()}`);
        console.log(`Zones: ${program.getZoneCount()}`);
    }
}
```

### Example 5: Modify and Save Program

```typescript
import {newAkaitools} from '@audiocontrol/sampler-devices/s3k';

async function setProgramVolume(diskPath: string, programFile: string, loudness: number) {
    const tools = newAkaitools({diskPath, verbose: true});

    // Read program
    const program = await tools.readAkaiProgram(programFile);

    // Modify (requires working with generated S3000XL interfaces)
    // Note: This is a simplified example
    program.header.OUTLEV = loudness; // Output level

    // Write back
    await tools.writeAkaiProgram(programFile, program);
    console.log(`Updated ${programFile} loudness to ${loudness}`);
}

await setProgramVolume('/dev/disk4', 'BASS001.AKP', 80);
```

## Troubleshooting
