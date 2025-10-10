## Configuration

### Local Disk Configuration

```typescript
const config: AkaiToolsConfig = {
    diskPath: '/dev/disk4',      // macOS: /dev/diskN
                                 // Linux: /dev/sdX
                                 // Windows: \\.\\PhysicalDriveN
    verbose: true,
    partition: 1                 // Optional: specify partition
};
```

### Remote Configuration (SSH/PiSCSI)

```typescript
const config: AkaiToolsConfig = {
    serverConfig: {
        host: 'piscsi.local',
        port: 22,
        user: 'pi',
        sshKeyPath: '~/.ssh/id_rsa'
    },
    remote: true,
    verbose: true
};
```

### Disk Image Configuration

```typescript
const config: AkaiToolsConfig = {
    diskPath: './backups/sampler-disk.img',
    verbose: true
};
```

## Code Generation

### CRITICAL: Auto-Generated Files

**DO NOT MANUALLY EDIT** the following auto-generated files. Your changes WILL be overwritten.

| File                     | Lines  | Generator            | Purpose                   |
|--------------------------|--------|----------------------|---------------------------|
| `src/devices/s3000xl.ts` | 4,868  | `src/gen-s3000xl.ts` | S3000XL device interfaces |
| Files in `src/gen/`      | Varies | Various generators   | Generator implementations |

**All auto-generated files have headers like:**

```typescript
//
// GENERATED Fri Oct 03 2025 22:37:37 GMT-0700 (Pacific Daylight Time). DO NOT EDIT.
//
```

### Why Code Generation?

The Akai S3000XL has hundreds of parameters across multiple data structures (ProgramHeader, KeyGroup, Zone,
SampleHeader, etc.). Hand-writing parsers and serializers for these structures would be:

- Error-prone (easy to get byte offsets wrong)
- Tedious (repetitive boilerplate)
- Hard to maintain (changes require updating multiple places)

Code generation solves this by:

- Single source of truth (YAML specification)
- Guaranteed consistency between parsers/writers
- Easy to extend (add fields to spec, regenerate)
- Automated JSDoc comments from descriptions

### Generating S3000XL Device Code

The S3000XL device interfaces are auto-generated from YAML specifications.

#### Run the Generator

```bash
cd sampler-devices
npm run gen
```

Or manually:

```bash
tsx src/gen-s3000xl.ts src/devices
```

This will regenerate `src/devices/s3000xl.ts` with a new timestamp.

#### Specification File

The generator reads from:

```
src/gen/akai-s3000xl.spec.yaml
```

This YAML file defines:

- Interface structures (ProgramHeader, KeyGroup, Zone, etc.)
- Field types and descriptions
- Byte offsets and data layouts
- MIDI SysEx message structures

**Example from spec:**

```yaml
- name: ProgramHeader
  className: ProgramHeaderClient
  headerOffset: 0
  fields:
    - n: PRNAME          # Field name
      d: Name of program # Description
      t: string          # Type
      s: 12              # Size in bytes
    - n: PRGNUM
      d: MIDI program number; Range 0 to 128
      t: number
      s: 1
```

#### Generator Implementation

Located at `src/gen/gen-s3000xl-device.ts`, the generator:

1. **Parses YAML** specification
2. **Generates TypeScript interfaces** for each structure
3. **Creates parser functions** (binary → TypeScript objects)
4. **Creates writer functions** (TypeScript objects → binary)
5. **Generates getter/setter methods** with SysEx support
6. **Adds JSDoc comments** from descriptions

#### What Gets Generated

The generator produces **4,868 lines** of TypeScript code including:

**Interfaces** (data structures):

```typescript
export interface ProgramHeader {
    PRNAME: string    // Name of program
    PRNAMELabel: string
    PRGNUM: number    // MIDI program number; Range: 0 to 128
    PRGNUMLabel: string
    // ... 50+ more fields
    raw: number[]     // Raw sysex message data
}
```

**Parser functions** (binary → objects):

```typescript
export function parseProgramHeader(
    raw: number[],
    headerOffset: number,
    header: ProgramHeader
): void {
    // Parses bytes and populates header object
}
```

**Writer functions** (objects → binary):

```typescript
export function ProgramHeader_writePRNAME(
    header: ProgramHeader,
    value: string
): void {
    // Updates header.raw with new value
}
```

**Classes** (with save methods):

```typescript
export class ProgramHeaderClient {
    constructor(device: Device, header: ProgramHeader) {
    }

    async save(): Promise<void> {
        return this.device.sendRaw(this.header.raw);
    }

    getName(): string {
        return this.header.PRNAME;
    }

    setName(v: string): void { /* ... */
    }

    // ... getters/setters for all fields
}
```

### If You Need to Modify Generated Code

**DO NOT** edit the generated `.ts` files directly. Instead:

1. **Modify the specification**: Edit `src/gen/akai-s3000xl.spec.yaml`
   ```yaml
   # Add a new field
   - n: NEWFIELD
     d: Description of new field
     t: number
     s: 2  # Size in bytes
   ```

2. **Update the generator** (if needed): Edit `src/gen/gen-s3000xl-device.ts`
    - Only needed for structural changes
    - Most changes only require spec updates

3. **Regenerate**: Run `npm run gen`
   ```bash
   npm run gen
   ```

4. **Test**: Verify changes work correctly
   ```bash
   npm test
   ```

5. **Commit both**: Commit spec changes AND regenerated code together
   ```bash
   git add src/gen/akai-s3000xl.spec.yaml
   git add src/devices/s3000xl.ts
   git commit -m "feat: add NEWFIELD to S3000XL spec"
   ```

### Other Generators

#### S56K Generator

Located at the repository root:

```bash
tsx gen-s56k.ts
```

Generates S5000/S6000 series device code with chunk-based parsing.

#### Generator Development

When creating new generators:

1. **Follow the pattern** in `src/gen/gen-s3000xl-device.ts`
2. **Add header comments** with generation timestamp
3. **Include "DO NOT EDIT" warnings** in generated files
4. **Add npm script** in `package.json`:
   ```json
   {
     "scripts": {
       "gen:s6k": "tsx src/gen-s6k.ts src/devices"
     }
   }
   ```
5. **Document in this README** in the Code Generation section
6. **Test thoroughly** before committing generated code

### Verifying Generated Code

After regenerating, verify:

1. **Header timestamp updated**:
   ```bash
   head -5 src/devices/s3000xl.ts
   # Should show current date/time
   ```

2. **No TypeScript errors**:
   ```bash
   npm run build
   ```

3. **Tests still pass**:
   ```bash
   npm test
   ```

4. **File size reasonable**:
   ```bash
   wc -l src/devices/s3000xl.ts
   # Should be around 4,868 lines
   ```

## Device Support
