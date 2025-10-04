# Akai Sampler Tools - Development Roadmap

**Last Updated:** 2025-10-04

## Vision

Provide zero-configuration, user-friendly tools for backing up and extracting Akai sampler disk images across all major platforms, with minimal technical expertise required.

---

## Current Status (v1.0.0)

### ✅ Completed Features

**Backup System** (`@oletizi/sampler-backup`)
- rsnapshot-based incremental backups
- Smart rotation (same-day resume vs. next-day rotation)
- Multi-sampler support (S5K, S3K)
- SSH-based remote backup from PiSCSI devices
- ⚠️ **Missing:** Local media support (SD cards, USB drives)

**Extraction System** (`@oletizi/sampler-export`)
- Native Akai format extraction (akaitools integration)
- DOS/FAT32 disk support with bundled mtools (macOS ARM64)
- Automatic format detection (boot sector signature)
- Sample conversion: .a3s → WAV
- Program conversion: .a3p/.akp → SFZ, DecentSampler
- Batch extraction with timestamp-based change detection
- Smart content detection (skip empty disks)
- Warning vs. error distinction (exit code 0 for unsupported formats)

**Platform Support**
- ✅ macOS Apple Silicon (darwin-arm64) - Full support
- ⚠️ Other platforms - Requires system mtools installation

---

## Local Media Support

**Target Users:** Most sampler users don't have networked PiSCSI. They use:
- Floppy emulators (Gotek, HxC)
- Non-networked SCSI emulators (ZuluSCSI, SCSI2SD)
- Direct SD card/USB access on modern computers

**Requirements:**
- [ ] Auto-detect mounted SD cards/USB drives containing disk images
- [ ] Support reading disk images directly from mounted filesystems
- [ ] Backup: copy disk images from removable media to local storage
- [ ] Extract: process disk images from removable media
- [ ] Handle common SD card filesystem formats (FAT32, exFAT)
- [ ] Detect disk image files (*.hds, *.img, *.iso)
- [ ] Optional: Monitor for newly inserted media (hot-plug detection)

**User Workflow:**
1. Remove SD card from sampler/emulator
2. Insert into laptop/desktop
3. Run `akai-tools backup --source /Volumes/SDCARD`
4. Run `akai-tools extract --source ~/.audiotools/backup`

---

## Cross-Platform Binary Support

**Goal:** Bundle mtools for all platforms (zero-configuration installation)

**Requirements:**
- [ ] macOS Intel (darwin-x64)
- [ ] Linux x64 (linux-x64)
- [ ] Linux ARM64 (linux-arm64)
- [ ] Windows x64 (win32-x64)
- [ ] Fallback to system mtools if bundled binary unavailable
- [ ] Package size < 5MB total

---

## User-Friendly Distribution

**Goal:** Make installation easy for non-technical users

See [DISTRIBUTION.md](./DISTRIBUTION.md) for detailed analysis.

**Requirements:**
- [ ] Publish to npm registry (`@oletizi/akai-tools`)
- [ ] One-line installer script (curl | bash)
- [ ] Homebrew formula (macOS)
- [ ] Standalone executables (optional)
- [ ] Automated dependency installation (rsnapshot, Node.js)

---

## Graphical Interface (Optional)

**Goal:** Provide GUI for non-technical users

**Options:**
- Web dashboard (browser-based, cross-platform)
- macOS menu bar app (native experience)
- Electron/Tauri desktop app

**Requirements:**
- [ ] Visual backup/extract controls
- [ ] Real-time progress indicators
- [ ] Schedule management
- [ ] Browse extracted samples
- [ ] Notifications on completion/errors

---

## PiSCSI Integration

**Goal:** Integrate backup functionality directly into PiSCSI web interface.

### Community Integration

- [ ] Reach out to PiSCSI project maintainers
- [ ] Discuss integration approach
  - Python/Node.js service on PiSCSI device
  - API for remote triggering
  - Integration with existing web UI
- [ ] Adapt tools for Pi environment
  - ARM64 Linux compatibility (already planned)
  - Optimize for limited Pi resources
- [ ] Create PiSCSI plugin/extension
- [ ] Documentation for PiSCSI users
- [ ] Submit PR to PiSCSI project

**Benefits if accepted:**
- Centralized solution (backup happens on PiSCSI device)
- No client software needed
- Works from any device with browser
- Becomes official PiSCSI feature

---

## Advanced Features

**Goal:** Enhance functionality based on user feedback.

### Cloud Integration

- [ ] Sync backups to cloud storage
  - S3-compatible (AWS S3, Backblaze B2, MinIO)
  - Google Drive
  - Dropbox
- [ ] Remote access to extracted samples
- [ ] Multi-device sync
- [ ] Encryption at rest

### Notification System

- [ ] Desktop notifications (node-notifier)
- [ ] Email alerts on backup failure
- [ ] Slack/Discord webhooks
- [ ] SMS alerts (Twilio integration)
- [ ] Health check endpoints

### Analytics & Telemetry (Opt-in)

- [ ] Usage patterns tracking
- [ ] Error reporting (Sentry)
- [ ] Performance metrics
- [ ] Help improve reliability

### Enhanced Format Support

- [ ] Akai MPC disk formats
- [ ] Other sampler formats (Roland, Ensoniq, etc.)
- [ ] CD-ROM images (ISO)
- [ ] Zip disk images

### Sample Library Management

- [ ] Tag and categorize samples
- [ ] Search by metadata (BPM, key, instrument)
- [ ] Favorite samples
- [ ] Export sample collections
- [ ] Share sample libraries

---

## Contributing

Community contributions welcome:
- Testing on different platforms
- Binary acquisition for Linux/Windows
- Documentation improvements
- Bug reports and feature requests

---

## References

- [DISTRIBUTION.md](./DISTRIBUTION.md) - Detailed distribution strategy analysis
- [sampler-backup/README.md](./sampler-backup/README.md) - Backup tool documentation
- [sampler-export/README.md](./sampler-export/README.md) - Extraction tool documentation
- [PiSCSI Project](https://github.com/PiSCSI/piscsi)
- [rsnapshot](https://rsnapshot.org/)
- [mtools](https://www.gnu.org/software/mtools/)

---

**Questions or suggestions?** Open an issue on GitHub!
