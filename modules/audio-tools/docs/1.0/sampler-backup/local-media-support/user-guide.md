# Local Media Support - User Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-05

---

## Overview

The local media support feature enables you to backup Akai sampler disk images directly from SD cards, USB drives, and other mounted storage media on your computer. This is ideal for users with:

- **Floppy emulators**: Gotek, HxC with SD/USB storage
- **SCSI emulators**: ZuluSCSI, SCSI2SD with SD storage
- **Direct media access**: Manually copied disk images on USB drives

Instead of manually copying files, you get automated, incremental backups with version history, just like the remote SSH backup workflow.

---

## Quick Start

### Basic Local Backup

**1. Insert your SD card or USB drive**

Your computer should auto-mount the media:
- **macOS**: Appears in `/Volumes/SDCARD` (or similar)
- **Linux**: Appears in `/media/$USER/SDCARD` (or similar)

**2. Run backup command**

```bash
akai-backup --source /Volumes/SDCARD
```

**Example Output:**
```
Scanning /Volumes/SDCARD for disk images...
Found 5 disk image(s)
Backing up to /Users/yourname/.audiotools/backup/daily.0/sdcard

Progress: 5/5 files, 385MB processed

Backup complete: 5 files copied, 0 files skipped (unchanged)
```

**3. Verify backup**

```bash
ls -R ~/.audiotools/backup/daily.0/sdcard/
```

You should see all your disk images copied to the backup directory.

---

## Platform-Specific Setup

### macOS Setup

**No setup required!** macOS auto-mounts removable media in `/Volumes/`.

**Common mount paths:**
```
/Volumes/SDCARD        # SD card
/Volumes/GOTEK         # Gotek SD card
/Volumes/ZULUSCSI      # ZuluSCSI SD card
/Volumes/USB_DRIVE     # USB flash drive
```

**Find your mount point:**
```bash
# List all mounted volumes
ls /Volumes/

# Or use Finder: Go > Computer (Cmd+Shift+C)
```

**Example backup:**
```bash
akai-backup --source /Volumes/SDCARD
```

---

### Linux Setup

**1. Ensure udisks2 is installed** (for auto-mounting)

```bash
# Ubuntu/Debian
sudo apt install udisks2

# Check if running
systemctl status udisks2
```

**2. Insert media**

Auto-mounted media appears in `/media/$USER/`:
```bash
ls /media/$USER/
# Output: SDCARD  USB  GOTEK
```

**3. Run backup**

```bash
akai-backup --source /media/$USER/SDCARD
```

**Manual mount (alternative):**

If media doesn't auto-mount:
```bash
# Create mount point
sudo mkdir -p /mnt/sdcard

# Mount device (replace /dev/sdb1 with your device)
sudo mount -o uid=$UID,gid=$GID /dev/sdb1 /mnt/sdcard

# Backup from manual mount
akai-backup --source /mnt/sdcard

# Unmount when done
sudo umount /mnt/sdcard
```

**Common mount paths:**
```
/media/$USER/SDCARD    # Auto-mounted SD card
/mnt/sdcard            # Manually mounted
/mnt/usb               # Manually mounted USB
```

---

## Common Workflows

### Workflow 1: Gotek Floppy Emulator Backup

**Scenario:** You have a Gotek floppy emulator with SD card containing Akai disk images.

**Steps:**

1. Remove SD card from Gotek
2. Insert into computer's SD card reader
3. Wait for auto-mount
4. Run backup:

```bash
# macOS
akai-backup --source /Volumes/GOTEK

# Linux
akai-backup --source /media/$USER/GOTEK
```

**Custom subdirectory name:**
```bash
akai-backup --source /Volumes/GOTEK --subdir gotek-s3000xl
```

This creates backups in `~/.audiotools/backup/daily.0/gotek-s3000xl/` instead of default `gotek/`.

**Weekly backup:**
```bash
akai-backup backup weekly --source /Volumes/GOTEK
```

---

### Workflow 2: ZuluSCSI SD Card Backup

**Scenario:** You have a ZuluSCSI SCSI emulator with SD card containing hard disk images (.hds).

**Steps:**

1. Remove SD card from ZuluSCSI
2. Insert into computer
3. Run backup:

```bash
# macOS
akai-backup --source /Volumes/ZULUSCSI

# Linux
akai-backup --source /media/$USER/ZULUSCSI
```

**Subdirectory by sampler:**
```bash
# S5000 disk images
akai-backup --source /Volumes/ZULUSCSI --subdir zulu-s5000

# S3000XL disk images
akai-backup --source /Volumes/ZULUSCSI --subdir zulu-s3000xl
```

---

### Workflow 3: USB Drive Backup

**Scenario:** You've manually copied disk images to a USB drive and want versioned backups.

**Steps:**

1. Insert USB drive
2. Copy disk images to drive (manual copy or any method)
3. Run backup:

```bash
# macOS
akai-backup --source /Volumes/MY_USB

# Linux
akai-backup --source /media/$USER/MY_USB
```

**Incremental backup:**

Run again after adding new disk images:
```bash
akai-backup --source /Volumes/MY_USB
```

Only new or modified files will be copied. Unchanged files are skipped automatically.

---

### Workflow 4: Multiple Media Sources

**Scenario:** You have multiple SD cards or samplers to backup.

**Approach:** Use `--subdir` flag to organize backups by source.

```bash
# Backup Gotek SD card
akai-backup --source /Volumes/GOTEK --subdir gotek

# Eject, insert ZuluSCSI SD card
akai-backup --source /Volumes/ZULUSCSI --subdir zuluscsi

# Eject, insert second sampler's media
akai-backup --source /Volumes/S3000XL --subdir s3000xl
```

**Result:**
```
~/.audiotools/backup/daily.0/
  ├── gotek/
  │   ├── disk001.img
  │   └── disk002.img
  ├── zuluscsi/
  │   ├── HD0.hds
  │   └── HD1.hds
  └── s3000xl/
      ├── bank1.img
      └── bank2.img
```

---

### Workflow 5: Extract Backed-Up Disk Images

**Scenario:** After backing up local media, extract programs/samples from disk images.

**Using sampler-export:**

```bash
# Extract from all backups (remote + local)
akai-extract batch --source ~/.audiotools/backup

# Extract from specific subdirectory
akai-extract batch --source ~/.audiotools/backup/daily.0/gotek
```

**Extract to custom location:**
```bash
akai-extract batch --source ~/.audiotools/backup --dest ~/Desktop/extracted
```

The `sampler-export` tool works identically for local and remote backups.

---

### Workflow 6: Mixed Remote and Local Sources

**Scenario:** You backup from both a networked PiSCSI (remote) and local SD cards.

**Remote backup (existing workflow):**
```bash
# Backup from PiSCSI via SSH
akai-backup backup daily
```

**Local backup (new workflow):**
```bash
# Backup from local SD card
akai-backup --source /Volumes/SDCARD --subdir local-media
```

**Result:**
```
~/.audiotools/backup/daily.0/
  ├── pi-scsi2/          # Remote SSH backup
  │   └── disk001.hds
  └── local-media/       # Local media backup
      ├── disk002.img
      └── disk003.img
```

**Extract everything:**
```bash
akai-extract batch --source ~/.audiotools/backup
```

Both remote and local backups are extracted together.

---

## Backup Intervals

Local media backups support the same intervals as remote backups.

### Daily Backups (Default)

```bash
akai-backup --source /Volumes/SDCARD
# Or explicitly:
akai-backup backup daily --source /Volumes/SDCARD
```

**Retention:** 7 daily backups kept (`daily.0` through `daily.6`)

**Use case:** Regular daily backups during active sampling work

---

### Weekly Backups

```bash
akai-backup backup weekly --source /Volumes/SDCARD
```

**Retention:** 4 weekly backups kept (`weekly.0` through `weekly.3`)

**Use case:** Less frequent backups for stable sample libraries

---

### Monthly Backups

```bash
akai-backup backup monthly --source /Volumes/SDCARD
```

**Retention:** 12 monthly backups kept (`monthly.0` through `monthly.11`)

**Use case:** Long-term archival of sample libraries

---

### Same-Day Resume Logic

If you run the same backup twice on the same day, unchanged files are skipped:

```bash
# Morning: Backup SD card
akai-backup --source /Volumes/SDCARD

# Afternoon: Add new disk image to SD card, backup again
akai-backup --source /Volumes/SDCARD
```

**Result:** Only the new disk image is copied. Previous files are skipped (same mtime and size).

**Force new rotation:**

To force a new backup even on the same day (advanced):
```bash
# Manually delete daily.0 directory first
rm -rf ~/.audiotools/backup/daily.0

# Then run backup
akai-backup --source /Volumes/SDCARD
```

---

## Incremental Backup Behavior

### How It Works

Local backups use **incremental logic** identical to rsnapshot:

**Files are copied if:**
1. File doesn't exist in destination
2. Source file is newer (modified time is later)
3. Source file size differs from destination

**Files are skipped if:**
- File exists in destination with same mtime and size

### Example Incremental Workflow

**Initial backup:**
```bash
akai-backup --source /Volumes/SDCARD

# Output: 5 files copied, 0 files skipped
```

**No changes, backup again:**
```bash
akai-backup --source /Volumes/SDCARD

# Output: Resuming today's backup (no rotation needed)
#         0 files copied, 5 files skipped (unchanged)
```

**Add new disk image, backup:**
```bash
# Copy new disk image to SD card
cp ~/Downloads/newdisk.hds /Volumes/SDCARD/

akai-backup --source /Volumes/SDCARD

# Output: 1 files copied, 5 files skipped (unchanged)
```

**Modify existing file, backup:**
```bash
# Edit disk image on SD card
# ... make changes ...

akai-backup --source /Volumes/SDCARD

# Output: 1 files copied (modified), 5 files skipped (unchanged)
```

---

## Directory Structure

### Default Backup Location

```
~/.audiotools/backup/
  daily.0/         # Most recent daily backup
    gotek/         # Subdirectory for this source
      disk001.img
      disk002.img
  daily.1/         # Yesterday's backup
  daily.2/         # 2 days ago
  ...
  daily.6/         # 6 days ago
  weekly.0/        # Most recent weekly backup
  weekly.1/
  ...
  monthly.0/       # Most recent monthly backup
  monthly.1/
  ...
```

### Subdirectory Naming

**Auto-generated from source path:**
```bash
akai-backup --source /Volumes/SDCARD
# Subdirectory: sdcard (lowercased)

akai-backup --source /Volumes/GOTEK
# Subdirectory: gotek (lowercased)
```

**Custom subdirectory:**
```bash
akai-backup --source /Volumes/SDCARD --subdir my-s3000xl
# Subdirectory: my-s3000xl
```

**Remote source subdirectory (for comparison):**
```bash
# Config file specifies: host: pi-scsi2.local, backupSubdir: pi-scsi2
akai-backup backup daily
# Subdirectory: pi-scsi2
```

---

## Advanced Usage

### Custom Snapshot Root

Override the default backup location (`~/.audiotools/backup`):

**Not currently supported via CLI flag** - requires programmatic usage (see API Reference).

**Workaround: Symlink**
```bash
# Move backups to external drive
mv ~/.audiotools/backup /Volumes/ExternalHD/backups

# Create symlink
ln -s /Volumes/ExternalHD/backups ~/.audiotools/backup

# Backups now go to external drive
akai-backup --source /Volumes/SDCARD
```

---

### Disk Image Subdirectories

Local backup scans recursively. Disk images in subdirectories are found:

**Source structure:**
```
/Volumes/SDCARD/
  ├── s5000/
  │   ├── bank1.hds
  │   └── bank2.hds
  ├── s3000xl/
  │   ├── factory.img
  │   └── custom.img
  └── floppy/
      └── disk001.img
```

**After backup:**
```
~/.audiotools/backup/daily.0/sdcard/
  ├── s5000/
  │   ├── bank1.hds
  │   └── bank2.hds
  ├── s3000xl/
  │   ├── factory.img
  │   └── custom.img
  └── floppy/
      └── disk001.img
```

Directory structure is preserved during backup.

---

### Supported Disk Image Formats

**Detected extensions:**
- `.hds` - Hard disk images (Akai S5000/S6000)
- `.img` - Floppy disk images (Akai S1000/S3000XL, DOS format)
- `.iso` - CD-ROM images (ISO 9660)

**Case-insensitive:**
- `.HDS`, `.Hds`, `.hds` all detected
- `.IMG`, `.Img`, `.img` all detected

**Not detected:**
- `.zip`, `.tar.gz` (compressed archives)
- `.wav`, `.aif` (audio files)
- `.txt`, `.pdf` (documentation)

---

## Troubleshooting

### Problem: "No disk images found in source path"

**Cause:** No `.hds`, `.img`, or `.iso` files in the source directory.

**Solutions:**

1. **Verify disk images exist:**
   ```bash
   # macOS/Linux
   find /Volumes/SDCARD -name "*.hds" -o -name "*.img" -o -name "*.iso"
   ```

2. **Check file extensions:**
   - Ensure files have `.hds`, `.img`, or `.iso` extensions
   - Case doesn't matter (`.HDS` works)

3. **Verify source path:**
   ```bash
   # Check path is correct
   ls -la /Volumes/SDCARD
   ```

---

### Problem: "Source path does not exist"

**Cause:** Media not mounted or incorrect path.

**Solutions:**

1. **macOS - Find mount point:**
   ```bash
   ls /Volumes/
   # Look for your SD card name
   ```

2. **Linux - Find mount point:**
   ```bash
   ls /media/$USER/
   # Or check /mnt/
   ls /mnt/
   ```

3. **Verify media is mounted:**
   ```bash
   # macOS
   diskutil list

   # Linux
   lsblk
   mount | grep media
   ```

4. **Try re-inserting media:**
   - Eject SD card
   - Re-insert
   - Wait for auto-mount
   - Check mount point again

---

### Problem: "Permission denied" (Linux)

**Cause:** Media mounted with restrictive permissions.

**Solutions:**

1. **Add user to plugdev group:**
   ```bash
   sudo usermod -a -G plugdev $USER
   # Log out and back in for changes to take effect
   ```

2. **Remount with user permissions:**
   ```bash
   sudo mount -o remount,uid=$UID,gid=$GID /media/$USER/SDCARD
   ```

3. **Manual mount with correct permissions:**
   ```bash
   sudo mkdir -p /mnt/sdcard
   sudo mount -o uid=$UID,gid=$GID /dev/sdb1 /mnt/sdcard
   akai-backup --source /mnt/sdcard
   ```

4. **Check current permissions:**
   ```bash
   ls -ld /media/$USER/SDCARD
   # Should show your username as owner
   ```

---

### Problem: "Backup incomplete" or errors during copy

**Causes:**
- Disk full on backup destination
- Corrupted files on source media
- SD card removed during backup

**Solutions:**

1. **Check available space:**
   ```bash
   df -h ~/.audiotools/backup
   ```

2. **Verify source files:**
   ```bash
   # Check for read errors
   find /Volumes/SDCARD -name "*.hds" -exec md5sum {} \;
   ```

3. **Don't remove media during backup:**
   - Wait for backup to complete
   - Watch for "Backup complete" message

4. **Check backup logs:**
   Errors are printed to console during backup.

---

### Problem: Files copied every time (not incremental)

**Cause:** Timestamps not preserved or system clock issues.

**Solutions:**

1. **Verify timestamps match:**
   ```bash
   # Check source file
   ls -l /Volumes/SDCARD/disk.hds

   # Check backed up file
   ls -l ~/.audiotools/backup/daily.0/sdcard/disk.hds

   # Modification times should match
   ```

2. **Check system clock:**
   ```bash
   date
   # Ensure system time is correct
   ```

3. **FAT32 timestamp resolution:**
   - FAT32 has 2-second timestamp resolution
   - Small time differences are normal
   - Incremental logic handles this

---

### Problem: SD card won't eject (macOS)

**Cause:** Backup process still accessing files.

**Solutions:**

1. **Wait for backup to complete:**
   - Look for "Backup complete" message
   - Process should release files automatically

2. **Force eject (if needed):**
   ```bash
   diskutil unmount force /Volumes/SDCARD
   ```

3. **Check for processes using volume:**
   ```bash
   lsof | grep /Volumes/SDCARD
   ```

---

### Problem: Slow backup performance

**Causes:**
- Large disk images (>1GB)
- Slow SD card reader
- USB 2.0 instead of USB 3.0

**Solutions:**

1. **Use faster card reader:**
   - USB 3.0/3.1 card reader recommended
   - Built-in SD card readers are often slower

2. **Expected performance:**
   - USB 3.0: ~50-100 MB/s
   - USB 2.0: ~20-30 MB/s
   - USB 1.1: ~1 MB/s (very slow)

3. **Monitor progress:**
   ```bash
   akai-backup --source /Volumes/SDCARD
   # Progress output shows MB processed
   ```

4. **Large files are normal:**
   - S5000/S6000 hard disk images can be 500MB - 2GB+
   - Initial backup is slower (copies everything)
   - Subsequent backups are fast (incremental)

---

## CLI Reference

### Command Syntax

```bash
akai-backup [command] [interval] [options]
```

### Commands

**backup** (default)
```bash
akai-backup backup [interval] [options]
# Or short form:
akai-backup [options]
```

### Intervals

- `daily` (default)
- `weekly`
- `monthly`

### Options for Local Media

**--source <path>**
- Local filesystem path to backup from
- Example: `/Volumes/SDCARD`, `/media/user/USB`
- Required for local media backups

**--subdir <name>**
- Custom subdirectory name in backup location
- Default: Auto-generated from source path
- Example: `gotek`, `my-s3000xl`

### Examples

**Basic local backup:**
```bash
akai-backup --source /Volumes/SDCARD
```

**Weekly backup with custom subdirectory:**
```bash
akai-backup backup weekly --source /Volumes/GOTEK --subdir gotek-s5k
```

**Monthly backup:**
```bash
akai-backup backup monthly --source /media/$USER/USB
```

**Traditional remote backup (no --source flag):**
```bash
akai-backup backup daily
akai-backup backup weekly --config ~/.audiotools/custom-config.conf
```

---

## Best Practices

### 1. Regular Backup Schedule

**Recommended:**
- Daily backups during active work
- Weekly backups for stable libraries
- Monthly backups for archival

**Example schedule:**
```bash
# Daily during project work
akai-backup --source /Volumes/SDCARD

# Weekly on Sundays
akai-backup backup weekly --source /Volumes/SDCARD

# Monthly on 1st of month
akai-backup backup monthly --source /Volumes/SDCARD
```

---

### 2. Organize by Sampler or Project

Use `--subdir` to keep sources organized:

```bash
# Organize by sampler model
akai-backup --source /Volumes/GOTEK --subdir s3000xl-floppies
akai-backup --source /Volumes/ZULU --subdir s5000-harddrives

# Organize by project
akai-backup --source /Volumes/SDCARD --subdir project-drums
akai-backup --source /Volumes/SDCARD --subdir project-synths
```

---

### 3. Verify Backups Periodically

**Check backup integrity:**
```bash
# List backed-up files
ls -lR ~/.audiotools/backup/daily.0/

# Extract and verify programs load
akai-extract batch --source ~/.audiotools/backup/daily.0/sdcard
```

---

### 4. Keep Multiple Backup Copies

**Don't rely on a single backup location:**

1. **Local backups** (fast, primary)
   ```bash
   akai-backup --source /Volumes/SDCARD
   ```

2. **Copy to external drive** (secondary)
   ```bash
   rsync -av ~/.audiotools/backup/ /Volumes/ExternalHD/backups/
   ```

3. **Cloud sync** (tertiary, off-site)
   ```bash
   # Example: Sync to Dropbox or similar
   rsync -av ~/.audiotools/backup/ ~/Dropbox/sampler-backups/
   ```

---

### 5. Clean Up Old Backups

Backup rotation is automatic (7 daily, 4 weekly, 12 monthly), but you can manually clean up if needed:

```bash
# Remove all backups (CAUTION!)
rm -rf ~/.audiotools/backup/*

# Remove old daily backups only
rm -rf ~/.audiotools/backup/daily.{3..6}

# Archive old backups before deleting
tar czf backups-archive-$(date +%Y%m%d).tar.gz ~/.audiotools/backup/
```

---

### 6. Label Your Media

**Physical labels help prevent confusion:**
- Label SD cards: "S3000XL Bank A", "S5000 HD0", etc.
- Track which media has been backed up
- Date labels when creating backups

---

## Integration with Existing Workflows

### With sampler-export

Local backups integrate seamlessly with extraction:

```bash
# 1. Backup local media
akai-backup --source /Volumes/SDCARD --subdir gotek

# 2. Extract programs/samples
akai-extract batch --source ~/.audiotools/backup

# 3. Use extracted files in your DAW
```

### With Remote Backups

Local and remote backups coexist:

```bash
# Backup from networked PiSCSI
akai-backup backup daily

# Backup from local SD card
akai-backup --source /Volumes/SDCARD --subdir local

# Both appear in ~/.audiotools/backup/daily.0/
```

### With Version Control

For advanced users, version control your backups:

```bash
cd ~/.audiotools/backup
git init
git add .
git commit -m "Daily backup $(date +%Y-%m-%d)"

# After each backup:
git add .
git commit -m "Local media backup"
```

---

## FAQ

**Q: Can I backup from network drives (NFS, SMB)?**

A: Yes, if the network drive is mounted locally. Example:
```bash
# Mount network share
mount -t nfs server:/share /mnt/network

# Backup
akai-backup --source /mnt/network
```

**Q: What if my SD card has both disk images and other files?**

A: Only disk images (`.hds`, `.img`, `.iso`) are backed up. Other files are ignored.

**Q: Can I backup to a custom location instead of ~/.audiotools/backup?**

A: Not via CLI currently. Use a symlink as a workaround (see Advanced Usage).

**Q: Do I need rsnapshot installed for local media backups?**

A: No! Local media backups don't use rsnapshot. Only remote SSH backups require rsnapshot.

**Q: Can I use this on Windows?**

A: Windows is not supported. Use WSL2 (Windows Subsystem for Linux) instead.

**Q: Will this work with CD-ROMs or DVDs?**

A: Yes, if they contain `.iso`, `.img`, or `.hds` files. The media must be mounted and readable.

**Q: How do I delete a specific backup?**

A:
```bash
# Delete specific interval
rm -rf ~/.audiotools/backup/daily.3

# Delete specific subdirectory from all intervals
rm -rf ~/.audiotools/backup/*/gotek
```

**Q: Can I schedule automatic backups?**

A: Yes, use cron (Linux/macOS):
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM (example)
0 2 * * * /usr/local/bin/akai-backup --source /Volumes/SDCARD >> ~/backup.log 2>&1
```

---

## Next Steps

- **[API Reference](api-reference.md)** - Programmatic usage for integration
- **[Platform Compatibility](platform-compatibility.md)** - Platform-specific details
- **[Troubleshooting Guide](../../troubleshooting.md)** - More troubleshooting help
- **[Examples](../../examples.md)** - More workflow examples

---

## Support

**Issues or Questions:**
- GitHub Issues: [Report a bug](https://github.com/yourusername/audio-tools/issues)
- Discussions: [Ask questions](https://github.com/yourusername/audio-tools/discussions)

**Documentation Feedback:**
- Submit improvements via pull request
- Report documentation errors as issues
