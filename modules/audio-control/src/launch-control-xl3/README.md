# Launch Control XL 3 MIDI Library

TypeScript/JavaScript library for communicating with the Novation Launch Control XL 3 MIDI controller via the Web MIDI API.

## Overview

This library provides a complete implementation of the Launch Control XL 3's SysEx protocol, allowing you to:

- Read and write custom modes to/from the device
- Handle real-time MIDI control changes
- Manage LED states (when protocol is fully discovered)
- Work with the device's 15 custom mode slots

## Installation

```bash
npm install @ol-dsp/launch-control-xl3
```

## Usage

### Basic Connection

```typescript
import { LaunchControlXL3Client } from '@ol-dsp/launch-control-xl3';

const client = new LaunchControlXL3Client();

// Connect to device (requires user permission for MIDI access)
await client.connect();

// Set up event handlers
client.onControlChange = (channel, cc, value) => {
  console.log(`Control Change: CC ${cc} = ${value}`);
};

client.onNoteOn = (channel, note, velocity) => {
  console.log(`Button pressed: Note ${note}`);
};
```

### Reading Custom Modes

```typescript
// Read custom mode from slot 3
const mode = await client.readCustomMode(3);

if (mode) {
  console.log('Mode name:', mode.name);
  console.log('Controls:', mode.controls);
}
```

### Writing Custom Modes

```typescript
import { CustomMode, ControlType } from '@ol-dsp/launch-control-xl3';

const customMode: CustomMode = {
  name: 'My Synth Control',
  controls: [
    {
      id: 0x10,
      type: ControlType.ENCODER,
      name: 'Filter Cutoff',
      channel: 1,
      ccNumber: 74,
      minValue: 0,
      maxValue: 127
    },
    {
      id: 0x11,
      type: ControlType.FADER,
      name: 'Volume',
      channel: 1,
      ccNumber: 7,
      minValue: 0,
      maxValue: 127
    }
  ]
};

// Write to slot 1
await client.writeCustomMode(1, customMode);
```

## Protocol Details

The library implements the proprietary SysEx protocol used by the Launch Control XL 3:

### Message Format

- **Manufacturer ID**: `00 20 29` (Focusrite/Novation)
- **Device ID**: `02` (Launch Control XL 3)
- **Commands**:
  - Read: `F0 00 20 29 02 15 05 00 40 [SLOT] 02 F7`
  - Write: `F0 00 20 29 02 15 05 00 45 [SLOT] ... F7`

### 7-bit Encoding

The library includes the Midimunge encoding system used to convert 8-bit data to MIDI-safe 7-bit format:

```typescript
import { eightToSeven, sevenToEight } from '@ol-dsp/launch-control-xl3';

// Encode data for MIDI transmission
const encoded = eightToSeven(data);

// Decode received MIDI data
const decoded = sevenToEight(encoded);
```

## Hardware Layout

The Launch Control XL 3 has:
- 24 rotary encoders (3 rows of 8)
- 8 faders
- 16 buttons (2 rows of 8)
- All controls can be mapped to MIDI CC messages
- 15 custom mode storage slots

## Browser Compatibility

Requires a browser with Web MIDI API support:
- Chrome/Edge 43+
- Opera 30+
- Firefox (with Web MIDI API flag enabled)

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## Protocol Research Status

### ✅ Implemented
- SysEx format for reading/writing custom modes
- Manufacturer and Device IDs
- Control mapping structure
- Slot targeting (1-15)
- Multi-message transfer protocol
- 7-bit encoding (Midimunge)

### 🚧 In Progress
- LED control protocol
- Template/mode switching commands
- Real-time parameter feedback
- Device initialization sequence
- Error response handling

## License

MIT

## Credits

Protocol reverse-engineered from the official Novation Components web editor.

Based on analysis conducted on 2025-09-25.