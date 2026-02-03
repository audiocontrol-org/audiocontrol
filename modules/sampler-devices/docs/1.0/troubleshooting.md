## Troubleshooting

### "akaitools not found"

**Problem**: External `akaitools` binary not installed or not in PATH.

**Solution**:

1. Install akaitools: https://github.com/philburk/akaitools
2. Ensure it's in your system PATH
3. Or specify full path in configuration

```typescript
// If akaitools is not in PATH, use full path
process.env.PATH += ':/usr/local/bin:/opt/homebrew/bin';
```

### "Permission denied" accessing disk

**Problem**: Insufficient permissions to access disk device.

**Solution** (macOS/Linux):

```bash
# Run with sudo
sudo node your-script.js

# Or add your user to disk group (Linux)
sudo usermod -a -G disk $USER
```

**Solution** (macOS - unmount disk first):

```bash
diskutil list                    # Find your disk
diskutil unmountDisk /dev/disk4  # Unmount before accessing
```

### Remote operations timeout

**Problem**: SSH connection times out or fails.

**Solution**:

1. Verify SSH connectivity: `ssh pi@piscsi.local`
2. Check SSH key permissions: `chmod 600 ~/.ssh/id_rsa`
3. Increase timeout in configuration:
   ```typescript
   const config = {
     serverConfig: {
       host: 'piscsi.local',
       user: 'pi',
       sshKeyPath: '~/.ssh/id_rsa',
       timeout: 30000  // 30 seconds
     },
     remote: true
   };
   ```

### "Invalid partition" error

**Problem**: Specified partition doesn't exist or is invalid.

**Solution**:

1. List partitions first:
   ```typescript
   const disk = await tools.readAkaiDisk();
   console.log(`Partitions: ${disk.volumes.length}`);
   ```
2. Use valid partition number (usually 1-4)
3. Omit partition parameter to use default

### Generated code out of sync

**Problem**: Changes to spec files don't take effect.

**Solution**:

1. Regenerate code: `npm run gen`
2. Rebuild package: `npm run build`
3. Check generator ran successfully (no errors)
4. Verify generated file headers have new timestamp

### TypeScript errors after regeneration

**Problem**: Generated code doesn't compile.

**Solution**:

1. Check YAML spec syntax: `yamllint src/gen/akai-s3000xl.spec.yaml`
2. Verify generator script has no errors
3. Run tests to identify issues: `npm test`
4. Review generator output for warnings

### Import errors

**Problem**: `Cannot find module '@audiocontrol/sampler-devices/s3k'`

**Solution**:

1. Ensure package is installed: `npm install @audiocontrol/sampler-devices`
2. Check package.json exports are correct
3. Use correct import paths:
    - `@audiocontrol/sampler-devices` (default)
    - `@audiocontrol/sampler-devices/s3k` (S3000XL)
    - `@audiocontrol/sampler-devices/s5k` (S5000/S6000)

### "No such file" when reading program

**Problem**: Program file doesn't exist on disk.

**Solution**:

1. List disk contents first:
   ```typescript
   const records = await tools.akaiList('/', 1);
   records.records.forEach(r => console.log(r.name));
   ```
2. Use exact filename (case-sensitive, 8.3 format)
3. Verify partition number is correct

## Contributing
