# Synth-Core Slice Playback & Chopper Migration

**Status:** In Progress

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)

## Overview

Extends synth-core with slice-based oscillators, mute groups, position tracking, and one-shot/gate modes. Migrates the sample chopper from its own Web Audio engine to synth-core, enabling shared testing infrastructure and consistent behavior across playback contexts.
