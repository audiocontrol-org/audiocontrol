## Troubleshooting

### Problem: "mcopy binary not found"

**Symptom:**
```
Error: mcopy binary not found for platform darwin-arm64.
Please install mtools:
  macOS: brew install mtools
  ...
```

**Solutions:**

1. **Install system mtools** (recommended):
   ```bash
   # macOS
   brew install mtools

   # Linux (Debian/Ubuntu)
   sudo apt install mtools

   # Linux (RHEL/CentOS)
   sudo yum install mtools
   ```

2. **Check platform support**:
   - Verify your platform is supported: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`
   - Run `node -p "process.platform + '-' + process.arch"` to check your platform

3. **Verify bundled binaries**:
   ```bash
   ls node_modules/@audiocontrol/sampler-export/bin/mtools/
   ```

---

### Problem: "Extraction failed: mcopy exited with code 1"

**Symptom:**
```
Extraction failed: mcopy exited with code 1: Init A: non DOS media
```

**Causes:**
- Disk image is not DOS/FAT formatted (native Akai format)
- Partition offset detection failed
- Corrupted disk image

**Solutions:**

1. **Check disk format**:
   ```typescript
   import { isDosDisk } from '@audiocontrol/sampler-export';
   console.log(isDosDisk('/path/to/disk.hds'));
   ```

2. **Try native Akai extraction**:
   If `isDosDisk()` returns `false`, the disk is in native Akai format. The `extractAkaiDisk()` function should automatically detect this and use akaitools instead of mcopy.

3. **Check disk image integrity**:
   ```bash
   # Verify file exists and is readable
   ls -lh /path/to/disk.hds

   # Check file size (should be reasonable, e.g., 1-2GB for S5000/S6000)
   du -h /path/to/disk.hds
   ```

---

### Problem: "Sample not found: {sampleName}"

**Symptom:**
```
Sample not found: moogb3600
Warning: Some samples could not be located
```

**Causes:**
- Sample files not extracted (extraction failed earlier)
- Sample naming mismatch (Akai uses internal names)
- WAV files in unexpected location

**Solutions:**

1. **Verify WAV directory**:
   ```bash
   ls -la ./extracted/{diskname}/wav/
   ```

2. **Check sample naming patterns**:
   The converter tries multiple patterns:
   - `samplename.wav`
   - `samplename_-l.wav` (stereo left)
   - `samplename_-r.wav` (stereo right)
   - `{programname}*_-l.wav` (wildcard match)

3. **Manual sample organization**:
   If samples are in different location, copy them to the `wav/` directory:
   ```bash
   cp /path/to/samples/*.wav ./extracted/{diskname}/wav/
   ```

---

### Problem: "Batch extraction finds no disks"

**Symptom:**
```
Found 0 disks (0 S5K, 0 S3K)
```

**Causes:**
- rsnapshot backup structure not found
- Wrong source directory
- No backups created yet

**Solutions:**

1. **Verify rsnapshot backup structure**:
   ```bash
   # Check backup root
   ls -la ~/.audiotools/backup/

   # Check for daily.0 interval
   ls -la ~/.audiotools/backup/daily.0/

   # Check for sampler directories
   ls -la ~/.audiotools/backup/daily.0/pi-scsi2/
   ls -la ~/.audiotools/backup/daily.0/s3k/
   ```

2. **Run rsnapshot backup first**:
   ```bash
   # Using @audiocontrol/sampler-backup
   akai-backup batch
   ```

3. **Use custom source directory**:
   ```typescript
   await extractBatch({
     sourceDir: '/custom/backup/location',
     destDir: './output'
   });
   ```

---

### Problem: "Velocity range reversed (lovel > hivel)"

**Symptom:**
SFZ or DecentSampler preset plays incorrectly or has no sound.

**Cause:**
Akai program has invalid velocity ranges in keygroup data.

**Solution:**
The converters automatically fix this:
```typescript
// Auto-correction in converter
if (lovel > hivel) {
  [lovel, hivel] = [hivel, lovel];  // Swap values
}
```

If issues persist, manually edit the generated SFZ:
```sfz
lovel=0
hivel=127
```

---

### Problem: "High memory usage during extraction"

**Cause:**
Large disk images (>2GB) being loaded entirely into memory.

**Solution:**
The package is designed to avoid this:

- **DOS disk detection**: Reads only 512 bytes (boot sector)
- **Partition detection**: Reads only MBR (first sector)
- **mcopy extraction**: Streams files directly from disk image

If experiencing high memory usage, check:
1. Node.js version (use v16+ for better memory management)
2. Number of concurrent extractions (batch process runs serially)
3. Disk image corruption (may cause parsing errors)

---

### Problem: Platform-Specific Issues

#### macOS: "mcopy: command not found" after Homebrew install

**Solution:**
```bash
# Verify Homebrew installation
which mcopy

# Add Homebrew to PATH if needed
export PATH="/opt/homebrew/bin:$PATH"  # Apple Silicon
export PATH="/usr/local/bin:$PATH"     # Intel
```

#### Linux: Permission denied executing bundled binary

**Solution:**
```bash
# Make bundled binary executable
chmod +x node_modules/@audiocontrol/sampler-export/bin/mtools/*/mcopy
```

#### Windows: "mcopy.exe is not recognized"

**Solution:**
1. Install mtools from GNU website
2. Add mtools bin directory to PATH
3. Restart terminal/command prompt

---

