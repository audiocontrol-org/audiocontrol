# Launch Control XL 3 Control Mappings

Based on captured MIDI data from Phase 1 testing.

## Encoder Mappings (24 total - 3 rows x 8)

### Row 1 - Send A (Top Row)
- Encoder 1: CC 21
- Encoder 2: CC 85  
- Encoder 3: CC 22
- Encoder 4: CC 19
- Encoder 5: CC 18
- Encoder 6: CC 17
- Encoder 7: CC 16
- Encoder 8: CC 23

### Row 2 - Send B (Middle Row)
- Encoder 1: CC 24
- Encoder 2: CC 15
- Encoder 3: CC 25
- Encoder 4: CC 14
- Encoder 5: CC 49
- Encoder 6: CC 50
- Encoder 7: CC 51
- Encoder 8: CC 26

### Row 3 - Pan/Device (Bottom Row)
- Encoder 1: CC 29
- Encoder 2: CC 30
- Encoder 3: CC 31
- Encoder 4: CC 32
- Encoder 5: CC 33
- Encoder 6: CC 34
- Encoder 7: CC 27
- Encoder 8: CC 28

## Slider Mappings (8 total)
- Slider 1: CC 77
- Slider 2: CC 78
- Slider 3: CC 71
- Slider 4: CC 72
- Slider 5: CC 73
- Slider 6: CC 74
- Slider 7: CC 75
- Slider 8: CC 76

## Additional Controls
- CC 36-48: Likely button-related functions or effects controls
- CC 37: Distortion
- CC 38: Flanger
- CC 39: Phaser
- CC 40: Chorus
- CC 41: Delay
- CC 42: Reverb
- CC 43: Filter (FX)
- CC 44: Sub On
- CC 45: Noise On
- CC 46: A On
- CC 47: B On
- CC 48: Filter On

## SysEx Messages Captured

### Device Identification
```
F0 00 20 29 00 42 02 [Serial Number as ASCII] F7
```
- Serial number example: "LX28093540469"

### Universal Device Inquiry Response
```
F0 7E 00 06 02 00 20 29 48 01 00 00 01 00 0A 54 F7
```
- Product ID: 0x4801
- Firmware version encoded in last bytes

## LED Control
- No direct LED control messages were captured during button presses
- LEDs likely controlled via Note On/Off messages on specific channels
- Encoder ring LEDs may respond to CC value changes automatically

## Notes
- All controls send on MIDI Channel 1 by default
- CC values range from 0-127
- No button press (Note) messages were captured - buttons may be in a different mode
