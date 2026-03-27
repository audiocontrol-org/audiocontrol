# Sample Format Consolidation

**Status:** In Progress
**Module:** sampler-library, sampler-editor

## Documentation

- [PRD](./prd.md) — Problem statement, solution design
- [Workplan](./workplan.md) — Implementation phases and task breakdown

## Overview

Consolidates the legacy chopped sample format (`manifest.yaml` + `source.wav`) into the portable sample format (`sample.yaml` + `sample.wav`) by extending `SampleYaml` with optional slice, trigger, playback, and drumKit fields. Removes the duplicate "Chopped Samples" library section.
