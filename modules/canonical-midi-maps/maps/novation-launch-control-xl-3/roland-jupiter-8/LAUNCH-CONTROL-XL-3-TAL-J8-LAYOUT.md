# Launch Control XL 3 - TAL-J-8 Layout Reference

This document provides a complete layout reference for the TAL-J-8 Jupiter-8 mapping on the Novation Launch Control XL 3.

## Complete Control Layout

### Top Row Encoders (Main Synthesis)
```
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
| Enc 1         | Enc 2         | Enc 3         | Enc 4         | Enc 5         | Enc 6         | Enc 7         | Enc 8         |
| VCF Cutoff    | HPF Cutoff    | Portamento    | PWM Amount    | Cross Mod     | Noise Level   | Chorus Mix    | Delay Mix     |
| CC 13         | CC 14         | CC 15         | CC 16         | CC 17         | CC 18         | CC 19         | CC 41         |
| Param 105     | Param 103     | Param 11      | Param 59      | Param 87      | Param 91      | Param 137     | Param 139     |
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
```

### Middle Row Encoders (Oscillators & Modulation)
```
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
| Enc 9         | Enc 10        | Enc 11        | Enc 12        | Enc 13        | Enc 14        | Enc 15        | Enc 16        |
| Resonance     | LFO Rate      | Osc 1 Range   | Osc 1 Waveform| Osc 1 Fine    | VCO Mix       | LFO 2 Rate    | Key Follow    |
| CC 21         | CC 22         | CC 23         | CC 24         | CC 25         | CC 26         | CC 27         | CC 28         |
| Param 107     | Param 43      | Param 89      | Param 91      | Param 24      | Param 85      | Param 44      | Param 117     |
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
```

### Bottom Row Encoders (Extended Parameters)
```
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
| Enc 17        | Enc 18        | Enc 19        | Enc 20        | Enc 21        | Enc 22        | Enc 23        | Enc 24        |
| Env Amt       | LFO Delay     | Osc 2 Range   | Osc 2 Waveform| Osc 2 Fine    | Osc 2 Detune  | Bend Range    | Velocity Sens |
| CC 29         | CC 30         | CC 31         | CC 61         | CC 33         | CC 34         | CC 35         | CC 36         |
| Param 111     | Param 47      | Param 93      | Param 95      | Param 97      | Param 98      | Param 14      | Param 125     |
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
```

### Button Rows (Modes & Features)
```
Button Row 1 (Oscillator Controls):
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
| Btn 1         | Btn 2         | Btn 3         | Btn 4         | Btn 5         | Btn 6         | Btn 7         | Btn 8         |
| Osc 1 Sync    | Osc 2 Sync    | PWM LFO       | PWM ENV       | Arpeggiator   | Arp Hold      | Arp Up        | Arp Down      |
| CC 37 (Toggle)| CC 37 (Toggle)| CC 37 (Toggle)| CC 37 (Toggle)| CC 41 (Toggle)| CC 41 (Toggle)| CC 41 (Mom.)  | CC 41 (Mom.)  |
| Param 99      | Param 99      | Param 61      | Param 55      | Param 40      | Param 9       | Param 40      | Param 40      |
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+

Button Row 2 (Voice & Filter Modes):
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
| Btn 9         | Btn 10        | Btn 11        | Btn 12        | Btn 13        | Btn 14        | Btn 15        | Btn 16        |
| Solo          | Unison        | Poly 1        | Poly 2        | 24dB Mode     | Env Invert    | Vintage       | Hold          |
| CC 45 (Toggle)| CC 45 (Toggle)| CC 45 (Toggle)| CC 45 (Toggle)| CC 49 (Toggle)| CC 50 (Toggle)| CC 51 (Toggle)| CC 52 (Mom.)  |
| Param 5       | Param 5       | Param 5       | Param 5       | Param 109     | Param 113     | Param 7       | Param 9       |
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
```

### Sliders (ADSR & Mix Controls)
```
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
| Slider 1      | Slider 2      | Slider 3      | Slider 4      | Slider 5      | Slider 6      | Slider 7      | Slider 8      |
| Attack        | Decay         | Sustain       | Release       | Osc Mix       | LFO Filter    | LFO VCA       | Master Volume |
| CC 53         | CC 54         | CC 55         | CC 56         | CC 57         | CC 58         | CC 59         | CC 60         |
| Param 65      | Param 67      | Param 69      | Param 71      | Param 85      | Param 115     | Param 123     | Param 1       |
+---------------+---------------+---------------+---------------+---------------+---------------+---------------+---------------+
```

## Parameter Reference

### Filter Section
- **VCF Cutoff** (CC 13, Param 105): Main filter cutoff frequency
- **HPF Cutoff** (CC 14, Param 103): High-pass filter cutoff
- **Resonance** (CC 21, Param 107): Filter emphasis/resonance
- **Key Follow** (CC 28, Param 117): Keyboard tracking amount
- **Env Amt** (CC 29, Param 111): Envelope modulation to filter
- **24dB Mode** (CC 49, Param 109): Toggle 12dB/24dB filter slope

### Oscillator Section
- **Osc 1 Range** (CC 23, Param 89): Oscillator 1 octave range
- **Osc 1 Waveform** (CC 24, Param 91): Oscillator 1 waveform selector
- **Osc 1 Fine** (CC 25, Param 24): Oscillator 1 fine tuning
- **Osc 2 Range** (CC 31, Param 93): Oscillator 2 octave range
- **Osc 2 Waveform** (CC 61, Param 95): Oscillator 2 waveform selector
- **Osc 2 Fine** (CC 33, Param 97): Oscillator 2 fine tuning
- **Osc 2 Detune** (CC 34, Param 98): Oscillator 2 detune amount
- **VCO Mix** (CC 26, Param 85): Oscillator balance
- **Cross Mod** (CC 17, Param 87): Cross modulation amount

### Pulse Width Modulation
- **PWM Amount** (CC 16, Param 59): Pulse width modulation depth
- **PWM LFO** (CC 37, Param 61): Enable LFO to PWM
- **PWM ENV** (CC 37, Param 55): Enable envelope to PWM

### Envelope (ADSR)
- **Attack** (CC 53, Param 65): Envelope attack time
- **Decay** (CC 54, Param 67): Envelope decay time
- **Sustain** (CC 55, Param 69): Envelope sustain level
- **Release** (CC 56, Param 71): Envelope release time
- **Env Invert** (CC 50, Param 113): Invert envelope polarity

### LFO Section
- **LFO Rate** (CC 22, Param 43): LFO 1 frequency
- **LFO 2 Rate** (CC 27, Param 44): LFO 2 frequency
- **LFO Delay** (CC 30, Param 47): LFO 1 delay/fade-in time
- **LFO Filter** (CC 58, Param 115): LFO 1 to filter modulation
- **LFO VCA** (CC 59, Param 123): LFO 1 to VCA modulation

### Effects Section
- **Chorus Mix** (CC 19, Param 137): Chorus effect level
- **Delay Mix** (CC 41, Param 139): Delay effect level
- **Noise Level** (CC 18, Param 91): Noise generator level

### Performance Controls
- **Portamento** (CC 15, Param 11): Glide time between notes
- **Bend Range** (CC 35, Param 14): Pitch bend range in semitones
- **Velocity Sens** (CC 36, Param 125): Velocity sensitivity
- **Master Volume** (CC 60, Param 1): Output volume level

### Voice Modes
- **Solo** (CC 45, Param 5): Monophonic mode
- **Unison** (CC 45, Param 5): Unison mode
- **Poly 1** (CC 45, Param 5): Polyphonic mode 1
- **Poly 2** (CC 45, Param 5): Polyphonic mode 2

### Arpeggiator
- **Arpeggiator** (CC 41, Param 40): Enable arpeggiator
- **Arp Hold** (CC 41, Param 9): Hold arpeggiator notes
- **Arp Up** (CC 41, Param 40): Arpeggiator up mode (momentary)
- **Arp Down** (CC 41, Param 40): Arpeggiator down mode (momentary)

### Special Features
- **Vintage** (CC 51, Param 7): Vintage analog modeling mode
- **Hold** (CC 52, Param 9): Sustain pedal function
- **Osc Sync** (CC 37, Param 99): Oscillator sync modes

## Usage Notes

1. **Parameter Numbers**: Correspond to TAL-J-8's internal automation parameter indices
2. **CC Values**: All controls use 0-127 range
3. **Button Modes**:
   - Toggle: Latching on/off behavior
   - Momentary: Active only while pressed
4. **Shared CCs**: Some buttons share CC numbers but control different parameters
5. **MIDI Channel**: Uses centralized registry assignment (typically Channel 1)

## Automation Mapping

To use these mappings in your DAW:
1. Configure TAL-J-8 to receive MIDI CC on the assigned channel
2. Map each CC number to the corresponding plugin parameter
3. Use the parameter numbers for direct VST automation
4. Save as a template for quick recall

This layout provides comprehensive real-time control over all major TAL-J-8 synthesis parameters from the Launch Control XL 3 hardware surface.