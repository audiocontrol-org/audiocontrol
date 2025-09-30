# @oletizi/launch-control-xl3

TypeScript library for controlling the Novation Launch Control XL 3 MIDI controller. Focuses on custom mode management and device communication.

## Installation

```bash
npm install @oletizi/launch-control-xl3
```

No additional MIDI library installation required - the package includes its own MIDI backend.

## Quick Start

```typescript
import { LaunchControlXL3 } from '@oletizi/launch-control-xl3';

const device = new LaunchControlXL3({
  enableCustomModes: true
});

await device.connect();

// Listen for connection
device.on('device:connected', (info) => {
  console.log('Connected:', info.firmwareVersion);
});

// Load a custom mode from device slot 0-15
const mode = await device.loadCustomMode(0);
console.log('Mode name:', mode.name);
console.log('Controls:', mode.controls);
```

## Features

### Custom Mode Management

Read and write custom modes to device slots 0-15:

```typescript
// Read mode from device
const mode = await device.loadCustomMode(0);

// Write mode to device
await device.writeCustomMode(1, mode);
```

### Device Connection

```typescript
const device = new LaunchControlXL3({
  deviceNameFilter: 'Launch Control XL',
  reconnectOnError: true,
  maxReconnectAttempts: 5
});

await device.connect();
await device.disconnect();
```

### Control Mapping

```typescript
// Map a control to MIDI CC
device.mapControl('FADER1', 0, 7, {
  min: 0,
  max: 127,
  behaviour: 'absolute'
});

// Listen for control changes
device.on('control:change', (id, value) => {
  console.log(`${id}: ${value}`);
});
```

### Custom Mode Builder

Create custom modes programmatically:

```typescript
import { CustomModeBuilder } from '@oletizi/launch-control-xl3';

const mode = new CustomModeBuilder()
  .name('MyMode')
  .addFader(1, { cc: 7, channel: 1 })
  .addEncoder(1, 1, { cc: 13, channel: 1 })
  .build();

await device.writeCustomMode(0, mode);
```

## API

### Connection

- `connect()` - Connect to device
- `disconnect()` - Disconnect from device
- `getStatus()` - Get device status
- `cleanup()` - Clean up resources

### Custom Modes

- `loadCustomMode(slot)` - Read mode from device (slot 0-15)
- `writeCustomMode(slot, mode)` - Write mode to device (slot 0-15)

### Control Mapping

- `mapControl(id, channel, cc, options)` - Map a control
- `unmapControl(id)` - Remove control mapping

### Events

```typescript
device.on('device:connected', (info) => { });
device.on('device:disconnected', () => { });
device.on('device:error', (error) => { });
device.on('control:change', (id, value) => { });
device.on('mode:loaded', (slot, mode) => { });
device.on('mode:saved', (slot, mode) => { });
```

## Custom Mode Format

Custom modes contain:

- `name` - Mode name (max 8 characters)
- `controls` - Control definitions with CC mappings
- `labels` - Optional control labels
- `colors` - Optional button colors

Example:

```typescript
{
  name: 'MyMode',
  controls: {
    control_16: {
      controlId: 0x10,
      controlType: 0x05,
      midiChannel: 0,
      ccNumber: 13,
      minValue: 0,
      maxValue: 127,
      behavior: 'absolute'
    }
  }
}
```

## System Requirements

- Node.js 18+
- Novation Launch Control XL 3 hardware

### Platform Support

- macOS 12+
- Windows 10/11
- Linux (Ubuntu 20.04+)

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for build and testing instructions.

## License

Apache-2.0

## Acknowledgments

Launch Control XL is a trademark of Focusrite Audio Engineering Limited.
