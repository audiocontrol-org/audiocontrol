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
- Local media support (SD cards, USB drives) - MVP complete

**Extraction System** (`@oletizi/sampler-export`)
- Native Akai format extraction (akaitools integration)
- DOS/FAT32 disk support with bundled mtools (macOS ARM64)
- Automatic format detection (boot sector signature)
- Sample conversion: .a3s → WAV
- Program conversion: .a3p/.akp → SFZ, DecentSampler
- Batch extraction with timestamp-based change detection
- Smart content detection (skip empty disks)
- Warning vs. error distinction (exit code 0 for unsupported formats)
- Dynamic sampler discovery (no hardcoded paths)

**Platform Support**
- ✅ macOS Apple Silicon (darwin-arm64) - Full support
- ⚠️ Other platforms - Requires system mtools installation

---

## Code Cleanup

**Goal:** Clean up and complete ongoing refactoring before wider distribution

**Requirements:**
- [ ] Complete ongoing refactoring work
- [ ] Improve code organization and modularity
- [ ] Add comprehensive error handling
- [ ] Improve logging and user feedback
- [ ] Add tests for critical paths
- [ ] Document public APIs
- [ ] Remove dead code and unused dependencies
- [ ] Standardize file and directory structure

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

### Local Media Support Enhancements

**MVP complete for v1.0.0.** Future enhancements:

- [ ] Auto-detect mounted SD cards/USB drives containing disk images
- [ ] Monitor for newly inserted media (hot-plug detection)
- [ ] Automatic backup on media insertion
- [ ] Validation and integrity checking
- [ ] Media eject automation after backup

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
