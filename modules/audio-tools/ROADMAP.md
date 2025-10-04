# Akai Sampler Tools - Development Roadmap

**Last Updated:** 2025-10-04
**Status:** Active Development

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

## Phase 1: Local Media Support

**Goal:** Support SD cards and USB drives from floppy emulators and non-networked SCSI emulators (ZuluSCSI, etc.)

**Priority:** High
**Status:** Not started

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

## Phase 2: Cross-Platform Binary Support

**Goal:** Bundle mtools for all platforms (zero-configuration installation)

**Priority:** High
**Status:** In Progress (macOS ARM64 ✅)

**Requirements:**
- [ ] macOS Intel (darwin-x64)
- [ ] Linux x64 (linux-x64)
- [ ] Linux ARM64 (linux-arm64)
- [ ] Windows x64 (win32-x64)
- [ ] Fallback to system mtools if bundled binary unavailable
- [ ] Package size < 5MB total

---

## Phase 2: User-Friendly Distribution

**Goal:** Make tools accessible to non-technical users through multiple distribution channels.

**Priority:** High
**Timeline:** 4-6 weeks
**Status:** Planning

See [DISTRIBUTION.md](./DISTRIBUTION.md) for detailed analysis of distribution options.

### 2.1 NPM Global Install (Immediate)

**Status:** Ready to implement
**Effort:** Low (1-2 days)

- [ ] Publish `@oletizi/sampler-backup` to npm registry
- [ ] Publish `@oletizi/sampler-export` to npm registry
- [ ] Create meta-package `@oletizi/akai-tools`
  - Depends on both backup and export packages
  - Provides unified CLI
- [ ] Add post-install script to check for rsnapshot
- [ ] Document installation in README

**Installation:**
```bash
npm install -g @oletizi/akai-tools
```

### 2.2 One-Line Installer Script (High Priority)

**Status:** Not started
**Effort:** Medium (3-5 days)

Create cross-platform installer script that handles:

**macOS:**
```bash
curl -fsSL https://akai-tools.example.com/install.sh | bash
```

**Features:**
- Detect OS (macOS/Linux/Windows WSL)
- Install system dependencies:
  - rsnapshot (via Homebrew/apt/yum)
  - Node.js via nvm (if not present, or check minimum version)
- Install akai-tools globally via npm
- Run configuration test (`akai-backup config --test`)
- Optionally configure SSH keys to PiSCSI
- Optionally create scheduled backup (LaunchAgent/cron)
- Print success message with next steps

**Deliverables:**
- [ ] `install.sh` script
- [ ] macOS installation logic
- [ ] Linux installation logic (apt/yum)
- [ ] Windows WSL installation logic
- [ ] SSH key setup wizard
- [ ] Scheduled backup setup
- [ ] Comprehensive error handling
- [ ] Rollback on failure

### 2.3 Homebrew Tap (macOS Priority)

**Status:** Not started
**Effort:** Medium (2-3 days)

- [ ] Create `homebrew-akai-tools` tap repository
- [ ] Write Homebrew formula
  - Depends on: node, rsnapshot
  - Installs: akai-tools npm package globally
  - Post-install: Configuration wizard
  - Optional: Create LaunchAgent for scheduled backups
- [ ] Test formula installation
- [ ] Document tap usage in README
- [ ] (Optional) Submit to `homebrew-core` for wider distribution

**Installation:**
```bash
brew tap oletizi/akai-tools
brew install akai-tools

# Or if accepted to homebrew-core:
brew install akai-tools
```

### 2.4 Standalone Executables (Optional)

**Status:** Not started
**Effort:** Medium (3-4 days)
**Priority:** Medium

Bundle Node.js runtime with tools for users who avoid npm:

**Using `bun build --compile`:**
```bash
bun build --compile --target=bun-darwin-arm64 ./src/cli/backup.ts
bun build --compile --target=bun-darwin-x64 ./src/cli/backup.ts
bun build --compile --target=bun-linux-x64 ./src/cli/backup.ts
```

**Deliverables:**
- [ ] Build scripts for each platform
- [ ] GitHub Actions workflow for releases
- [ ] macOS code signing (requires Apple Developer account)
- [ ] Windows code signing (optional)
- [ ] Upload to GitHub Releases
- [ ] Update README with download links

**Pros:** No Node.js installation required
**Cons:** Large file size (~50-80MB per binary), code signing complexity

---

## Phase 3: Enhanced User Experience

**Goal:** Provide graphical and web-based interfaces for non-CLI users.

**Priority:** Medium
**Timeline:** 4-8 weeks
**Status:** Future

### 3.1 Web Dashboard (Recommended)

**Effort:** High (1-2 weeks)
**Target Audience:** Beginners, visual learners

**Features:**
- Browser-based interface (`localhost:3000`)
- Visual buttons for backup/extract
- Real-time progress bars
- Disk space monitoring
- View extraction results
- Schedule automatic backups
- Browse extracted samples
- Logs viewer

**Technology Stack:**
- Backend: Express/Fastify + existing CLI tools
- Frontend: React or Svelte (lightweight)
- WebSocket for real-time updates
- Persistent storage: SQLite

**Mockup:**
```
┌─────────────────────────────────────────┐
│ Akai Tools Dashboard                    │
├─────────────────────────────────────────┤
│ Status: Last backup: 2 hours ago        │
│                                          │
│ [Backup Now]  [Extract Disks]           │
│                                          │
│ Schedule: Daily at 2:00 AM  [Edit]      │
│                                          │
│ Disk Space: 145GB used / 500GB          │
│ ████████████░░░░░░░░░░░░                │
│                                          │
│ Recent Backups:                          │
│ ✓ 2025-10-04 10:00 - 22GB               │
│ ✓ 2025-10-03 10:00 - 22GB               │
│                                          │
│ [View Logs]  [Settings]                 │
└─────────────────────────────────────────┘
```

### 3.2 macOS Menu Bar App (Alternative)

**Effort:** High (2-3 weeks)
**Target Audience:** macOS users who prefer native apps

**Technology Options:**
- SwiftUI (native, best performance)
- Tauri (Rust + web frontend, cross-platform potential)
- ~~Electron~~ (too heavy)

**Features:**
- Menu bar icon with status indicator
- Click → "Backup Now", "View Backups", "Preferences"
- Native macOS notifications
- Scheduled backups via LaunchAgent
- Native file browser for extracted samples
- Calls underlying CLI tools via shell

**Deliverables:**
- [ ] SwiftUI/Tauri application
- [ ] Menu bar integration
- [ ] Notification system
- [ ] Shell integration with CLI tools
- [ ] Code signing for macOS
- [ ] (Optional) Mac App Store submission

---

## Phase 4: PiSCSI Integration

**Goal:** Integrate backup functionality directly into PiSCSI web interface.

**Priority:** Low (pending PiSCSI project interest)
**Timeline:** TBD
**Status:** Future

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

## Phase 5: Advanced Features

**Goal:** Enhance functionality based on user feedback.

**Priority:** Low
**Timeline:** TBD
**Status:** Future

### 5.1 Cloud Integration

- [ ] Sync backups to cloud storage
  - S3-compatible (AWS S3, Backblaze B2, MinIO)
  - Google Drive
  - Dropbox
- [ ] Remote access to extracted samples
- [ ] Multi-device sync
- [ ] Encryption at rest

### 5.2 Notification System

- [ ] Desktop notifications (node-notifier)
- [ ] Email alerts on backup failure
- [ ] Slack/Discord webhooks
- [ ] SMS alerts (Twilio integration)
- [ ] Health check endpoints

### 5.3 Analytics & Telemetry (Opt-in)

- [ ] Usage patterns tracking
- [ ] Error reporting (Sentry)
- [ ] Performance metrics
- [ ] Help improve reliability

### 5.4 Enhanced Format Support

- [ ] Akai MPC disk formats
- [ ] Other sampler formats (Roland, Ensoniq, etc.)
- [ ] CD-ROM images (ISO)
- [ ] Zip disk images

### 5.5 Sample Library Management

- [ ] Tag and categorize samples
- [ ] Search by metadata (BPM, key, instrument)
- [ ] Favorite samples
- [ ] Export sample collections
- [ ] Share sample libraries

---

## Implementation Priorities

### Immediate (Next 2 Weeks)
1. **Complete cross-platform binary support** (Phase 1.1)
   - Linux x64, macOS x64, Linux ARM64
2. **Publish to npm** (Phase 2.1)
   - Make tools available to early adopters

### Short-term (Next Month)
3. **Create installer script** (Phase 2.2)
   - One-line installation for macOS/Linux
4. **Homebrew tap** (Phase 2.3)
   - Native macOS experience

### Medium-term (Next Quarter)
5. **Choose GUI option** (Phase 3)
   - Decision based on user feedback
   - Web dashboard OR macOS menu bar app

### Long-term (Future)
6. **PiSCSI integration** (Phase 4)
   - Community collaboration
7. **Advanced features** (Phase 5)
   - Based on user requests

---

## Success Metrics

### Technical Metrics
- ✅ Zero-configuration installation on 95%+ of systems
- ✅ Package size < 5MB (with all binaries)
- ✅ Extraction success rate > 99% (excluding corrupt disks)
- ✅ Backup completion time < 5 minutes (for typical 20GB disk)

### User Experience Metrics
- Installation time < 2 minutes (automated installer)
- First successful backup < 5 minutes from install
- Documentation clarity (measured by support requests)
- User satisfaction (GitHub stars, feedback)

### Adoption Metrics
- npm downloads per week
- GitHub stars
- Community contributions (PRs, issues)
- PiSCSI community adoption

---

## Contributing

See individual phase sections for specific tasks. Each task is marked with:
- [ ] Not started
- [x] Completed

Community contributions welcome! Priority areas:
1. Testing on different platforms
2. Binary acquisition for Linux/Windows
3. Documentation improvements
4. Bug reports and feature requests

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
