# Launch Control XL 3 - Examples

This directory contains example applications demonstrating various features of the Launch Control XL 3 library.

## Running Examples

First, ensure dependencies are installed:

```bash
npm install
```

Then run any example using tsx:

```bash
npm run example:basic
npm run example:leds
npm run example:modes
npm run example:mapping
```

Or run directly with tsx:

```bash
npx tsx examples/basic-connection.ts
```

## Available Examples

### 1. Basic Connection (`basic-connection.ts`)

Demonstrates the fundamentals:
- Connecting to the device
- Handling device events
- Monitoring control changes
- Getting device status

### 2. LED Animations (`led-animations.ts`)

Shows LED control capabilities:
- Setting individual LED colors
- Flash and pulse effects
- Rainbow animation
- Chase patterns
- Custom animations

### 3. Custom Modes (`custom-modes.ts`)

Covers custom mode management:
- Creating custom modes
- Configuring control mappings
- Setting LED states
- Saving modes to device
- Loading modes from device
- Exporting configurations

### 4. Control Mapping (`control-mapping.ts`)

Advanced control mapping features:
- Linear mapping (default)
- Exponential curves (volume control)
- Logarithmic curves
- Stepped/quantized values
- Relative encoders (3 modes)
- Toggle switches
- Inverted controls
- Bipolar controls
- Value smoothing

## Example Output

### Basic Connection
```
Launch Control XL 3 - Basic Connection Example
==================================================
Connecting to device...
✓ Device connected
  Manufacturer: 00 20 29
  Firmware: 1.0.0.0

Device Status:
  Connected: true
  State: connected

Monitoring controls... Press Ctrl+C to exit
Control SEND_A1: 64 (ch0)
Control FADER1: 127 (ch0)
```

### LED Animations
```
Launch Control XL 3 - LED Animations Example
==================================================
✓ Connected to device

1. Setting individual LEDs...
2. Flashing LEDs...
3. Pulsing LEDs...
4. Rainbow animation...
5. Chase animation...
6. Custom animation...

Turning off all LEDs...
✓ Animation demo complete
```

### Control Mapping
```
Launch Control XL 3 - Control Mapping Example
==================================================
✓ Connected to device

📊 Control Value Transformations:
──────────────────────────────────────────────────
Move controls to see transformed values...

SEND_A1  │ Raw:  64 │ linear       │ Out:  64 │ [█████░░░░░]
FADER1   │ Raw:  64 │ exponential  │ Out:  32 │ [██░░░░░░░░]
SEND_B1  │ Raw:  64 │ logarithmic  │ Out:  90 │ [███████░░░]
SEND_B5  │ Raw:  64 │ stepped      │ Out:  73 │ [██████░░░░]
PAN4     │ Raw:  70 │ toggle       │ Out: 127 │ [██████████]
PAN5     │ Raw:  30 │ invert       │ Out:  97 │ [████████░░]
```

## Key Concepts

### Device Connection
All examples start by creating a `LaunchControlXL3` instance and initializing it:

```typescript
const controller = new LaunchControlXL3({
  autoConnect: true,
  enableLedControl: true,
  enableCustomModes: true,
});

await controller.initialize();
```

### Event Handling
The library uses an event-driven architecture:

```typescript
controller.on('control:change', (controlId, value) => {
  console.log(`${controlId}: ${value}`);
});

controller.on('device:disconnected', () => {
  console.log('Device disconnected');
});
```

### Control Mapping
Controls can be mapped with various behaviors and transformations:

```typescript
controller.mapControl('FADER1', 0, 80, {
  min: 0,
  max: 127,
  behaviour: 'absolute',
  transform: {
    type: 'exponential',
    curve: 2.5,
  },
});
```

### LED Control
LEDs can be controlled individually or through animations:

```typescript
// Individual control
await controller.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL);

// Animation
controller.startLedAnimation('chase', {
  type: 'chase',
  duration: 3000,
  controls: ['FOCUS1', 'FOCUS2', 'FOCUS3'],
  colors: [LED_COLOR_VALUES.GREEN_FULL],
});
```

## Hardware Requirements

- Novation Launch Control XL (Mark 3)
- USB connection to computer
- Node.js 18+ with MIDI support

## Troubleshooting

### Device Not Found
- Ensure the Launch Control XL 3 is connected via USB
- Check that no other application is using the MIDI device
- On macOS, you may need to grant MIDI permissions

### Permission Errors
- On Linux, you may need to add your user to the `audio` group
- Run with `sudo` if necessary (not recommended for production)

### MIDI Library Issues
- The library supports multiple MIDI backends
- Install platform-specific MIDI support if needed:
  ```bash
  npm install midi  # For node-midi backend
  npm install jzz   # For JZZ backend
  ```