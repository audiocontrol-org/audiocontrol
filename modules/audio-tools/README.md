# Audio Tools

Monorepo of experimental tools for manipulating software and hardware audio devices.

## Installation

### Quick Install (Recommended)

Install the latest stable version directly from GitHub Releases:

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-alpha.38/install.sh | bash
```

**Or download and inspect first:**

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-alpha.38/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

**Verify installer integrity (optional):**

```bash
# Download checksum
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-alpha.38/install.sh.sha256 -o install.sh.sha256

# Verify checksum (macOS/Linux)
shasum -a 256 -c install.sh.sha256
```

**Note:** This is the audio-tools module within the ol_dsp monorepo. See [all audio-tools releases](https://github.com/oletizi/ol_dsp/releases?q=audio-tools) for version history.

### Version-Specific Installation

To install a specific version:

```bash
# Replace VERSION with desired version (e.g., 1.0.0-alpha.4)
VERSION="1.0.0-alpha.4"
curl -fsSL "https://github.com/oletizi/ol_dsp/releases/download/audio-tools@${VERSION}/install.sh" | bash
```

### Alternative: npm Installation

Install packages individually via npm:

```bash
npm install -g @oletizi/sampler-backup @oletizi/sampler-export
```

**Note:** This method requires manual configuration. See individual package READMEs.

### What the Installer Does

The installer will:
1. Verify system requirements (Node.js 18+, disk space)
2. Install npm packages globally (`@oletizi/sampler-backup`, `@oletizi/sampler-export`)
3. Provide quick start guide for backup and extraction

**Installation takes approximately 2-5 minutes.**

See the [Installation Guide](./docs/1.0/INSTALLATION.md) for detailed instructions, troubleshooting, and system requirements.

---

## Sampler Lib
![sampler-lib](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-lib.yml/badge.svg)

npm i [@oletizi/sampler-lib](https://www.npmjs.com/package/@oletizi/sampler-lib)

## Sampler Devices
![sampler-devices](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-devices.yml/badge.svg)

npm i [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices)

* Binary format parsers for Akai S3000xl and S5000/S6000 program files
* Pure TypeScript - No native dependencies

## Sampler MIDI
![sampler-midi](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-midi.yml/badge.svg)

npm i [@oletizi/sampler-midi](https://www.npmjs.com/package/@oletizi/sampler-midi)

* MIDI communication clients for Akai S3000xl hardware
* Send/receive SysEx messages for program and sample management

## Sampler Translate
![sampler-translate](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-translate.yml/badge.svg)

npm i [@oletizi/sampler-translate](https://www.npmjs.com/package/@oletizi/sampler-translate)

* (Currently limited) support for translating Akai MPC and Decent Sampler programs to Akai S5000/S6000 sampler programs
* Support for chopping wav files into Akai S3000xl programs.

## Sampler Backup

Rsnapshot-based backup utility for Akai hardware samplers via PiSCSI.

* Automated incremental backups with smart same-day resume
* Space-efficient hard-linking across snapshots
* Configurable retention (7 daily, 4 weekly, 12 monthly)
* SSH-based remote transfer with partial resume support

**Quick start:**
```bash
# Generate configuration and run backup
pnpm --filter sampler-backup build
akai-backup config --test
akai-backup batch
```

[Documentation →](./sampler-backup/README.md)

## Sampler Export

Extract Akai disk images and convert programs to modern formats (SFZ, DecentSampler).

* Batch extraction with timestamp-based change detection
* Automatic format conversion (SFZ, DecentSampler)
* Integrates with sampler-backup rsnapshot structure
* Status indicators for extraction progress

**Quick start:**
```bash
# Extract all disks from rsnapshot backups
pnpm --filter sampler-export build
akai-extract batch
```

[Documentation →](./sampler-export/README.md)

## One-Click Workflow

Backup and extract in a single command:

```bash
# Backup samplers via PiSCSI, then extract disk images
pnpm backup-and-extract
```

This runs:
1. `akai-backup batch` - Creates/updates rsnapshot backups from hardware samplers
2. `akai-extract batch` - Extracts and converts disk images to modern formats

**Directory structure:**
```
~/.audiotools/
├── backup/                    # Rsnapshot backups
│   └── daily.0/              # Latest snapshot
│       └── pi-scsi2/
│           └── home/orion/images/
│               ├── HD0.hds
│               └── ...
├── sampler-export/           # Extraction output
│   └── extracted/
│       ├── s5k/             # S5000/S6000
│       │   ├── HD0/
│       │   │   ├── samples/
│       │   │   ├── programs/
│       │   │   ├── sfz/
│       │   │   └── decentsampler/
│       │   └── ...
│       └── s3k/             # S3000XL
└── rsnapshot.conf           # Backup configuration
```
