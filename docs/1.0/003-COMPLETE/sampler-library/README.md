# Sampler Library System

**Status:** Planning
**Branch:** `feature/sampler-library`
**Milestone:** TBD

## Overview

A device-agnostic library system for storing, editing, and restoring sampler data using human-readable YAML files. Includes a template engine for creating drum kits and multi-layer instruments from high-level descriptions.

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, scope
- [Workplan](./workplan.md) - Implementation phases and technical approach
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Quick Links

- **Repository:** [audiocontrol-org/audiocontrol](https://github.com/audiocontrol-org/audiocontrol)
- **Feature Branch:** `feature/sampler-library`
- **Module Path:** `modules/sampler-library/`

## Library Structure

```
~/.audiotools/library/
├── s330/
│   ├── tones/
│   │   ├── Kick_01.yaml
│   │   └── Kick_01.wav
│   ├── patches/
│   │   └── DrumKit_01.yaml
│   └── templates/
│       ├── drum-kit.yaml
│       └── velocity-layer.yaml
├── jv1080/                     # Future
└── d110/                       # Future
```

## Key Features

1. **Human-readable YAML format** - Edit sampler parameters in any text editor
2. **Device-agnostic design** - Extensible to support multiple sampler types
3. **WAV export** - Audio data stored alongside parameters
4. **Template engine** - Create drum kits and velocity layers from templates
5. **Editor integration** - Export/import from the web editor UI
