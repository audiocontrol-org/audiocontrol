# Distribution Strategies for Akai Sampler Backup & Extract Tools

This document outlines potential distribution strategies for making the backup and extract functionality accessible to PiSCSI users without requiring deep technical expertise.

## Current State

The tools are currently distributed as:
- TypeScript packages in a pnpm monorepo
- CLI tools (`akai-backup`, `akai-extract`)
- Requires: Node.js 18+, pnpm, rsnapshot

**Target audience:** PiSCSI users who want to backup and extract Akai sampler disk images

## Distribution Options

### 1. NPM Global Install

**Description:** Publish packages to npm registry for global installation.

```bash
npm install -g @oletizi/sampler-backup @oletizi/sampler-export

# Or via meta-package
npm install -g @oletizi/akai-tools
```

**Implementation:**
- Publish existing packages to npm registry
- Create meta-package that installs both tools
- Add post-install scripts to check for rsnapshot
- Provide setup wizard via `npx akai-tools setup`

**Pros:**
- Standard Node.js distribution method
- Easy updates via `npm update -g`
- Works cross-platform (macOS, Linux, Windows)
- Version management built-in
- Familiar to developers

**Cons:**
- Requires Node.js knowledge
- Users must install rsnapshot separately
- Not beginner-friendly
- Requires understanding of global npm packages

**Target audience:** Developers, technically savvy users

**Implementation effort:** **Low (1-2 days)**
- Packages already structured for npm
- Need to add post-install checks
- Create meta-package

**Maintenance:** Low - automated npm publishing

---

### 2. One-Line Installer Script

**Description:** Shell script that handles entire setup process.

```bash
# macOS/Linux users
curl -fsSL https://akai-tools.example.com/install.sh | bash

# Or downloaded version
bash <(curl -fsSL https://akai-tools.example.com/install.sh)
```

**The installer would:**
1. Detect OS (macOS/Linux/Windows WSL)
2. Install system dependencies:
   - rsnapshot (via Homebrew/apt/yum)
   - Node.js via nvm (if not present)
3. Install akai-tools globally via npm
4. Run `akai-backup config --test` to verify
5. Optionally configure SSH keys to PiSCSI
6. Optionally create scheduled backup (LaunchAgent/cron)
7. Print success message with next steps

**Pros:**
- **Best quick-start experience**
- One command handles everything
- Abstracts away technical details
- Can handle platform-specific setup
- Minimal user input required

**Cons:**
- Requires trust in install script
- Platform-specific edge cases
- Harder to debug failures
- Requires hosting install script
- Security implications of `curl | bash`

**Target audience:** All users, especially beginners

**Implementation effort:** **Medium (3-5 days)**
- Handle macOS (Homebrew), Linux (apt/yum), Windows WSL
- Error handling and rollback
- SSH key setup wizard
- Test across platforms

**Maintenance:** Medium - update for new OS versions

**Example install.sh structure:**
```bash
#!/bin/bash
set -e

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Darwin*)    install_macos;;
    Linux*)     install_linux;;
    *)          echo "Unsupported OS"; exit 1;;
esac

install_macos() {
    # Check for Homebrew, install if needed
    # Install rsnapshot
    # Install Node.js via nvm
    # Install akai-tools globally
    # Setup SSH keys
    # Create LaunchAgent
}
```

---

### 3. Standalone Executables

**Description:** Single binary files with bundled Node.js runtime.

**Using pkg:**
```bash
# Download for your platform
curl -LO https://github.com/oletizi/akai-tools/releases/latest/akai-backup-macos-arm64
curl -LO https://github.com/oletizi/akai-tools/releases/latest/akai-extract-macos-arm64

chmod +x akai-backup-macos-arm64
./akai-backup-macos-arm64 batch
```

**Using bun build:**
```bash
bun build --compile --target=bun-darwin-arm64 ./src/cli/backup.ts
```

**Implementation:**
- Bundle with pkg or bun
- Create binaries for:
  - macOS (Intel, Apple Silicon)
  - Linux (x64, arm64)
  - Windows (optional)
- Host on GitHub Releases
- Still requires rsnapshot installed separately

**Pros:**
- No Node.js installation required
- Simple download and run
- Works offline
- Familiar executable model

**Cons:**
- Large file size (~50-80MB per binary)
- Still requires rsnapshot separately
- Platform-specific builds
- Harder to update (manual download)
- Code signing required for macOS

**Target audience:** Users who avoid Node.js ecosystem

**Implementation effort:** **Medium (3-4 days)**
- pkg/bun configuration
- Build pipeline for multiple platforms
- GitHub Actions for releases
- macOS code signing setup

**Maintenance:** Medium - builds for each release

---

### 4. Homebrew Tap (macOS)

**Description:** Official Homebrew formula for macOS users.

```bash
brew tap oletizi/akai-tools
brew install akai-tools

# Or if accepted into homebrew-core
brew install akai-tools
```

**Formula structure:**
```ruby
class AkaiTools < Formula
  desc "Backup and extract tools for Akai samplers via PiSCSI"
  homepage "https://github.com/oletizi/akai-tools"
  url "https://github.com/oletizi/akai-tools/archive/v1.0.0.tar.gz"

  depends_on "node"
  depends_on "rsnapshot"

  def install
    system "npm", "install", "-g", "--prefix=#{prefix}"
  end
end
```

**Pros:**
- **Native macOS experience**
- Handles dependencies automatically
- Trusted distribution channel
- Easy updates (`brew upgrade`)
- Formula can create LaunchAgent

**Cons:**
- macOS only
- Requires maintaining formula
- Submission to homebrew-core takes time
- Formula review process

**Target audience:** macOS users

**Implementation effort:** **Medium (2-3 days)**
- Create homebrew-akai-tools tap repository
- Write formula
- Test installation
- Optional: submit to homebrew-core

**Maintenance:** Low-Medium - update formula for releases

---

### 5. Docker Container

**Description:** Containerized environment with all dependencies.

```bash
# Pull image
docker pull oletizi/akai-tools:latest

# Run backup
docker run -v ~/.ssh:/root/.ssh -v ~/.audiotools:/data \
  oletizi/akai-tools backup-and-extract

# Docker Compose for scheduled backups
docker-compose up -d
```

**docker-compose.yml:**
```yaml
services:
  akai-backup:
    image: oletizi/akai-tools
    volumes:
      - ~/.ssh:/root/.ssh:ro
      - ~/.audiotools:/data
    environment:
      - PISCSI_HOST=pi-scsi2.local
    command: backup-and-extract
    restart: unless-stopped
```

**Pros:**
- All dependencies bundled
- Isolated environment
- Reproducible builds
- Can run as service
- Cross-platform (with Docker Desktop)

**Cons:**
- Requires Docker knowledge
- SSH key mounting complexity
- Additional layer of abstraction
- Resource overhead
- Not beginner-friendly

**Target audience:** DevOps-savvy users, server deployments

**Implementation effort:** **Medium (3-4 days)**
- Dockerfile creation
- Multi-stage build optimization
- Docker Compose setup
- Documentation

**Maintenance:** Low - automated builds

---

### 6. Web Dashboard

**Description:** Browser-based interface for backup and extraction.

**Features:**
- Runs on `localhost:3000`
- Visual buttons for backup/extract
- Real-time progress bars
- Disk space monitoring
- View extraction results
- Schedule automatic backups
- Browse extracted samples

**Technology stack:**
- Backend: Express/Fastify + existing CLI tools
- Frontend: React or vanilla JS
- WebSocket for real-time updates

**UI mockup:**
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

**Pros:**
- **Most beginner-friendly option**
- Visual feedback and progress
- No CLI knowledge needed
- Can run on user's Mac or PiSCSI itself
- Easy to add features (notifications, cloud sync)

**Cons:**
- Significant development effort
- Requires web server running
- More complex architecture
- Potential security considerations

**Target audience:** Non-technical users, beginners

**Implementation effort:** **High (1-2 weeks)**
- Backend API development
- Frontend UI/UX design
- Real-time status updates
- Testing across browsers

**Maintenance:** Medium-High - ongoing feature requests

---

### 7. macOS Menu Bar App

**Description:** Native macOS application with menu bar icon.

**Features:**
- Menu bar icon with status indicator
- Click → "Backup Now", "View Backups", "Preferences"
- Native notifications on completion/errors
- Scheduled backups via LaunchAgent
- Native file browser for extracted samples
- Calls underlying CLI tools via shell

**Technology options:**
- SwiftUI (native)
- Electron (cross-platform, but large)
- Tauri (Rust + web frontend)

**Pros:**
- Native macOS experience
- Background operation
- System notifications
- Familiar UX pattern
- Can launch at login

**Cons:**
- macOS only
- Requires Swift/native development
- App Store distribution complexity
- Code signing requirements
- More complex than CLI

**Target audience:** macOS users who prefer GUI

**Implementation effort:** **High (2-3 weeks)**
- Swift/SwiftUI development
- Shell integration
- Notification system
- Code signing setup

**Maintenance:** Medium - OS updates, bug fixes

---

### 8. PiSCSI Plugin/Extension

**Description:** Integrate backup functionality into PiSCSI web interface.

**Architecture:**
- Service runs on PiSCSI device
- Backups stored on Pi or pushed to NAS/cloud
- Accessible via existing PiSCSI web interface
- No client software needed

**Implementation:**
- Python/Node.js service on PiSCSI
- Integrate with PiSCSI web UI
- Schedule via cron on the Pi
- API for remote triggering

**Pros:**
- Centralized solution
- No client software needed
- Works from any device with browser
- Leverages existing PiSCSI infrastructure
- Community integration opportunity

**Cons:**
- Requires PiSCSI modification/cooperation
- Limited by Pi resources (CPU, disk space)
- Depends on PiSCSI project roadmap
- More complex deployment

**Target audience:** All PiSCSI users (if integrated)

**Implementation effort:** **High (1-2 weeks)**
- Coordinate with PiSCSI project
- Adapt tools for Pi environment
- Integration with existing web UI
- Testing on Pi hardware

**Maintenance:** Medium - coordinate with PiSCSI releases

---

### 9. Automated Services (LaunchAgent/systemd)

**Description:** Platform-specific background services for automatic backups.

**macOS LaunchAgent:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.oletizi.akai-backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/akai-backup</string>
        <string>batch</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/var/log/akai-backup.log</string>
</dict>
</plist>
```

**Linux systemd timer:**
```ini
[Unit]
Description=Akai Sampler Backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/akai-backup batch

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

**Pros:**
- Fully automated, set-and-forget
- No user interaction needed
- Native OS scheduling
- Logs to system journal
- Can trigger notifications

**Cons:**
- Still requires initial setup
- Different config per platform
- Debugging requires log inspection

**Target audience:** Users who want automation

**Implementation effort:** **Low (1-2 days)**
- Template generation
- Installation scripts
- Documentation

**Maintenance:** Low - stable after initial setup

---

## Recommended Phased Approach

### Phase 1: Immediate (This Week)
**Goal:** Make tools available to early adopters

1. **Publish to npm** (#1)
   - Publish `@oletizi/sampler-backup` and `@oletizi/sampler-export`
   - Create meta-package `@oletizi/akai-tools`
   - Document manual installation

2. **Create installer script** (#2)
   - macOS/Linux one-line installer
   - Handles rsnapshot + npm installation
   - Include in README

3. **LaunchAgent templates** (#9)
   - Provide templates for scheduled backups
   - Document manual setup

**Estimated time:** 3-4 days

### Phase 2: Short-term (Next 2 Weeks)
**Goal:** Improve user experience for macOS users

4. **Homebrew tap** (#4)
   - Create `oletizi/homebrew-akai-tools`
   - Formula with dependency management
   - Automatic LaunchAgent setup

5. **Standalone executables** (#3)
   - Build with bun or pkg
   - GitHub Releases automation
   - macOS code signing

**Estimated time:** 1 week

### Phase 3: Medium-term (Next Month)
**Goal:** Expand distribution options

6. **Choose GUI option:**
   - **Option A:** Web dashboard (#6) - if broader appeal desired
   - **Option B:** macOS menu bar app (#7) - if focusing on Mac users
   - Decision based on user feedback from Phase 1-2

**Estimated time:** 2-3 weeks

### Phase 4: Long-term (Future)
**Goal:** Community integration

7. **PiSCSI integration** (#8)
   - Collaborate with PiSCSI project
   - Contribute plugin/extension
   - Potentially becomes official PiSCSI feature

8. **Additional platforms:**
   - Windows support (if demand exists)
   - Raspberry Pi native builds
   - NAS integration (Synology, QNAP)

**Estimated time:** Ongoing

---

## Decision Matrix

| Option | Effort | Maintenance | User-Friendliness | Target Audience | Priority |
|--------|--------|-------------|-------------------|-----------------|----------|
| NPM Global | Low | Low | Medium | Developers | **High** |
| Installer Script | Medium | Medium | High | All users | **High** |
| Standalone Exe | Medium | Medium | Medium | Non-Node users | **Medium** |
| Homebrew | Medium | Low | High | macOS users | **High** |
| Docker | Medium | Low | Low | DevOps | **Low** |
| Web Dashboard | High | High | Very High | Beginners | **Medium** |
| Menu Bar App | High | Medium | Very High | Mac users | **Medium** |
| PiSCSI Plugin | High | Medium | Very High | All PiSCSI users | **Low*** |
| LaunchAgent | Low | Low | Medium | Power users | **High** |

\* Priority becomes High if PiSCSI project is interested in collaboration

---

## Additional Considerations

### SSH Key Management
All solutions need to handle SSH authentication to PiSCSI:
- Interactive setup wizard to generate/copy keys
- Document manual SSH key setup
- Option to use password (less secure, but simpler)

### Error Handling & Notifications
Consider adding:
- Desktop notifications (node-notifier)
- Email alerts on backup failure
- Slack/Discord webhooks
- Health check endpoints

### Cloud Integration
Future enhancement:
- Sync backups to cloud storage (S3, Backblaze B2)
- Remote access to extracted samples
- Multi-device sync

### Analytics
Optional telemetry:
- Track usage patterns (opt-in only)
- Error reporting (Sentry)
- Help improve reliability

---

## Next Steps

1. **Gather user feedback:**
   - Survey PiSCSI community for preferences
   - Determine primary OS distribution (macOS vs Linux)
   - Assess technical skill level of target users

2. **Start with Phase 1:**
   - Low-risk, high-value options
   - Gets tools in users' hands quickly
   - Validates demand before heavy investment

3. **Iterate based on feedback:**
   - Monitor usage patterns
   - Collect feature requests
   - Prioritize Phase 2-3 based on data

---

## References

- [pkg - Package Node.js projects into executables](https://github.com/vercel/pkg)
- [Bun - Fast all-in-one JavaScript runtime](https://bun.sh/)
- [Homebrew - Package manager for macOS](https://brew.sh/)
- [PiSCSI Project](https://github.com/PiSCSI/piscsi)
- [rsnapshot](https://rsnapshot.org/)

---

**Document version:** 1.0
**Last updated:** 2025-10-04
**Status:** Planning - Not yet implemented
