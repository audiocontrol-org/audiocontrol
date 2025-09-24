# Novation Launch Control XL 3 - Moog Minimoog MIDI Mappings

This directory contains MIDI CC mapping templates for controlling various Moog Minimoog VST/AU plugin emulations using the Novation Launch Control XL 3 controller.

## Overview

The Moog Mini V template from Novation Components has been analyzed and converted into canonical YAML format, with specific adaptations for different Minimoog plugin implementations.

## Available Mappings

### 1. Base Template (`moog-minimoog-base.yaml`)
The foundation mapping extracted from Novation Components "Mini V" editor with the following CC assignments:

#### Encoders (Top Row - CC 13-19, 45)
- **CC 13**: Cutoff - VCF cutoff frequency
- **CC 14**: HPF Cutoff - High-pass filter
- **CC 15**: Glide - Portamento/glide time
- **CC 16**: Osc 1 Range - Oscillator 1 octave range
- **CC 17**: Osc 1 Shape - Oscillator 1 waveform
- **CC 18**: Unassigned (plugin-specific)
- **CC 19**: Unassigned (plugin-specific)
- **CC 45**: Unassigned (plugin-specific)

#### Encoders (Middle Row - CC 21-28)
- **CC 21**: Resonance - VCF resonance/emphasis
- **CC 22**: LFO Rate - LFO frequency
- **CC 23**: Osc 2 Tune - Oscillator 2 fine tune
- **CC 24**: Osc 2 Range - Oscillator 2 octave range
- **CC 25**: Osc 2 Shape - Oscillator 2 waveform
- **CC 26-28**: Unassigned (plugin-specific)

#### Encoders (Bottom Row - CC 29-36, 61)
- **CC 29**: Env Amt - Envelope to filter amount
- **CC 30**: LFO Delay - LFO fade-in time
- **CC 31**: Osc 3 Tune - Oscillator 3 fine tune
- **CC 61**: Osc 3 Range - Oscillator 3 octave range
- **CC 33**: Osc 3 Shape - Oscillator 3 waveform
- **CC 34-36**: Unassigned (plugin-specific)

#### Sliders (CC 53-60) - Minimoog Style
- **CC 53**: Attack - Envelope attack time
- **CC 54**: Decay - Envelope decay time
- **CC 55**: Sustain - Envelope sustain level
- **CC 56**: Osc 1 - Oscillator 1 level
- **CC 57**: Osc 2 - Oscillator 2 level
- **CC 58**: Osc 3 - Oscillator 3 level
- **CC 59**: Noise - Noise generator level
- **CC 60**: Level - Master output level

#### Buttons
- **CC 37**: Arpeggiator controls (buttons 1-4)
- **CC 41**: Additional functions (buttons 5-8)
- **CC 45**: Voice modes (Solo/Unison/Poly)
- **CC 49-52**: Filter modes and additional controls

### 2. Arturia Mini V4 (`moog-minimoog-arturia-mini-v4.yaml`)
Enhanced mapping for Arturia's feature-rich Minimoog emulation:
- Galaxy mode for evolving textures
- Built-in step sequencer controls
- Chorus and delay effects
- Voice detune for thick unison sounds
- Brilliance control for high-frequency emphasis
- Extended polyphony modes

### 3. Moog Model D (`moog-minimoog-model-d.yaml`)
Official Moog plugin mapping featuring:
- Authentic Minimoog parameter names and ranges
- Classic ADS envelope (no Release)
- Moog's signature 24dB/octave filter
- Overload/saturation controls
- Vintage mode with component aging
- True-to-hardware behavior

### 4. TAL-BassLine-101 (`moog-minimoog-tal-bassline-101.yaml`)
TB-303 inspired mapping adapted to Minimoog template:
- Classic TB-303 VCO/VCF/VCA architecture
- Built-in step sequencer with slide and accent
- Pattern A/B switching
- Distortion and overdrive effects
- Classic acid bassline controls

### 5. IK Multimedia Syntronik (`moog-minimoog-ik-syntronik.yaml`)
Multi-model Moog collection mapping:
- Model selection: Minimoog, Modular, Taurus, Source
- High-quality sampling + modeling hybrid
- Built-in effects suite
- Vintage drift and character controls
- Extended polyphony options

## Key Differences from Jupiter 8 Template

The Minimoog template has a fundamentally different architecture:

### Oscillator Focus
- **3 Individual Oscillators**: Each with separate level control on sliders
- **No Oscillator Mix**: Individual level sliders instead of balance control
- **Oscillator 3 Special**: Can often be used as LFO or control voltage

### Envelope Structure
- **Classic ADS**: Attack/Decay/Sustain (no Release in original hardware)
- **Single Envelope**: Typically controls both filter and amplifier
- **Contour Generator**: Moog terminology for envelope

### Filter Characteristics
- **24dB/octave Lowpass**: Moog's signature filter design
- **Resonance/Emphasis**: Self-oscillation at high settings
- **Keyboard Control**: Filter tracking amount

### Unique Minimoog Features
- **Glide/Portamento**: Smooth pitch transitions between notes
- **Noise Generator**: White/pink noise on dedicated slider
- **Output Level**: Master volume on slider (not just CC control)

## Control Layout Reference

```
Launch Control XL 3 Layout (Minimoog Template):
+--------+--------+--------+--------+--------+--------+--------+--------+
| Cutoff | HPF    | Glide  | Osc1   | Osc1   | Enc 6  | Enc 7  | Enc 8  |
| CC 13  | CC 14  | CC 15  | Range  | Shape  | CC 18  | CC 19  | CC 45  |
|        |        |        | CC 16  | CC 17  |        |        |        |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Reson  | LFO    | Osc2   | Osc2   | Osc2   | Enc 14 | Enc 15 | Enc 16 |
| CC 21  | Rate   | Tune   | Range  | Shape  | CC 26  | CC 27  | CC 28  |
|        | CC 22  | CC 23  | CC 24  | CC 25  |        |        |        |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Env    | LFO    | Osc3   | Osc3   | Osc3   | Enc 22 | Enc 23 | Enc 24 |
| Amt    | Delay  | Tune   | Range  | Shape  | CC 34  | CC 35  | CC 36  |
| CC 29  | CC 30  | CC 31  | CC 61  | CC 33  |        |        |        |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Btn 1  | Btn 2  | Btn 3  | Btn 4  | Btn 5  | Btn 6  | Btn 7  | Btn 8  |
| CC 37  | CC 37  | CC 37  | CC 37  | CC 41  | CC 41  | CC 41  | CC 41  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Btn 9  | Btn 10 | Btn 11 | Btn 12 | Btn 13 | Btn 14 | Btn 15 | Btn 16 |
| CC 45  | CC 45  | CC 45  | CC 45  | CC 49  | CC 50  | CC 51  | CC 52  |
+--------+--------+--------+--------+--------+--------+--------+--------+
| Attack | Decay  | Sustain| Osc 1  | Osc 2  | Osc 3  | Noise  | Level  |
| CC 53  | CC 54  | CC 55  | CC 56  | CC 57  | CC 58  | CC 59  | CC 60  |
+--------+--------+--------+--------+--------+--------+--------+--------+
```

## Usage Instructions

### Loading in Your DAW

1. **Import the YAML mapping** into your MIDI mapping system
2. **Configure your Launch Control XL 3** to use the custom mode
3. **Map the CC numbers** to your plugin's automation parameters
4. **Save as a preset** in your DAW for quick recall

### Customization Tips

- **Use sliders for mixing**: The individual oscillator level sliders provide excellent real-time control
- **Map unused encoders**: Assign CC 18, 19, 26-28, 34-36 to plugin-specific parameters
- **Consider polyphony**: Modern plugins often extend beyond monophonic operation
- **Effects routing**: Many modern Minimoog emulations include built-in effects

## Plugin Compatibility Notes

### Arturia Mini V4
- Requires Arturia Software Center authentication
- Galaxy mode creates CPU-intensive effects
- Sequencer syncs to host transport

### Moog Model D
- Official Moog plugin with authentic parameter ranges
- Vintage mode affects CPU usage
- Some parameters are stepped/discrete, not continuous

### TAL-BassLine-101
- TB-303 inspired, not true Minimoog architecture
- Built-in sequencer with pattern storage
- Accent affects both filter and volume

### IK Multimedia Syntronik
- Multiple Moog models require model selection
- Sampling + modeling hybrid approach
- Parameter sets vary by selected model

## Tips for Minimoog Control

1. **Start with filter and resonance** - The core of the Minimoog sound
2. **Use oscillator detuning** - Slight detuning creates thick sounds
3. **Experiment with oscillator ranges** - Wide range creates harmonics
4. **Leverage glide/portamento** - Essential for classic Minimoog patches
5. **Control noise carefully** - A little goes a long way
6. **Use envelope amount** - Modulates filter for dynamic sounds

## Extending the Templates

To add support for other Minimoog plugins:

1. Copy `moog-minimoog-base.yaml` as your starting point
2. Research the plugin's MIDI implementation and parameter names
3. Map the `plugin_parameter` fields to actual automation parameters
4. Test all controls for proper range and response
5. Document any special requirements or unique features

## Contributing

If you create mappings for additional Minimoog plugins, please consider contributing them back to this repository with proper documentation.

## License

These mapping files are provided as-is for use with legally owned software plugins and hardware controllers.