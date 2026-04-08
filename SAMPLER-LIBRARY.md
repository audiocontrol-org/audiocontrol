# Sampler Library Architecture

This document describes the theory of operation for the audiocontrol sampler library — how sampler data is stored, organized, and moved between storage zones.

## Four-Zone Storage Model

Sampler data exists in four distinct storage zones. Each zone has its own format, constraints, and semantics. Moving data between zones requires explicit conversion at the boundary.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│ Sampler Disk │ ←→ │Device Memory │ ←→ │ Device-Specific  │ ←→ │ Common Area  │
│              │    │              │    │    Library        │    │              │
│ Akai SCSI    │    │ S3K RAM      │    │ library/s3k/     │    │ library/     │
│ Roland floppy│    │ Roland DRAM  │    │ library/s330/    │    │   common/    │
└──────────────┘    └──────────────┘    └──────────────────┘    └──────────────┘
       ↑                   ↑                     ↑                     ↑
  Native disk         Native RAM            Faithful copy        Vendor-agnostic
  format              format                of device format     representation
```

### Zone 1: Sampler Disk

Physical storage media attached to the sampler — Akai SCSI hard drives, Roland floppy disks, etc. Data is in the sampler's native disk format (e.g., Akai S1000/S3000 partition format, Roland S-series disk format).

- **Access**: Via SCSI bridge (PiSCSI + scsi-midi-bridge) or disk image files
- **Format**: Vendor-specific binary (Akai partition tables, FAT entries, program/sample headers)
- **Operations**: Browse, read files, write files
- **Modules**: `sampler-devices` (disk parsers/writers), `midi-core` (SCSI disk client)

### Zone 2: Device Memory

The sampler's volatile RAM — what's loaded and playable right now. Data is in the device's native in-memory format.

- **Access**: Via MIDI SysEx (Akai RPDATA/PDATA, Roland DT1/RQ1) or MIDI SDS (samples)
- **Format**: Device-native (S3K program headers + keygroup headers + sample data, Roland tone/patch parameters + wave data)
- **Operations**: Read/write individual objects, transfer samples via SDS
- **Modules**: `sampler-devices` (device clients), `midi-core` (SysEx + SDS protocols)

### Zone 3: Device-Specific Library

Local storage that faithfully mirrors device-native objects. Stored on the user's machine (OPFS, local filesystem, or cloud) under a device-specific path. Objects here are serialized copies of what was on the device or disk — no interpretation or abstraction applied.

- **Path**: `library/{device}/` (e.g., `library/s3k/programs/`, `library/s330/tones/`, `library/s330/sets/`)
- **Format**: YAML + binary (SysEx bytes for S3K programs, tone/patch YAML for Roland, WAV for samples)
- **Operations**: Save from device/disk, load back to device, organize in folders
- **Key property**: No information loss — a round-trip through the device-specific library produces the same device state

### Zone 4: Common Area

Vendor-agnostic storage using abstract, portable representations. Objects here can be imported into any supported sampler (with appropriate conversion).

- **Path**: `library/common/samples/`
- **Format**: YAML metadata + WAV audio. Schemas defined in `sampler-library/src/schemas/`
- **Object types**:
  - **Sample** (`sample.yaml` + `sample.wav`) — audio with metadata (sample rate, loop points, root key)
  - **Program** (`program.yaml` + WAV files) — zones mapping samples to key/velocity ranges (analogous to SFZ)
- **Key property**: Portable across devices — any sampler can import common-area objects through its converter

## Conversion Boundaries

Each arrow in the diagram represents a conversion boundary. Crossing a boundary requires explicit translation between the two formats. Converters live in `sampler-devices` (for device-specific ↔ common translations) and in the editor modules (for UI-driven transfer workflows).

### Disk ↔ Device Memory

Native to both sides — the sampler itself handles this (load/save from disk). The SCSI bridge can also read/write disk data directly, bypassing the sampler's own disk I/O.

### Device Memory ↔ Device-Specific Library

Serialization/deserialization of device-native objects:
- **Export**: Read object from device via SysEx/SDS → serialize to YAML/WAV → save to `library/{device}/`
- **Import**: Read YAML/WAV from `library/{device}/` → deserialize → write to device via SysEx/SDS

### Disk ↔ Device-Specific Library

Similar to device memory, but reading/writing from disk format instead of RAM:
- **Export**: Parse disk binary → serialize to YAML/WAV → save to `library/{device}/`
- **Import**: Read YAML/WAV → encode to disk binary → write to disk

### Device-Specific Library ↔ Common Area

This is where abstraction happens. Converters translate between device-specific representations and the vendor-agnostic common format:

- **Promote** (device-specific → common): Extract portable information from device-native format. E.g., S3K keygroups become program zones, Roland tones become samples with loop points.
- **Demote** (common → device-specific): Map abstract concepts back to device constraints. E.g., program zones become S3K keygroups with device-specific parameter ranges, common samples get Roland tone headers.

Converters: `sampler-devices/src/devices/s3000xl/akai-to-common.ts`, `common-to-akai.ts`, and the Roland `converters/` directory.

## Higher-Order Objects

Higher-order concepts like **drum kits**, **chopped samples**, and **multi-sampled instruments** are metadata annotations that exist only in the common area. They are not native to any sampler — they are interpretive layers we apply to the abstract representation.

- A **drum kit** is a program or sample with drum kit metadata (base note, pad assignments, velocity sensitivity)
- A **chopped sample** is a sample with slice definitions (start/end positions, labels, trigger mappings)
- A **multi-sampled instrument** is a program with zones spanning the full key range with velocity layers

These concepts are defined by metadata fields in the common-area schemas (`SampleYaml.drumKit`, `SampleYaml.slices`, `ProgramYaml.zones`). They do not exist in device-specific library areas.

### Why Common Area Only

Device-specific objects are faithful copies of what's on the device. The device has no concept of "drum kit" as a distinct category — an S3K program is a program regardless of whether its keygroups are mapped like a drum kit or a piano. Annotating device-specific objects with higher-order metadata would create a divergence between what's stored and what the device actually has.

Instead, higher-order annotations are applied during promotion to the common area. When a device-specific program is converted to a common-area program, the converter or the user can add drum kit metadata if appropriate. This keeps device-specific storage clean and makes higher-order concepts a property of the portable, abstract representation.

## Library Storage Layout

```
library/
├── common/
│   └── samples/                    # Common area (Zone 4)
│       ├── {sample-name}/          # Sample bundle
│       │   ├── sample.yaml         #   Metadata (sample rate, loops, slices, drum kit)
│       │   └── sample.wav          #   Audio data
│       ├── {program-name}/         # Program bundle
│       │   ├── program.yaml        #   Zones, playback settings
│       │   └── {sample}.wav        #   Referenced audio files
│       └── {subfolder}/            # User-created organization
│
├── s3k/                            # S3000XL device-specific (Zone 3)
│   └── programs/                   #   SysEx program + keygroup data (YAML)
│
├── s330/                           # Roland S-330 device-specific (Zone 3)
│   ├── tones/                      #   Tone parameters (YAML) + audio (WAV)
│   ├── patches/                    #   Patch parameters (YAML)
│   ├── sets/                       #   Complete device state snapshots
│   └── templates/                  #   Tone/patch templates
│
└── s550/                           # Roland S-550 device-specific (Zone 3)
    ├── tones/
    ├── patches/
    └── sets/
```

## Key Principles

1. **No information loss in device-specific storage** — round-trip through Zone 3 must be lossless
2. **Conversion is explicit** — data doesn't silently change format when moved between zones
3. **Higher-order concepts are common-area only** — device-specific objects are stored without interpretation
4. **Common area is portable** — any object in `library/common/` should be importable to any supported sampler (via its converter)
5. **Converters are device-specific** — each sampler has its own promote/demote logic, accounting for its unique parameter ranges and constraints
