# Jupiter-8 Synthesizer Architecture - Canonical MIDI Mapping

This document defines the canonical Novation Launch Control XL 3 control surface MIDI CC mapping for Jupiter-8 synthesizer architecture across all plugin implementations. These mappings are extracted from the Novation Components online editor and should be consistently enforced across all Jupiter-8 plugin variations.

## Core Architecture Concepts

The Jupiter-8 synthesizer architecture consists of these fundamental parameter categories that must be mapped consistently:

### Filter Section
- **VCF Cutoff** → CC 13 (Encoder 1)
- **HPF Cutoff** → CC 14 (Encoder 2)
- **VCF Resonance** → CC 21 (Encoder 9)
- **Envelope Amount** → CC 29 (Encoder 17)

### Oscillator Section
- **Oscillator 1 Range** → CC 23 (Encoder 11)
- **Oscillator 1 Shape/Waveform** → CC 24 (Encoder 12)
- **Oscillator 2 Range** → CC 31 (Encoder 19)
- **Oscillator 2 Shape/Waveform** → CC 61 (Encoder 20)
- **Oscillator Mix** → CC 57 (Slider 5)

### LFO Section
- **LFO Rate** → CC 22 (Encoder 10)
- **LFO Delay** → CC 30 (Encoder 18)
- **LFO to Filter Amount** → CC 58 (Slider 6)
- **LFO to VCA Amount** → CC 59 (Slider 7)

### Envelope Section (ADSR)
- **Attack** → CC 53 (Slider 1)
- **Decay** → CC 54 (Slider 2)
- **Sustain** → CC 55 (Slider 3)
- **Release** → CC 56 (Slider 4)

### Global Controls
- **Portamento/Glide** → CC 15 (Encoder 3)
- **Master Volume/Level** → CC 60 (Slider 8)

### Voice & Mode Controls
- **Arpeggiator Functions** → CC 37 (Button Row 1)
- **Extended Functions** → CC 41 (Button Row 2)
- **Voice Modes** → CC 45 (Button Row 3)
- **Filter/Control Modes** → CC 49-52 (Button Row 4)

## Plugin-Specific Extensions

Each plugin implementation may use the remaining CC assignments for plugin-specific features while maintaining the core architecture:

### Available for Plugin-Specific Use
- **CC 16-19** (Encoders 4-7): Plugin-specific parameters 1-4
- **CC 25-28** (Encoders 13-16): Plugin-specific parameters 5-8
- **CC 33-36** (Encoders 21-24): Plugin-specific parameters 9-12

### Common Plugin-Specific Mappings

#### TAL-J-8 Extensions
- **CC 16**: PWM Amount
- **CC 17**: Cross Modulation
- **CC 18**: Noise Level
- **CC 19**: Chorus Mix
- **CC 41**: Delay Mix (Encoder 8)

#### Roland Cloud Extensions
- **CC 16**: VCO Modulation Depth
- **CC 17**: Cross Modulation
- **CC 18**: Source Mix
- **CC 19**: Key Follow
- **CC 41**: Aftertouch Sensitivity

#### Arturia Jup-8 V4 Extensions
- **CC 16**: Mod Wheel Amount
- **CC 17**: Cross Modulation
- **CC 18**: Noise Level
- **CC 19**: Brilliance
- **CC 41**: Voice Detune

## Naming Conventions

Plugin implementations should use consistent naming that reflects the conceptual parameter:

### Standardized Names
- **Filter Cutoff**: "VCF Cutoff", "Cutoff", "Filter Cutoff"
- **Filter Resonance**: "Resonance", "VCF Resonance", "Emphasis"
- **Master Volume**: "Volume", "Level", "Master Volume", "Master Level"
- **LFO Rate**: "LFO Rate", "LFO_Rate", "LFO Speed"
- **Oscillator Mix**: "Osc Mix", "VCO Mix", "OSC Balance", "Osc_Balance"

### Button Function Names
Button functions may vary by plugin but should follow similar conceptual groupings:

- **Row 1 (CC 37)**: Arpeggiator controls, oscillator sync, modulation sources
- **Row 2 (CC 41)**: Extended features, effects, sequencer controls
- **Row 3 (CC 45)**: Voice modes (Solo/Unison/Poly variations)
- **Row 4 (CC 49-52)**: Filter modes, envelope polarity, vintage modes

## Validation Rules

All Jupiter-8 plugin mappings must adhere to these rules:

### Core Parameter Enforcement
1. **CC 13** MUST control filter cutoff concept
2. **CC 21** MUST control filter resonance concept
3. **CC 22** MUST control LFO rate concept
4. **CC 53-56** MUST control ADSR envelope (Attack/Decay/Sustain/Release)
5. **CC 60** MUST control master volume/level concept

### CC Assignment Consistency
1. **Encoders 1-8**: Primary synthesis controls (CC 13-19, 41)
2. **Encoders 9-16**: Core modulation controls (CC 21-28)
3. **Encoders 17-24**: Extended parameters (CC 29-36, 61)
4. **Sliders 1-8**: ADSR + Mix controls (CC 53-60)
5. **Buttons**: Mode and function controls (CC 37, 41, 45, 49-52)

### Parameter Range Standards
- **All continuous controls**: Range [0, 127]
- **All buttons**: Toggle or momentary mode as appropriate
- **Channel**: Global (channel 1) for device-wide mapping

## Implementation Guidelines

### For Plugin Developers
1. Map your plugin's automation parameters to match the conceptual categories
2. Use consistent parameter names that reflect Jupiter-8 architecture
3. Ensure CC assignments follow the canonical layout
4. Document any deviations or special requirements

### For MIDI Mapping Authors
1. Start with `jupiter-8-base.yaml` as your template
2. Fill in `plugin_parameter` fields with actual plugin parameter names/indices
3. Customize plugin-specific encoders (CC 16-19, 25-28, 33-36) as needed
4. Maintain button conceptual groupings while adapting to plugin features

### For DAW Integration
1. Load the appropriate plugin-specific mapping file
2. Verify CC assignments match your hardware controller layout
3. Test all core parameters respond correctly
4. Save as preset for quick recall

## Compatibility Matrix

| Plugin | Base Compliance | Extensions | Special Notes |
|--------|----------------|------------|---------------|
| TAL-J-8 | ✅ Full | PWM, X-Mod, Effects | Chorus/Delay on encoders |
| Roland Cloud | ✅ Full | Aftertouch, Assign Modes | Hardware-accurate ranges |
| Arturia Jup-8 V4 | ✅ Full | Galaxy, Sequencer, Effects | Extended feature set |
| Generic Template | ✅ Base Only | Plugin-Specific Slots | Starting point for new plugins |

## Version History

- **v1.0.0** (2025-09-23): Initial canonical mapping definition
  - Extracted from Novation Components online editor
  - Established core parameter concept mappings
  - Created base template and plugin-specific implementations
  - Verified consistency across existing Jupiter-8 mappings

## Maintenance

This mapping specification should be updated when:
1. New Jupiter-8 plugin implementations are added
2. Core conceptual mappings need revision
3. Hardware controller layouts change
4. Community feedback suggests improvements

All changes must maintain backward compatibility with existing plugin mappings and preserve the core CC assignments (13, 21, 22, 53-56, 60).