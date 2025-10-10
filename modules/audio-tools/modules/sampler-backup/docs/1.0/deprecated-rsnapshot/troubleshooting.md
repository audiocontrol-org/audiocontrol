## Troubleshooting

### "rsnapshot command not found"

**Problem:** rsnapshot is not installed or not in PATH

**Solution:**
```bash
# macOS
brew install rsnapshot

# Linux (Debian/Ubuntu)
sudo apt-get install rsnapshot

# Linux (RedHat/CentOS)
sudo yum install rsnapshot

# Verify installation
which rsnapshot
rsnapshot --version
```

### "Source directory doesn't exist"

**Problem:** Remote path is incorrect or SSH connection fails

**Solution:**
```bash
# 1. Verify SSH access
ssh pi-scsi2.local
# Should connect without password (use SSH keys)

# 2. Check remote path
ssh pi-scsi2.local "ls -la ~/images/"
# Should list disk images

# 3. Update sourcePath in configuration if path is different
akai-backup config
# Edit ~/.audiotools/rsnapshot.conf manually
```

### "Permission denied" on remote host

**Problem:** SSH key authentication not set up

**Solution:**
```bash
# 1. Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096

# 2. Copy key to remote host
ssh-copy-id pi-scsi2.local

# 3. Test passwordless login
ssh pi-scsi2.local
# Should connect without password prompt
```

### Partial transfers not resuming

**Problem:** Using raw rsnapshot command instead of CLI wrapper

**Solution:**
```bash
# ✗ WRONG - No smart rotation
rsnapshot daily

# ✓ CORRECT - Smart rotation + resume
akai-backup batch
```

The smart rotation logic only works when using `akai-backup` CLI commands.

### "Config file has errors"

**Problem:** Invalid rsnapshot.conf syntax

**Solution:**
```bash
# Test configuration
akai-backup test

# Common issues:
# - Missing tabs (rsnapshot requires TABS, not spaces)
# - Trailing slash on snapshot_root is required
# - Command paths must be absolute
# - Backup source paths must end with /

# Regenerate clean configuration
akai-backup config --test
```

### Backup is slow

**Problem:** Large disk images take time to transfer

**Solutions:**
```bash
# 1. Use compression (edit ~/.audiotools/rsnapshot.conf)
# Add to rsync_long_args:
rsync_long_args    --delete --numeric-ids --relative --delete-excluded -z

# 2. Run backup overnight via cron
crontab -e
# Add: 0 2 * * * /usr/local/bin/akai-backup batch

# 3. Resume interrupted transfers (automatic with akai-backup batch)
akai-backup batch  # Run multiple times, it will resume
```

### "No space left on device"

**Problem:** Backup destination is full

**Solution:**
```bash
# 1. Check disk space
df -h ~/.audiotools/backup

# 2. Reduce retention policy
# Edit ~/.audiotools/rsnapshot.conf:
retain    daily    3     # Reduce from 7 to 3
retain    weekly   2     # Reduce from 4 to 2
retain    monthly  6     # Reduce from 12 to 6

# 3. Manually delete old snapshots
rm -rf ~/.audiotools/backup/monthly.*
rm -rf ~/.audiotools/backup/weekly.3

# 4. Move backup to larger drive
# Edit snapshot_root in ~/.audiotools/rsnapshot.conf
```

### Multiple samplers, some fail

**Problem:** One sampler is offline but backup continues

**Solution:**
This is expected behavior. Rsnapshot will continue backing up available samplers even if one fails. Check logs for specific errors:

```bash
# Run with verbose output
akai-backup backup daily

# Check for specific sampler errors
# Example output:
#   ✓ pi-scsi2.local: Success
#   ✗ s3k.local: Connection refused
```

To exclude offline samplers, comment them out in configuration:

```conf
# S3K offline for maintenance
# backup    s3k.local:/home/orion/images/    s3k/
```

### SSH connection timeout

**Problem:** Remote host is slow to respond

**Solution:**
```bash
# Edit ~/.audiotools/rsnapshot.conf
# Add SSH timeout to ssh_args:
ssh_args    -o ConnectTimeout=10 -o ServerAliveInterval=60
```

### Backup verification

**Problem:** Want to verify backup integrity

**Solution:**
```bash
# 1. List latest snapshot contents
ls -lh ~/.audiotools/backup/daily.0/pi-scsi2/home/orion/images/

# 2. Compare file sizes
du -sh ~/.audiotools/backup/daily.0/pi-scsi2/

# 3. Verify with rsync dry-run
rsync -avn pi-scsi2.local:/home/orion/images/ \
  ~/.audiotools/backup/daily.0/pi-scsi2/home/orion/images/
# Should show "no changes" if backup is complete

# 4. Check specific disk image
file ~/.audiotools/backup/daily.0/pi-scsi2/home/orion/images/HD0.hds
# Should identify as valid disk image
```

