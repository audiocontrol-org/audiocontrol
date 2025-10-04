# Audio Tools

Monorepo of experimental tools for manipulating software and hardware audio devices.

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
