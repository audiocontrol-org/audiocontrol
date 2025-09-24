# Novation Launch Control XL 3 Template Extraction Process

This document provides a step-by-step prompt template for extracting MIDI CC mappings from Novation Components custom mode templates and creating canonical YAML mappings for various VST/AU plugins.

## Process Overview

1. **Playwright Analysis**: Use browser automation to extract CC mappings from Novation Components
2. **Base Template Creation**: Document the core CC assignments in canonical YAML format
3. **Plugin-Specific Mappings**: Create tailored mappings for popular plugins in the category
4. **Documentation**: Generate comprehensive usage guides and control references

## Prompt Template for Claude Code

```
Use playwright MCP to analyze this Novation Launch Control XL 3 custom mode template and create MIDI CC mappings for various [PLUGIN CATEGORY] VST/AU plugins: [NOVATION_COMPONENTS_URL]

## Requirements:

### 1. Playwright Analysis
- Navigate to the provided Novation Components URL
- Wait for the template to load completely
- Take snapshots to analyze the complete CC mapping layout
- Click on individual controls to inspect their configuration (CC numbers, ranges, channels)
- Document all visible control assignments including:
  - Encoder CC assignments (rows 1-3, typically 24 encoders)
  - Slider CC assignments (typically 8 sliders)
  - Button CC assignments (typically 16 buttons in 2 rows)
  - Control names and descriptions from the template

### 2. Directory Structure
- Create files in `/modules/canonical-midi-maps/maps/novation-launch-control-xl-3/`
- Use descriptive filenames following the pattern: `[category]-[plugin-name].yaml`
- Example: `synthesizer-arturia-pigments.yaml`, `drum-machine-tr-808-roland-cloud.yaml`

### 3. Base Template Creation
Create a base template file: `[category]-base.yaml` with:
- Complete CC mapping extracted from Novation Components
- All 24 encoders, 8 sliders, and 16 buttons documented
- Unassigned controls marked as "plugin-specific parameter"
- Generic control names from the Novation template
- Range specifications (typically 0-127)
- Channel settings (typically global)
- Detailed notes about the template structure

### 4. Plugin-Specific Mappings
Create 3-4 plugin-specific mappings for popular plugins in the category:
- Research actual plugin parameter names and automation IDs
- Map unassigned encoders to relevant plugin-specific parameters
- Include `plugin_parameter` fields for each control
- Add plugin metadata (manufacturer, name, version)
- Document plugin-specific features and limitations
- Consider different plugin architectures within the category

### 5. Documentation File
Create a comprehensive `README-[category].md` file including:
- Overview of the template and its intended use case
- Complete control layout reference with visual ASCII diagram
- Comparison to other templates (if relevant)
- Usage instructions for DAW integration
- Plugin compatibility notes and special considerations
- Tips for optimal controller usage
- Extension guidelines for additional plugins
- Control layout differences and unique features

### 6. File Verification
After creating each file:
- Verify file exists with `ls -la [filepath]`
- Check file contents with `head -10 [filepath]`
- Confirm correct directory structure
- Validate YAML syntax conceptually

### 7. Todo List Management
Use TodoWrite to track progress:
- Navigate to template and extract mappings
- Research plugin parameter mappings
- Create base template
- Create 3-4 plugin-specific mappings
- Create comprehensive documentation
- Verify all files created successfully

## Template Categories and Examples:

### Synthesizer Templates
- Analog mono: Minimoog, Model D, etc.
- Analog poly: Jupiter 8, OB-6, etc.
- Digital/Modern: Serum, Massive, Pigments, etc.
- Vintage Digital: DX7, M1, etc.

### Drum Machine Templates
- Classic: TR-808, TR-909, LinnDrum
- Modern: Elektron devices, Native Instruments
- Sampler-based: Battery, Kontakt, etc.

### Effects Templates
- Multi-effects: Guitar Rig, Bias FX
- Modular effects: Eventide, FabFilter Pro-Q 3
- Vintage effects: UAD, Waves

### DAW/Mixer Templates
- Mixing consoles: SSL, Neve emulations
- DAW mixers: Pro Tools, Logic, Ableton Live
- Transport controls: Universal DAW control

## File Naming Conventions:

### Base Templates
- `[category]-base.yaml` (e.g., `analog-synthesizer-base.yaml`)

### Plugin-Specific Templates
- `[category]-[manufacturer]-[plugin].yaml`
- Examples:
  - `analog-synthesizer-arturia-mini-v4.yaml`
  - `drum-machine-roland-tr-808.yaml`
  - `effects-eventide-h9000.yaml`

### Documentation
- `README-[category].md` (e.g., `README-analog-synthesizer.md`)

## Required Metadata Fields:

```yaml
version: 1.0.0
device:
  manufacturer: Novation
  model: Launch Control XL 3
  firmware: ">=1.0"
metadata:
  name: [Descriptive Name]
  description: [Purpose and target plugins]
  author: Audio Control System
  date: 2025-09-23
  tags:
    - [category]
    - [subcategory]
    - [plugin-type]
plugin: # For plugin-specific mappings only
  manufacturer: [Plugin Manufacturer]
  name: [Plugin Name]
  type: VST/AU/AAX
  version: "[Version requirement]"
```

## Control Structure Template:

```yaml
controls:
  # Top Row Encoders (1-8)
  - id: encoder_1
    name: [Control Name]
    type: encoder
    cc: [CC Number]
    channel: global
    range: [0, 127]
    description: [Function description]
    plugin_parameter: [Parameter name] # Plugin-specific only

  # Sliders (1-8)
  - id: slider_1
    name: [Control Name]
    type: slider
    cc: [CC Number]
    channel: global
    range: [0, 127]
    description: [Function description]
    plugin_parameter: [Parameter name] # Plugin-specific only

  # Button Groups
  - id: button_row_1
    name: [Group Name]
    type: button_group
    buttons:
      - id: button_1
        name: [Button Name]
        cc: [CC Number]
        channel: global
        mode: [toggle/momentary]
        plugin_parameter: [Parameter name] # Plugin-specific only
```

## Success Criteria:
- All CC assignments accurately extracted from Novation Components
- Base template comprehensively documents the layout
- Plugin-specific mappings include relevant parameter names
- Documentation provides clear usage instructions
- Files follow naming conventions and directory structure
- All file operations verified with bash commands

Execute this process systematically, using TodoWrite to track progress and ensure all deliverables are completed.
```

## Usage Instructions:

1. **Replace Variables**: Update `[PLUGIN_CATEGORY]` and `[NOVATION_COMPONENTS_URL]` with specific values
2. **Customize Plugin List**: Modify the plugin examples based on the target category
3. **Adjust Complexity**: Scale the number of plugin-specific mappings based on category popularity
4. **Send to Claude Code**: Copy the filled prompt template and send as a complete request

## Example Usage:

```
Use playwright MCP to analyze this Novation Launch Control XL 3 custom mode template and create MIDI CC mappings for various drum machine VST/AU plugins: https://components.novationmusic.com/launch-control-xl-3/custom-modes/622xxx

[Rest of template with drum machine specific examples...]
```

This process ensures consistent, comprehensive extraction and documentation of Novation Launch Control XL 3 templates for any plugin category.