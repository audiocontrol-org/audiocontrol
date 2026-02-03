# Launch Control XL 3 API Documentation

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core API](#core-api)
  - [LaunchControlXL3](#launchcontrolxl3)
  - [Device Management](#device-management)
  - [Control Mapping](#control-mapping)
  - [LED Control](#led-control)
  - [Custom Modes](#custom-modes)
- [Advanced Features](#advanced-features)
  - [Value Transformations](#value-transformations)
  - [MIDI Backends](#midi-backends)
  - [Event System](#event-system)
- [Type Reference](#type-reference)

## Installation

```bash
npm install @ol-dsp/launch-control-xl3

# Optional MIDI backends
npm install midi     # For Node.js (recommended)
npm install jzz      # Cross-platform alternative
```

## Quick Start

```typescript
import { LaunchControlXL3 } from '@ol-dsp/launch-control-xl3';

const controller = new LaunchControlXL3({
  autoConnect: true,
  enableLedControl: true
});

await controller.initialize();

controller.on('control:change', (controlId, value) => {
  console.log(`${controlId}: ${value}`);
});
```

## Core API

### LaunchControlXL3

Main controller class for device interaction.

#### Constructor

```typescript
new LaunchControlXL3(options?: LaunchControlOptions)
```

##### Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `midiBackend` | `MidiBackendInterface` | auto-detect | Custom MIDI backend implementation |
| `autoConnect` | `boolean` | `true` | Automatically connect on initialization |
| `enableLedControl` | `boolean` | `true` | Enable LED control features |
| `enableCustomModes` | `boolean` | `true` | Enable custom mode management |
| `enableValueSmoothing` | `boolean` | `false` | Enable control value smoothing |
| `smoothingFactor` | `number` | `3` | Smoothing amount (1-10) |
| `deviceNameFilter` | `string` | `'Launch Control XL'` | Device name filter for discovery |
| `reconnectOnError` | `boolean` | `true` | Auto-reconnect on disconnect |
| `maxReconnectAttempts` | `number` | `5` | Maximum reconnection attempts |
| `reconnectDelay` | `number` | `1000` | Delay between reconnection attempts (ms) |

#### Methods

##### Device Control

###### `initialize(): Promise<void>`

Initialize the controller and optionally connect to device.

```typescript
await controller.initialize();
```

###### `connect(): Promise<void>`

Manually connect to Launch Control XL 3 device.

```typescript
await controller.connect();
```

###### `disconnect(): Promise<void>`

Disconnect from the device.

```typescript
await controller.disconnect();
```

###### `isConnected(): boolean`

Check if device is connected.

```typescript
if (controller.isConnected()) {
  console.log('Device connected');
}
```

###### `getStatus(): DeviceStatus`

Get current device status and information.

```typescript
const status = controller.getStatus();
console.log(`Firmware: ${status.deviceInfo.firmwareVersion}`);
```

Returns:
```typescript
interface DeviceStatus {
  connected: boolean;
  state: 'disconnected' | 'connecting' | 'connected' | 'ready';
  deviceInfo?: {
    firmwareVersion: string;
    serialNumber?: string;
    deviceId?: number;
  };
  currentMode?: string;
  lastSeen?: Date;
  error?: string;
}
```

###### `cleanup(): Promise<void>`

Clean up all resources and close connections.

```typescript
await controller.cleanup();
```

### Device Management

The device manager handles discovery, connection, and communication.

#### Device Discovery

```typescript
// Get available MIDI ports
const inputs = await controller.getAvailableInputs();
const outputs = await controller.getAvailableOutputs();

// Connect to specific port
await controller.connectToPort('Launch Control XL MK3');
```

#### Device Information

```typescript
// Get device info after connection
const info = controller.getDeviceInfo();
console.log(`Family: ${info.family}`);
console.log(`Model: ${info.model}`);
console.log(`Firmware: ${info.firmwareVersion}`);
```

### Control Mapping

Map hardware controls to MIDI messages with optional value transformations.

#### Basic Mapping

```typescript
// Map a fader to MIDI CC
controller.mapControl('FADER1', 0, 7, {
  min: 0,
  max: 127,
  behaviour: 'absolute'
});

// Map a knob with custom range
controller.mapControl('SEND_A1', 0, 20, {
  min: 20,
  max: 100,
  behaviour: 'absolute'
});
```

#### Mapping Options

```typescript
interface MappingOptions {
  min?: number;              // Minimum value (0-127)
  max?: number;              // Maximum value (0-127)
  behaviour?: ControlBehaviour;
  transform?: ValueTransform;
  defaultValue?: number;
  description?: string;
}

type ControlBehaviour =
  | 'absolute'    // Standard absolute value
  | 'relative1'   // Two's complement (-64 to +63)
  | 'relative2'   // Binary offset (64 = 0, <64 = -, >64 = +)
  | 'relative3';  // Sign bit (Bit 6 = direction)
```

#### Control IDs

Available control identifiers:

**Knobs:**
- `SEND_A1` to `SEND_A8` - Top row of knobs
- `SEND_B1` to `SEND_B8` - Middle row of knobs
- `PAN1` to `PAN8` - Bottom row of knobs

**Faders:**
- `FADER1` to `FADER8` - Volume faders

**Buttons:**
- `FOCUS1` to `FOCUS8` - Top row of buttons
- `CONTROL1` to `CONTROL8` - Bottom row of buttons
- `TRACK_LEFT`, `TRACK_RIGHT` - Track selection buttons
- `SEND`, `PAN` - Mode buttons

#### Getting/Updating Mappings

```typescript
// Get current mapping
const mapping = controller.getControlMapping('FADER1');

// Update existing mapping
controller.updateControlMapping('FADER1', {
  max: 100,
  transform: { type: 'exponential', curve: 2 }
});

// Remove mapping
controller.unmapControl('FADER1');

// Get all mappings
const mappings = controller.getAllMappings();
```

### LED Control

Control button LEDs with colors and animations.

#### Basic LED Control

```typescript
import { LED_COLOR_VALUES } from '@ol-dsp/launch-control-xl3';

// Set static color
await controller.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL);

// Turn off LED
await controller.turnOffLed('FOCUS1');

// Turn off all LEDs
await controller.turnOffAllLeds();
```

#### LED Colors

Available colors via `LED_COLOR_VALUES`:

| Color | Values |
|-------|--------|
| **Red** | `RED_LOW`, `RED_MEDIUM`, `RED_FULL` |
| **Amber** | `AMBER_LOW`, `AMBER_MEDIUM`, `AMBER_FULL` |
| **Yellow** | `YELLOW_LOW`, `YELLOW_FULL` |
| **Green** | `GREEN_LOW`, `GREEN_MEDIUM`, `GREEN_FULL` |
| **Off** | `OFF` |

You can also use numeric values (0-127) for direct color control.

#### LED Behaviors

```typescript
// Static (default)
await controller.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL, 'static');

// Flashing
await controller.setLed('FOCUS2', LED_COLOR_VALUES.RED_FULL, 'flash');

// Pulsing
await controller.setLed('FOCUS3', LED_COLOR_VALUES.AMBER_FULL, 'pulse');
```

#### LED Effects

```typescript
// Flash once
await controller.flashLed('CONTROL1', LED_COLOR_VALUES.GREEN_FULL, 500);

// Multiple flashes
await controller.flashLed('CONTROL2', LED_COLOR_VALUES.RED_FULL, 200, 3);
```

#### LED Animations

```typescript
// Rainbow animation
controller.startLedAnimation('rainbow', {
  type: 'rainbow',
  duration: 5000,
  controls: ['FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4'],
  colors: 'rainbow',
  repeat: 'infinite'
});

// Chase animation
controller.startLedAnimation('chase', {
  type: 'chase',
  duration: 2000,
  controls: ['FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4'],
  colors: [LED_COLOR_VALUES.GREEN_FULL],
  stepDuration: 100
});

// Stop animation
controller.stopLedAnimation('rainbow');
controller.stopAllAnimations();
```

##### Animation Types

| Type | Description | Options |
|------|-------------|---------|
| `rainbow` | Cycle through colors | `colors: 'rainbow' \| number[]` |
| `chase` | Sequential LED activation | `stepDuration: number` |
| `pulse` | Synchronized pulsing | `pulseRate: number` |
| `flash` | Synchronized flashing | `flashRate: number` |
| `fade` | Fade between colors | `fadeTime: number` |
| `custom` | Custom animation function | `update: (frame: number) => void` |

### Custom Modes

Manage device custom modes (templates) with full read/write support.

#### Creating Custom Modes

```typescript
// Create new mode
const mode = controller.createCustomMode('DAW Control');

// Configure controls
mode.controls['FADER1'] = {
  type: 'fader',
  channel: 0,
  cc: 7,  // Volume
  min: 0,
  max: 127,
  behaviour: 'absolute'
};

mode.controls['PAN1'] = {
  type: 'knob',
  channel: 0,
  cc: 10, // Pan
  min: 0,
  max: 127,
  behaviour: 'absolute',
  defaultValue: 64
};

// Configure LEDs
mode.leds['FOCUS1'] = {
  color: LED_COLOR_VALUES.GREEN_FULL,
  behaviour: 'static'
};
```

#### Saving/Loading Modes

```typescript
// Save to device (slot 0-15)
await controller.saveCustomMode(0, mode);

// Load from device
const loadedMode = await controller.loadCustomMode(0);
console.log(`Loaded: ${loadedMode.name}`);

// List all modes
const modes = await controller.listCustomModes();
modes.forEach((mode, slot) => {
  console.log(`Slot ${slot}: ${mode?.name || 'Empty'}`);
});
```

#### Mode Structure

```typescript
interface CustomMode {
  name: string;
  controls: {
    [controlId: string]: {
      type: 'knob' | 'fader' | 'button';
      channel: number;      // 0-15
      cc?: number;          // 0-127 (for knobs/faders)
      note?: number;        // 0-127 (for buttons)
      min?: number;         // 0-127
      max?: number;         // 0-127
      behaviour?: ControlBehaviour;
      defaultValue?: number;
    };
  };
  leds: {
    [controlId: string]: {
      color: number;        // 0-127
      behaviour?: 'static' | 'flash' | 'pulse';
    };
  };
  metadata?: {
    created?: Date;
    modified?: Date;
    author?: string;
    description?: string;
  };
}
```

#### Exporting/Importing

```typescript
// Export current state as custom mode
const exported = controller.exportCurrentAsCustomMode('My Setup');

// Export to JSON
const json = JSON.stringify(exported);
fs.writeFileSync('my-setup.json', json);

// Import from JSON
const imported = JSON.parse(fs.readFileSync('my-setup.json', 'utf8'));
await controller.saveCustomMode(1, imported);
```

## Advanced Features

### Value Transformations

Transform control values using built-in or custom functions.

#### Built-in Transformations

```typescript
// Linear (default)
controller.mapControl('FADER1', 0, 7, {
  transform: { type: 'linear' }
});

// Exponential (great for volume)
controller.mapControl('FADER2', 0, 7, {
  transform: {
    type: 'exponential',
    curve: 2.5  // Higher = more dramatic curve
  }
});

// Logarithmic (inverse exponential)
controller.mapControl('FADER3', 0, 7, {
  transform: {
    type: 'logarithmic',
    curve: 2.5
  }
});

// Stepped/Quantized
controller.mapControl('SEND_A1', 0, 20, {
  transform: {
    type: 'stepped',
    steps: 8  // Quantize to 8 discrete values
  }
});

// Toggle (binary)
controller.mapControl('FOCUS1', 0, 30, {
  transform: {
    type: 'toggle',
    threshold: 64  // Values >= 64 become 127, < 64 become 0
  }
});

// Inverted
controller.mapControl('FADER4', 0, 7, {
  transform: { type: 'invert' }
});

// Bipolar (centered at 0)
controller.mapControl('PAN1', 0, 10, {
  transform: { type: 'bipolar' }  // -64 to +63
});
```

#### Custom Transformations

```typescript
// Custom transform function
controller.mapControl('SEND_B1', 0, 21, {
  transform: {
    type: 'custom',
    transform: (value: number) => {
      // Custom logic here
      return Math.round(value * 0.8);
    }
  }
});
```

### MIDI Backends

The library supports multiple MIDI backend implementations.

#### Auto-detection (Default)

The library automatically detects available backends in this order:
1. Web MIDI API (browser)
2. node-midi (Node.js)
3. JZZ (cross-platform)
4. Mock backend (testing)

#### Custom Backend

```typescript
import { MidiBackendInterface } from '@ol-dsp/launch-control-xl3';

class CustomMidiBackend implements MidiBackendInterface {
  async initialize(): Promise<void> { /* ... */ }
  async getInputPorts(): Promise<MidiPortInfo[]> { /* ... */ }
  async getOutputPorts(): Promise<MidiPortInfo[]> { /* ... */ }
  // ... implement all required methods
}

const controller = new LaunchControlXL3({
  midiBackend: new CustomMidiBackend()
});
```

#### Mock Backend (Testing)

```typescript
import { createMockBackend } from '@ol-dsp/launch-control-xl3';

const mockBackend = createMockBackend();
const controller = new LaunchControlXL3({
  midiBackend: mockBackend
});

// Simulate control changes
mockBackend.simulateControlChange(0, 7, 100);
```

### Event System

The controller extends EventEmitter and provides comprehensive events.

#### Device Events

```typescript
controller.on('device:connected', (device: DeviceInfo) => {
  console.log(`Connected: ${device.name}`);
});

controller.on('device:disconnected', (reason?: string) => {
  console.log(`Disconnected: ${reason}`);
});

controller.on('device:ready', () => {
  console.log('Device ready for use');
});

controller.on('device:error', (error: Error) => {
  console.error(`Device error: ${error.message}`);
});
```

#### Control Events

```typescript
controller.on('control:change', (controlId: string, value: number, channel?: number) => {
  console.log(`${controlId}: ${value}`);
});

controller.on('control:mapped', (controlId: string, mapping: ControlMapping) => {
  console.log(`Mapped ${controlId} to CC ${mapping.cc}`);
});

controller.on('control:unmapped', (controlId: string) => {
  console.log(`Unmapped ${controlId}`);
});
```

#### Mode Events

```typescript
controller.on('mode:changed', (slot: number, mode: CustomMode) => {
  console.log(`Changed to mode ${slot}: ${mode.name}`);
});

controller.on('mode:loaded', (slot: number, mode: CustomMode) => {
  console.log(`Loaded mode from slot ${slot}`);
});

controller.on('mode:saved', (slot: number, mode: CustomMode) => {
  console.log(`Saved mode to slot ${slot}`);
});
```

#### LED Events

```typescript
controller.on('led:changed', (controlId: string, color: number, behaviour?: string) => {
  console.log(`LED ${controlId} set to ${color}`);
});

controller.on('led:animation:started', (animationId: string) => {
  console.log(`Animation started: ${animationId}`);
});

controller.on('led:animation:stopped', (animationId: string) => {
  console.log(`Animation stopped: ${animationId}`);
});
```

#### MIDI Events

```typescript
controller.on('midi:in', (message: MidiMessage) => {
  console.log(`MIDI In: ${message.data}`);
});

controller.on('midi:out', (message: MidiMessage) => {
  console.log(`MIDI Out: ${message.data}`);
});

controller.on('sysex:received', (data: number[]) => {
  console.log(`SysEx: ${data.length} bytes`);
});
```

## Type Reference

### Core Types

```typescript
// Control identifiers
type ControlId =
  | 'SEND_A1' | 'SEND_A2' | 'SEND_A3' | 'SEND_A4'
  | 'SEND_A5' | 'SEND_A6' | 'SEND_A7' | 'SEND_A8'
  | 'SEND_B1' | 'SEND_B2' | 'SEND_B3' | 'SEND_B4'
  | 'SEND_B5' | 'SEND_B6' | 'SEND_B7' | 'SEND_B8'
  | 'PAN1' | 'PAN2' | 'PAN3' | 'PAN4'
  | 'PAN5' | 'PAN6' | 'PAN7' | 'PAN8'
  | 'FADER1' | 'FADER2' | 'FADER3' | 'FADER4'
  | 'FADER5' | 'FADER6' | 'FADER7' | 'FADER8'
  | 'FOCUS1' | 'FOCUS2' | 'FOCUS3' | 'FOCUS4'
  | 'FOCUS5' | 'FOCUS6' | 'FOCUS7' | 'FOCUS8'
  | 'CONTROL1' | 'CONTROL2' | 'CONTROL3' | 'CONTROL4'
  | 'CONTROL5' | 'CONTROL6' | 'CONTROL7' | 'CONTROL8'
  | 'TRACK_LEFT' | 'TRACK_RIGHT' | 'SEND' | 'PAN';

// MIDI message
interface MidiMessage {
  timestamp: number;
  data: number[];
}

// Control mapping
interface ControlMapping {
  controlId: string;
  channel: number;
  cc?: number;
  note?: number;
  min: number;
  max: number;
  behaviour: ControlBehaviour;
  transform?: ValueTransform;
  defaultValue?: number;
}

// Value transform
interface ValueTransform {
  type: 'linear' | 'exponential' | 'logarithmic' |
        'stepped' | 'toggle' | 'invert' | 'bipolar' | 'custom';
  curve?: number;      // For exponential/logarithmic
  steps?: number;      // For stepped
  threshold?: number;  // For toggle
  transform?: (value: number) => number; // For custom
}

// LED animation
interface LedAnimation {
  type: 'rainbow' | 'chase' | 'pulse' | 'flash' | 'fade' | 'custom';
  duration: number;
  controls: string[];
  colors?: number[] | 'rainbow';
  repeat?: number | 'infinite';
  stepDuration?: number;
  pulseRate?: number;
  flashRate?: number;
  fadeTime?: number;
  update?: (frame: number) => void;
}
```

### SysEx Types

```typescript
// SysEx message types
enum SysExMessageType {
  TEMPLATE_CHANGE = 0x77,
  LED_CONTROL = 0x0C,
  RESET_LED = 0x0B,
  CUSTOM_MODE_WRITE = 0x08,
  CUSTOM_MODE_READ = 0x09
}

// Device inquiry response
interface DeviceInquiryResponse {
  type: 'device_inquiry_response';
  manufacturerId: number[];
  familyCode: number;
  familyMember: number;
  softwareRevision: number[];
}

// Custom mode data
interface CustomModeData {
  slot: number;
  controls: ControlConfig[];
  colors: ColorConfig[];
  data: number[];
}
```

### Error Types

```typescript
// Device errors
class DeviceNotFoundError extends Error {}
class DeviceConnectionError extends Error {}
class DeviceTimeoutError extends Error {}

// MIDI errors
class MidiPortError extends Error {}
class MidiMessageError extends Error {}

// SysEx errors
class SysExParseError extends Error {}
class SysExValidationError extends Error {}

// Custom mode errors
class CustomModeError extends Error {}
class InvalidSlotError extends Error {}
```

## Examples

### Basic DAW Control

```typescript
const controller = new LaunchControlXL3();
await controller.initialize();

// Map faders to mixer channels
for (let i = 0; i < 8; i++) {
  controller.mapControl(`FADER${i + 1}`, 0, 7 + i, {
    transform: { type: 'exponential', curve: 2 }
  });
}

// Map knobs to sends
for (let i = 0; i < 8; i++) {
  controller.mapControl(`SEND_A${i + 1}`, 0, 20 + i);
  controller.mapControl(`SEND_B${i + 1}`, 0, 30 + i);
}

// Set LED indicators
controller.on('control:change', async (id, value) => {
  if (id.startsWith('FADER')) {
    const num = id.replace('FADER', '');
    const color = value > 100 ? LED_COLOR_VALUES.RED_FULL :
                  value > 64 ? LED_COLOR_VALUES.AMBER_FULL :
                  value > 0 ? LED_COLOR_VALUES.GREEN_FULL :
                  LED_COLOR_VALUES.OFF;
    await controller.setLed(`FOCUS${num}`, color);
  }
});
```

### Live Performance Mode

```typescript
// Create performance mode
const performanceMode = controller.createCustomMode('Live Performance');

// Configure transport buttons
performanceMode.controls['FOCUS1'] = {
  type: 'button',
  channel: 0,
  note: 60,  // Play
};

performanceMode.controls['FOCUS2'] = {
  type: 'button',
  channel: 0,
  note: 61,  // Stop
};

// Configure scene triggers
for (let i = 0; i < 6; i++) {
  performanceMode.controls[`CONTROL${i + 1}`] = {
    type: 'button',
    channel: 0,
    note: 64 + i,  // Scene triggers
  };
}

// Save to device
await controller.saveCustomMode(0, performanceMode);

// LED feedback for active scene
controller.on('control:change', async (id, value) => {
  if (id.startsWith('CONTROL') && value > 0) {
    // Turn off all scene LEDs
    for (let i = 1; i <= 6; i++) {
      await controller.turnOffLed(`CONTROL${i}`);
    }
    // Turn on active scene
    await controller.setLed(id, LED_COLOR_VALUES.GREEN_FULL);
  }
});
```

### MIDI Learn Mode

```typescript
class MidiLearnMode {
  private controller: LaunchControlXL3;
  private learningControl?: string;

  constructor(controller: LaunchControlXL3) {
    this.controller = controller;
  }

  async startLearning(controlId: string) {
    this.learningControl = controlId;

    // Flash LED to indicate learning
    await this.controller.setLed(controlId, LED_COLOR_VALUES.AMBER_FULL, 'flash');

    // Wait for MIDI input
    const handler = (channel: number, cc: number, value: number) => {
      if (this.learningControl) {
        // Map the control
        this.controller.mapControl(this.learningControl, channel, cc);

        // Stop flashing
        this.controller.setLed(this.learningControl, LED_COLOR_VALUES.GREEN_FULL);

        this.learningControl = undefined;
        this.controller.off('midi:cc', handler);
      }
    };

    this.controller.on('midi:cc', handler);
  }
}
```

## Troubleshooting

### Device Not Found

```typescript
// Check available devices
const inputs = await controller.getAvailableInputs();
console.log('Available devices:', inputs);

// Use specific device name
const controller = new LaunchControlXL3({
  deviceNameFilter: 'Launch Control XL MK3'
});
```

### Permission Issues

**macOS:**
- Check System Preferences > Security & Privacy > Privacy for MIDI access

**Linux:**
```bash
# Add user to audio group
sudo usermod -a -G audio $USER

# Add udev rule
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="1235", MODE="0666"' | \
  sudo tee /etc/udev/rules.d/50-launch-control.rules
sudo udevadm control --reload-rules
```

### Connection Issues

```typescript
// Enable debug logging
controller.on('device:error', console.error);
controller.on('midi:in', console.log);
controller.on('midi:out', console.log);

// Manual connection with retry
async function connectWithRetry(maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await controller.connect();
      return;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Failed to connect after ' + maxAttempts + ' attempts');
}
```

## Performance Tips

1. **Use value smoothing for jittery controls:**
```typescript
const controller = new LaunchControlXL3({
  enableValueSmoothing: true,
  smoothingFactor: 5
});
```

2. **Batch LED updates:**
```typescript
// Instead of individual updates
for (const led of leds) {
  await controller.setLed(led, color);  // Slow
}

// Use batch update
await controller.setMultipleLeds([
  { control: 'FOCUS1', color: LED_COLOR_VALUES.GREEN_FULL },
  { control: 'FOCUS2', color: LED_COLOR_VALUES.RED_FULL }
]);
```

3. **Use appropriate value transforms:**
```typescript
// Volume controls need exponential curves
controller.mapControl('FADER1', 0, 7, {
  transform: { type: 'exponential', curve: 2.5 }
});

// Switch-like controls need toggle
controller.mapControl('FOCUS1', 0, 30, {
  transform: { type: 'toggle', threshold: 64 }
});
```

4. **Optimize event handlers:**
```typescript
// Debounce rapid changes
import { debounce } from 'lodash';

const handleChange = debounce((id, value) => {
  // Process change
}, 50);

controller.on('control:change', handleChange);
```

## License

MIT © OL DSP Team

## Support

- **Issues**: [GitHub Issues](https://github.com/ol-dsp/launch-control-xl3/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ol-dsp/launch-control-xl3/discussions)
- **Protocol Spec**: [docs/PROTOCOL.md](./PROTOCOL.md)