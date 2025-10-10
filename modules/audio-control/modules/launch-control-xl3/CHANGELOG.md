# Changelog

## 1.20.1-alpha.0

### Patch Changes

- Alpha release 1.20.1-alpha.0 - Testing changesets workflow with proper patch versioning

## 2.0.0-alpha.2

### Major Changes

- 50c7f54: changesets

## 1.20.1-alpha.1

### Patch Changes

- Test multi-package independent versioning: launch-control-xl3 gets patch bump, canonical-midi-maps gets minor bump

## 1.20.1-alpha.0

### Patch Changes

- Test alpha release - verifying Changesets workflow without publishing

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2025-09-27

### Added

- 🌐 **Browser support** using Web MIDI API
- New `WebMidiBackend` for browser environments
- Automatic environment detection (Node.js vs Browser)
- React/Vue/Svelte compatible
- Full SysEx support in browsers (Chrome, Edge, Opera)
- Browser example with complete Web MIDI API integration
- Comprehensive WebMidiBackend test suite

### Changed

- Replaced Node.js `EventEmitter` with `eventemitter3` for browser compatibility
- Updated package exports for better environment detection
- Improved tree-shaking with dynamic backend imports
- Enhanced error messages for Web MIDI API specific issues

### Migration

- No breaking changes! Existing Node.js code works unchanged
- Browser usage requires HTTPS and user permission for MIDI access
- See README for browser usage examples

## [1.0.0] - 2024-XX-XX

### Added

- Initial release of @ol-dsp/launch-control-xl3 library
- Complete TypeScript implementation with strict type safety
- Platform-agnostic MIDI interface supporting multiple backends
- Full SysEx protocol implementation for Novation Launch Control XL 3
- Midimunge 7-bit encoding/decoding for MIDI data transmission
- Device discovery and auto-connection capabilities
- Control mapping with 7 value transformation types
- LED control with colors, behaviors, and animations
- Custom mode read/write support (all 16 slots)
- Event-driven architecture with comprehensive events
- CLI tool for testing and device interaction
- 4 example applications demonstrating key features
- Comprehensive unit test suite
- Full API documentation

### Features

- **Device Management**: Auto-discovery, connection, reconnection
- **Control Mapping**: Map any control to MIDI with transformations
- **LED Control**: Full color control with animations
- **Custom Modes**: Read, write, and manage all 16 device templates
- **Value Transformations**: Linear, exponential, logarithmic, stepped, toggle, invert, bipolar
- **MIDI Backends**: Auto-detection of node-midi, Web MIDI API, JZZ
- **CLI Tool**: Interactive command-line interface for testing
- **Type Safety**: Full TypeScript with branded types and interfaces

### Supported Hardware

- Novation Launch Control XL (Mark 3)
- Firmware version 1.0.0+

## [0.1.0] - 2024-01-XX (Planned)

### Initial Beta Release

- Core functionality complete
- API stabilized
- Documentation complete
- Examples provided
- Test coverage > 80%

## Development Milestones

### Phase 1: Foundation ✅

- TypeScript project setup
- Core types and interfaces
- Build tooling (Vite, Vitest)

### Phase 2: Protocol ✅

- SysEx parser implementation
- Midimunge encoding/decoding
- MIDI interface abstraction
- Device manager

### Phase 3: Features ✅

- Custom mode manager
- Control mapper with transformations
- LED controller with animations
- Main controller class

### Phase 4: Tools ✅

- CLI implementation
- Example applications
- Integration tests

### Phase 5: Documentation ✅

- README with full examples
- API documentation
- Contributing guidelines
- Protocol specification

### Phase 6: Release Preparation ✅

- GitHub Actions workflows
- npm publication setup
- License and changelog
- Final testing
