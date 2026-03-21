# Synth Core — Sample Playback Engine

**Status:** In Progress
**Module:** `modules/synth-core`

## Documentation

- [PRD](./prd.md) — Problem statement, user stories, interface design
- [Workplan](./workplan.md) — Implementation phases and task breakdown

## Overview

A reusable, interface-driven sample playback engine that models a sampler as a synthesizer with sample-based oscillators. Provides polyphonic MIDI-triggered playback with pitch control and live loop region updates. All Web Audio and Web MIDI details are behind swappable interfaces.

First consumer: loop editor (polyphonic preview while editing loop points).
Future consumers: standalone sampler instrument, sample chopper migration.
