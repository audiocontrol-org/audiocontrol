# Novation Launch Control XL 3 - Jupiter 8 MIDI Mappings

This directory contains MIDI CC mapping templates for controlling various Roland Jupiter 8 VST/AU plugin emulations using the Novation Launch Control XL 3 controller.

## Overview

The Jupiter 8 template from Novation Components has been analyzed and converted into canonical YAML format, with specific adaptations for different plugin implementations.

## Available Mappings

### 1. Base Template (`jupiter-8-base.yaml`)
The foundation mapping extracted from Novation Components editor with the following CC assignments:

#### Encoders (Top Row - CC 13-19, 41)
- **CC 13**: Cutoff - VCF cutoff frequency
- **CC 14**: HPF Cutoff - High-pass filter
- **CC 15**: Portamento - Glide time
- **CC 16-19**: Unassigned (plugin-specific)
- **CC 41**: Unassigned (plugin-specific)

#### Encoders (Middle Row - CC 21-28)
- **CC 21**: Resonance - VCF resonance
- **CC 22**: LFO Rate - LFO frequency
- **CC 23**: Osc 1 Range - Octave selector
- **CC 24**: Osc 1 Shape - Waveform
- **CC 25-28**: Unassigned (plugin-specific)

#### Encoders (Bottom Row - CC 29-36, 61)
- **CC 29**: Env Amt - Envelope to filter
- **CC 30**: LFO Delay - LFO fade-in
- **CC 31**: Osc 2 Range - Octave selector
- **CC 61**: Osc 2 Shape - Waveform
- **CC 33-36**: Unassigned (plugin-specific)

#### Sliders (CC 53-60)
- **CC 53**: Attack - Envelope attack time
- **CC 54**: Decay - Envelope decay timeL
- **CC 55**: Sustain - Envelope sustain level
- **CC 56**: Release - Envelope release time
- **CC 57**: Osc Mix - OSC1/OSC2 balance
- **CC 58**: LFO Filt Amount - LFO to filter mod
- **CC 59**: LFO VCA Amt - LFO to amplifier mod
- **CC 60**: Level - Master volume

#### Buttons
- **CC 37**: Arpeggiator controls (buttons 1-4)
- **CC 41**: Additional functions (buttons 5-8)
- **CC 45**: Voice modes (Solo/Unison/Poly)
- **CC 49-52**: Filter modes and additional controls

### 2. TAL-J-8 (`jupiter-8-tal-j8.yaml`)
Optimized for TAL Software's TAL-J-8 plugin with enhanced mappings:
- Pulse width modulation controls
- Cross modulation
- Built-in chorus and delay effects
- Arpeggiator with hold and directional modes
- Vintage mode for analog character

### 3. Roland Cloud (`jupiter-8-roland-cloud.yaml`)
Official Roland Cloud Jupiter-8 mapping featuring:
- Authentic VCO controls with sync
- Assign modes (Whole/Dual/Split)
- Original arpeggiator implementation
- After-touch sensitivity
- True-to-hardware parameter ranges

### 4. Arturia Jup-8 V4 (`jupiter-8-arturia-jup8v.yaml`)
Extended mapping for Arturia's feature-rich emulation:
- Galaxy mode for evolving textures
- Built-in step sequencer controls
- Effects section (chorus/delay/reverb)
- Voice detune for thicker sounds
- Upper/Lower keyboard split

## Usage Instructions

### Loading in Your DAW

1. **Import the YAML mapping** into your MIDI mapping system
2. **Configure your Launch Control XL 3** to use the custom mode
3. **Map the CC numbers** to your plugin's automation parameters
4. **Save as a preset** in your DAW for quick recall

### Customization

Each mapping file includes:
- `plugin_parameter` fields for automation mapping
- Descriptive names for each control
- Range specifications (all use 0-127)
- Control types (encoder/slider/button)
- Button modes (momentary/toggle)

### Converting to Other Formats

These canonical YAML files can be converted to:
- Ardour MIDI maps (XML format)
- Ableton Live remote scripts
- Logic Pro controller assignments
- Native DAW formats

## Control Layout Reference

```
Launch Control XL 3 Layout:
+--------+--------+--------+--------+--------+--------+--------+--------+
| Enc 1  | Enc 2  | Enc 3  | Enc 4  | Enc 5  | Enc 6  | Enc 7  | Enc 8  |
| CC 13  | CC 14  | CC 15  | CC 16  | CC 17  | CC 18  | CC 19  | CC 41  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Enc 9  | Enc 10 | Enc 11 | Enc 12 | Enc 13 | Enc 14 | Enc 15 | Enc 16 |
| CC 21  | CC 22  | CC 23  | CC 24  | CC 25  | CC 26  | CC 27  | CC 28  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Enc 17 | Enc 18 | Enc 19 | Enc 20 | Enc 21 | Enc 22 | Enc 23 | Enc 24 |
| CC 29  | CC 30  | CC 31  | CC 61  | CC 33  | CC 34  | CC 35  | CC 36  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Btn 1  | Btn 2  | Btn 3  | Btn 4  | Btn 5  | Btn 6  | Btn 7  | Btn 8  |
| CC 37  | CC 37  | CC 37  | CC 37  | CC 41  | CC 41  | CC 41  | CC 41  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Btn 9  | Btn 10 | Btn 11 | Btn 12 | Btn 13 | Btn 14 | Btn 15 | Btn 16 |
| CC 45  | CC 45  | CC 45  | CC 45  | CC 49  | CC 50  | CC 51  | CC 52  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Sldr 1 | Sldr 2 | Sldr 3 | Sldr 4 | Sldr 5 | Sldr 6 | Sldr 7 | Sldr 8 |
| CC 53  | CC 54  | CC 55  | CC 56  | CC 57  | CC 58  | CC 59  | CC 60  |
+--------+--------+--------+--------+--------+--------+--------+--------+
```

## Plugin Compatibility Notes

### TAL-J-8
- Supports 7-bit CC resolution
- PWM requires manual/LFO/ENV source selection
- Arpeggiator syncs to host tempo

### Roland Cloud Jupiter-8
- Requires Roland Cloud subscription
- Supports all original hardware features
- May need CC learn mode for some parameters

### Arturia Jup-8 V4
- Extended features accessible via GUI
- Galaxy mode best controlled with mod wheel
- Sequencer syncs to DAW transport

## Tips for Best Results

1. **Start with the base template** and customize for your needs
2. **Use sliders for ADSR** - provides tactile envelope control
3. **Map unassigned encoders** to your most-used parameters
4. **Save multiple templates** for different sound design workflows
5. **Consider velocity curves** - adjust in your DAW for optimal response

## Extending the Templates

To add support for other Jupiter 8 plugins:

1. Copy `jupiter-8-base.yaml` as your starting point
2. Research the plugin's MIDI implementation
3. Map the `plugin_parameter` fields to actual parameter names
4. Test all controls for proper range and response
5. Document any special requirements or limitations

## Contributing

If you create mappings for additional Jupiter 8 plugins, please consider contributing them back to this repository with proper documentation.

## License

These mapping files are provided as-is for use with legally owned software plugins and hardware controllers.