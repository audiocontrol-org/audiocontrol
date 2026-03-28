# Trigger Architecture Simplification

**Status:** Planning
**Branch:** `feature/s550-support`

## Overview

Decompose the monolithic `useTriggerRecording` hook into three focused hooks with unidirectional data flow. Fixes the save bug where new slices are lost on reload, eliminates circular ref dependencies, and separates recording, mapping, and playback concerns.

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)
- [Implementation Summary](./implementation-summary.md)
