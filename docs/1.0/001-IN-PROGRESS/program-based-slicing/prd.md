# PRD: Program-Based Slicing

## Problem Statement

The current design conflates samples with their slicing. When a user chops a sample, slice definitions and drum kit configuration are saved into `sample.yaml` alongside the audio data. This creates three problems:

1. **A sample can only be sliced one way.** Because slice definitions live in `sample.yaml`, there is exactly one set of slices per sample. A user who wants the same drum break chopped into 16 pads AND into 4 quarter-note sections must duplicate the entire sample.

2. **The "Drum Kit" vs "Chopped Sample" distinction is structural rather than editorial.** Both are the same thing (a set of slices mapped to keys/pads), but the current schema treats them as different structures inside `sample.yaml`. The difference should be a label on a program, not a fork in the data model.

3. **"Send to Device" is ambiguous.** When a user sends a chopped sample to a device, the intent is unclear: send the raw WAV only? Or create a program with keygroups on the device? The system cannot distinguish these because sample and program data are merged.

### The Fix

Chopping a sample produces a **program**, not a modified sample. A program is a self-contained object that includes slice definitions, key/pad mappings, a type label, and a copy of the WAV file. The source sample remains untouched. Multiple programs can reference the same source sample with different slice patterns.

## User Stories

### Chopping creates a program
As a user, when I chop a sample in the chopper UI, the result is a new program object -- not a modification to the source sample. The source sample's `sample.yaml` is unchanged after chopping.

### Programs are self-contained
As a user, when I look at a program in the library, it contains everything needed to send to a device: the WAV audio data, slice definitions, key/pad mappings, and a type label (drum kit, chopped sample, or instrument). I do not need to locate the source sample separately.

### Multiple slice patterns per sample
As a user, I can chop the same source sample into multiple programs with different slice patterns. For example, one program that slices a drum break into 16 pads and another that slices it into 4 bars.

### Unambiguous "Send to Device"
As a user, when I click "Send to Device" on a program, the system creates a program and keygroups on the device and sends the sample data. There is no ambiguity about what gets sent. When I click "Send to Device" on a plain sample, only the WAV data is sent.

### Chopper and drum kit editor operate on programs
As a user, when I open the chopper or drum kit editor, I am editing a program object. The chopper creates new programs; opening an existing program in the chopper lets me re-edit its slices.

### Library shows programs as a distinct type
As a user, I can see programs in the library browser as a distinct item type with an appropriate icon and preview. Programs are visually distinguishable from plain samples.

### Clean schema separation
As a developer, `sample.yaml` no longer contains `slices` or `drumKit` fields. Those fields exist only in `program.yaml`. The schemas are cleanly separated.

## Out of Scope

- **Migration of existing chopped samples.** Existing data created under the old schema does not need automated migration. Users can re-chop if needed.
- **New device support.** This feature does not add support for devices beyond what is already implemented.
- **Changes to the sample editor.** Loop points, trim, normalize, and other sample-level editing operations still operate on samples, not programs.
- **Changes to SDS or SysEx protocol layer.** The protocol layer sends what it is given. This feature changes what the application layer constructs before sending.

## Dependencies

- **feature/library-ux branch** has the latest library scanner and item type plugin patterns. This feature should coordinate with or build on that work. The item type plugin pattern is the mechanism for registering programs as a new library item type.
- **Common-area program storage in sampler-library** already has partial program support (`loadProgramMeta`, `loadProgramFromProgramsDir`). This feature extends that foundation with a complete program schema and lifecycle.

## Open Questions

1. **What fields does `program.yaml` need beyond slices and key mappings?** Candidates include: source sample reference (for provenance tracking), creation timestamp, device target hint, velocity layers, filter/envelope per-keygroup settings.

2. **Does the WAV copy in the program directory need to be a full copy, or can it be a reference to the source sample?** A full copy makes programs truly self-contained and portable. A reference saves disk space but creates a fragile dependency. The self-contained approach is safer but may need a deduplication strategy for large libraries.

3. **How should the library tree organize programs?** Options: a top-level "Programs" category, nested under the source sample, or flat alongside samples with type-based filtering. The item type plugin pattern from library-ux may dictate the answer.
