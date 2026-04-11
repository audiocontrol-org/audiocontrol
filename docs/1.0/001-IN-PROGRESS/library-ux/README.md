# Library UX Improvements

**Status:** In Progress
**Branch:** `feature/library-ux`

## Documentation

- [PRD](./prd.md) - Product requirements document
- [Workplan](./workplan.md) - Implementation plan
- [Phase 6: Shared Editor Dialogs](./phase-6-shared-editor-dialogs.md) - Detailed design for shared editor dialog extraction
- [E2E Test Plan](./e2e-test-plan.md) - Comprehensive library e2e test plan (Tiers 1-3)
- [SDS Sample Rename](./sds-sample-rename.md) - Post-upload sample rename for correct program references
- [SCSI Bridge Retry](./scsi-bridge-retry.md) - Eliminate duplicate SCSI MIDI paths, fix MIDI mode lifecycle
- [Staged SDS Batch](./staged-sds-batch.md) - Batch SDS uploads for drum kit import (all SDS first, then all SysEx)
- [Unified Sample Slicing](./unified-sample-slicing.md) - Merge chopped-sample/drum-kit into single sample node type
- [Common Area Extraction](./common-area-extraction.md) - Extract duplicated common-area UI to editor-core
- [Drum Kit Storage Migration](./drum-kit-storage-migration.md) - Move Roland drum kits from device-specific to common area (#182)
- [Editor Dialog Plugins](./editor-dialog-plugins.md) - Shared dialog rendering via plugin pattern (#175)
- [Shared Library Tests](./shared-library-tests.md) - Generalize 42 common-area e2e tests to run against all editors
- [Contract Enforcement](./contract-enforcement.md) - Capability-declared context menus, compiler-enforced contracts across editors

## Overview

Align and improve library page UX across both the Roland S-330/S-550 editor and the Akai S3000XL editor. The core problem is implementation divergence: the S3K editor uses the shared `PluginLibraryBrowser` from editor-core, but the Roland editor has its own bespoke three-column layout (908 lines, violating the 500-line guideline). Roland's UX is the more mature implementation and the reference standard.

## Key Goals

1. **Alignment** - Migrate Roland onto `PluginLibraryBrowser`, updating the shared component to match Roland's UX standard
2. **Code reuse** - Extract shared hooks and patterns to editor-core so both editors benefit
3. **Code quality** - Reduce Roland's LibraryPage from 908 lines to <500 via hook extraction
4. **UX polish** - Improve visual hierarchy, interaction feedback, and discoverability in the shared components

## Scope

- **Both editors:** Roland S-330/S-550 (`roland-sxx0-editor`) and Akai S3000XL (`akai-s3k-editor`)
- **Shared layer:** `editor-core` PluginLibraryBrowser, plugin interfaces, shared hooks
- Sets remain device-specific (Roland-only category); vendor-agnostic "Multi" concept deferred
- Both device-specific and common-area categories shown in the library browser

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Extract Roland hooks | Complete | LibraryPage 908 → 462 lines, 3 new hooks |
| Phase 2: Upstream to editor-core | Complete | Context menu routing, headerSections, widened libraryHandle |
| Phase 3: Migrate Roland to PluginLibraryBrowser | Complete | Both editors use same component, deleted 579-line bespoke |
| Phase 4: UX polish on shared components | Mostly complete | 4.1-4.4 done; 4.5 keyboard nav deferred |
| Phase 5: S3K Zone 3→4 promotion | Complete | Promote S3K programs to common area |
| Phase 6: Shared useEditorDialogs | Complete | Shared hook with WavLoaderStrategy |
| Phase 7: Unify library operations | Complete | Shared useLibraryOperations hook |
| Phase 8: Library UI e2e tests | Complete | Test IDs, helpers, bug fixes |
| Phase 9: SCSI disk browser | Complete | Lazy metadata, context menus, drag-drop, loading indicators |
| Phase 10: SDS optimization | Complete | Batched SDS 9x speedup (2.2 KB/s), bridge hardening |
| Phase 11: Drag-drop workflows | Complete | Disk→library, disk→device, library→device with type filtering |
| Phase 12: Common-area programs | Complete | Three library sections, expandable programs, sourceDevice schema |
| Phase 13: ASPACK fast upload | Complete | Multi-chunk solved (poll flag 0x00), sample creation via minimal SDS, bridge + web editor integrated (#184) |
| Phase 14: Reload resilience | Complete | Library auto-reconnect, device/disk state caching, shared vite config, loading bars |
| Phase 15: Context menu parity | Complete | Transfer actions, device memory context menus, disk browser Send to Device |
| Phase 16: Contract enforcement | Complete | Capability-declared menus, compiler-enforced contracts, 12 unit tests |

## Related Issues

- [#183](https://github.com/audiocontrol-org/audiocontrol/issues/183) — Delete dead MidiStreamClient (streaming port 6870)
- [#184](https://github.com/audiocontrol-org/audiocontrol/issues/184) — ASPACK bulk sample transfer (10x faster than SDS)
- [#185](https://github.com/audiocontrol-org/audiocontrol/issues/185) — Safari/iOS createWritable compatibility
- [#186](https://github.com/audiocontrol-org/audiocontrol/pull/186) — PR: Library UX, SCSI disk browser, drag-drop, SDS batching

## Related Documentation

- [SAMPLER-LIBRARY.md](/SAMPLER-LIBRARY.md) — Four-zone storage model and conversion boundaries
- [S3000XL SysEx Protocol](../../s3000xl-editor/s3000xl-sysex-protocol.md) — Canonical protocol reference
- [SCSI Sample Transfer Findings](../../scsi-sample-transfer/scsi-sample-data-findings.md) — ASPACK/RSPACK/SDS findings
- [ASPACK Exploration Plan](../../scsi-sample-transfer/bulk-transfer-exploration-plan.md) — Systematic investigation plan
- [SCSI-NOTES.md](/SCSI-NOTES.md) — Travel log of SCSI reverse engineering
- [DEVELOPMENT-NOTES.md](/DEVELOPMENT-NOTES.md) — Session journal
- [S3K Library Page Conformance](../../s3k-library-page/) - Prior effort (superseded by this feature)
