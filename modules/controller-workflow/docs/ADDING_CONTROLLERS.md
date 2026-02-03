# Adding Controllers Guide

This guide walks you through adding support for a new MIDI controller to the controller-workflow framework.

## Overview

Adding a new controller involves three main steps:

1. **Implement ControllerAdapterInterface** - Hardware communication layer
2. **Implement CanonicalConverterInterface** - Format conversion layer
3. **Register in DeploymentWorkflow** - Auto-detection and converter selection

We'll use a hypothetical **Behringer X-Touch** controller as an example throughout this guide.

## Prerequisites

Before implementing support for a new controller:

- Research the controller's MIDI implementation (SysEx, CC mappings)
- Determine if the controller has programmable modes/configurations
- Identify how to read/write configurations (if supported)
- Gather documentation on the controller's data format

## Step 1: Implement ControllerAdapterInterface

### 1.1 Create the Adapter File

Create a new file in `src/adapters/controllers/`:

```bash
touch src/adapters/controllers/BehringerXTouchAdapter.ts
```

### 1.2 Define the Adapter Class

```typescript
/**
 * Adapter for Behringer X-Touch MIDI controller
 *
 * @module controller-workflow/adapters/controllers
 */

import type {
  ControllerAdapterInterface,
  ControllerCapabilities,
  ControllerConfiguration,
  ConfigurationSlot,
  DeviceInfo,
  ControlMapping,
} from '@/types/controller-adapter.js';

export class BehringerXTouchAdapter implements ControllerAdapterInterface {
  // Controller metadata
  readonly manufacturer = 'Behringer';
  readonly model = 'X-Touch';
  readonly capabilities: ControllerCapabilities = {
    supportsCustomModes: true,
    maxConfigSlots: 8, // X-Touch has 8 configuration slots
    supportsRead: true,
    supportsWrite: true,
    supportedControlTypes: ['encoder', 'slider', 'button'],
  };

  // Internal state
  private connected = false;
  private deviceHandle?: any; // Replace with actual device type

  private constructor() {
    // Private constructor for factory pattern
  }

  /**
   * Factory method to create and initialize the adapter
   */
  static async create(): Promise<BehringerXTouchAdapter> {
    const adapter = new BehringerXTouchAdapter();
    // Perform any async initialization here
    return adapter;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // TODO: Implement USB/MIDI device connection
    // Example:
    // this.deviceHandle = await findXTouchDevice();
    // await this.deviceHandle.open();

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // TODO: Close device connection
    // await this.deviceHandle?.close();

    this.connected = false;
    this.deviceHandle = undefined;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listConfigurations(): Promise<ConfigurationSlot[]> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    // TODO: Query controller for available slots
    // This might involve sending SysEx messages and parsing responses

    const slots: ConfigurationSlot[] = [];
    for (let i = 0; i < this.capabilities.maxConfigSlots; i++) {
      // Example: Check if slot has data
      const isEmpty = await this.checkSlotEmpty(i);
      const name = isEmpty ? undefined : await this.readSlotName(i);

      slots.push({
        index: i,
        name,
        isEmpty,
      });
    }

    return slots;
  }

  async readConfiguration(slot: number): Promise<ControllerConfiguration> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    if (slot < 0 || slot >= this.capabilities.maxConfigSlots) {
      throw new Error(`Invalid slot ${slot}. Must be between 0 and ${this.capabilities.maxConfigSlots - 1}`);
    }

    // TODO: Read configuration data from controller
    // This typically involves:
    // 1. Send SysEx request for slot data
    // 2. Parse response
    // 3. Extract control mappings

    const configData = await this.readSlotData(slot);
    const controls = this.parseControlMappings(configData);

    return {
      name: configData.name || `X-Touch Config ${slot}`,
      controls,
      metadata: {
        slotIndex: slot,
        // Add any X-Touch-specific metadata
        firmwareVersion: configData.firmwareVersion,
      },
    };
  }

  async writeConfiguration(slot: number, config: ControllerConfiguration): Promise<void> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    if (slot < 0 || slot >= this.capabilities.maxConfigSlots) {
      throw new Error(`Invalid slot ${slot}. Must be between 0 and ${this.capabilities.maxConfigSlots - 1}`);
    }

    // TODO: Convert ControllerConfiguration to controller-specific format
    // and write to device

    const deviceData = this.encodeConfiguration(config);
    await this.writeSlotData(slot, deviceData);
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    // TODO: Query device for firmware version and other info
    const firmwareVersion = await this.queryFirmwareVersion();

    return {
      manufacturer: this.manufacturer,
      model: this.model,
      firmwareVersion,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async checkSlotEmpty(slot: number): Promise<boolean> {
    // TODO: Implement slot emptiness check
    // This might involve reading slot metadata or checking for valid data
    return false; // Placeholder
  }

  private async readSlotName(slot: number): Promise<string> {
    // TODO: Read user-defined slot name from device
    return `Config ${slot}`; // Placeholder
  }

  private async readSlotData(slot: number): Promise<any> {
    // TODO: Send SysEx request and parse response
    // Example SysEx format (device-specific):
    // F0 00 20 32 <slot> <data...> F7

    throw new Error('Not implemented - readSlotData');
  }

  private parseControlMappings(configData: any): ControlMapping[] {
    // TODO: Parse controller-specific data format to ControlMapping[]
    // Example:
    const controls: ControlMapping[] = [];

    // Parse encoders
    for (let i = 0; i < 8; i++) {
      controls.push({
        id: `ENCODER_${i + 1}`,
        type: 'encoder',
        cc: configData.encoders[i].cc,
        channel: configData.encoders[i].channel || 0,
        range: [0, 127],
      });
    }

    // Parse faders
    for (let i = 0; i < 8; i++) {
      controls.push({
        id: `FADER_${i + 1}`,
        type: 'slider',
        cc: configData.faders[i].cc,
        channel: configData.faders[i].channel || 0,
        range: [0, 127],
      });
    }

    // Parse buttons
    // ... etc.

    return controls;
  }

  private encodeConfiguration(config: ControllerConfiguration): any {
    // TODO: Convert ControllerConfiguration to device-specific format
    throw new Error('Not implemented - encodeConfiguration');
  }

  private async writeSlotData(slot: number, data: any): Promise<void> {
    // TODO: Send SysEx write command to device
    throw new Error('Not implemented - writeSlotData');
  }

  private async queryFirmwareVersion(): Promise<string> {
    // TODO: Query firmware version via SysEx
    return '1.0.0'; // Placeholder
  }
}

/**
 * Factory function for creating BehringerXTouchAdapter instances
 */
export async function createBehringerXTouchAdapter(): Promise<BehringerXTouchAdapter> {
  return BehringerXTouchAdapter.create();
}
```

### 1.3 Key Implementation Notes

**Connection Management**:
- Use a factory method (`create()`) for async initialization
- Implement proper connection lifecycle (connect/disconnect)
- Handle reconnection scenarios

**Error Handling**:
- Always check `isConnected()` before operations
- Throw descriptive errors (no fallbacks)
- Validate slot numbers and parameters

**SysEx Communication** (if applicable):
- Research device-specific SysEx format
- Implement timeout handling
- Parse responses robustly

## Step 2: Implement CanonicalConverterInterface

### 2.1 Create the Converter File

Create a new file in `src/converters/`:

```bash
touch src/converters/BehringerXTouchConverter.ts
```

### 2.2 Define the Converter Class

```typescript
/**
 * Converter for Behringer X-Touch configurations to canonical MIDI maps
 *
 * @module controller-workflow/converters
 */

import type { CanonicalMidiMap, DeviceDefinition, PluginDefinition } from '@oletizi/canonical-midi-maps';
import type {
  CanonicalConverterInterface,
  ConversionOptions,
  ConverterInfo,
} from '@/types/canonical-converter.js';
import type { ControllerConfiguration, ControlMapping } from '@/types/controller-adapter.js';

export class BehringerXTouchConverter implements CanonicalConverterInterface {
  convert(config: ControllerConfiguration, options: ConversionOptions): CanonicalMidiMap {
    if (!this.canConvert(config)) {
      throw new Error('Invalid X-Touch configuration - cannot convert');
    }

    // Build device definition
    const device: DeviceDefinition = {
      manufacturer: 'Behringer',
      model: 'X-Touch',
      ...(options.deviceOverrides || {}),
    };

    // Build plugin definition (if provided)
    const plugin: PluginDefinition | undefined = options.pluginInfo;

    // Convert controls
    const controls = config.controls.map((control, index) => {
      // Generate control ID based on plugin info or use generic
      const controlId = plugin
        ? this.generatePluginParameterId(control, index, plugin)
        : this.generateGenericId(control);

      // Generate label
      const label = options.preserveLabels && control.name
        ? control.name
        : this.generateLabel(control, index);

      return {
        id: controlId,
        label,
        midi: {
          type: this.getMidiType(control),
          channel: options.midiChannel ?? control.channel ?? 0,
          ...(control.cc !== undefined && { cc: control.cc }),
        },
      };
    });

    // Build canonical map
    const canonicalMap: CanonicalMidiMap = {
      metadata: {
        name: config.name,
        description: `X-Touch configuration exported from slot ${config.metadata?.slotIndex ?? 'unknown'}`,
        version: '1.0.0',
        ...(config.metadata?.firmwareVersion && {
          tags: [`firmware:${config.metadata.firmwareVersion}`],
        }),
      },
      device,
      ...(plugin && { plugin }),
      controls,
    };

    return canonicalMap;
  }

  canConvert(config: ControllerConfiguration): boolean {
    // Validate configuration structure
    if (!config || !config.controls || config.controls.length === 0) {
      return false;
    }

    // Validate all controls have required fields
    return config.controls.every((control) => {
      return (
        control.id &&
        control.type &&
        (control.cc !== undefined || control.type === 'button_group')
      );
    });
  }

  getConverterInfo(): ConverterInfo {
    return {
      supportedController: 'Behringer X-Touch',
      version: '1.0.0',
      features: [
        'Encoder mapping',
        'Fader mapping',
        'Button mapping',
        'Custom labeling',
        'Plugin parameter mapping',
      ],
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private generatePluginParameterId(
    control: ControlMapping,
    index: number,
    plugin: PluginDefinition
  ): string {
    // Generate semantic parameter ID based on plugin info
    // This could use plugin metadata to create meaningful names
    return `${plugin.name.toLowerCase().replace(/\s+/g, '-')}-param-${index}`;
  }

  private generateGenericId(control: ControlMapping): string {
    // Use controller's control ID directly
    return control.id.toLowerCase().replace(/\s+/g, '-');
  }

  private generateLabel(control: ControlMapping, index: number): string {
    // Generate human-readable label
    if (control.name) {
      return control.name;
    }

    // Fallback: Generate from control ID
    const type = control.type === 'encoder' ? 'Encoder' : control.type === 'slider' ? 'Fader' : 'Control';
    return `${type} ${index + 1}`;
  }

  private getMidiType(control: ControlMapping): 'cc' | 'note' | 'pitchbend' {
    // Map controller type to MIDI message type
    // X-Touch typically uses CC for encoders/faders
    if (control.type === 'button') {
      // Buttons might be notes or CCs depending on mode
      return control.cc !== undefined ? 'cc' : 'note';
    }
    return 'cc';
  }
}

/**
 * Factory function for creating BehringerXTouchConverter instances
 */
export function createBehringerXTouchConverter(): BehringerXTouchConverter {
  return new BehringerXTouchConverter();
}
```

### 2.3 Control ID Mapping Strategy

Choose one of these strategies for mapping control IDs:

**1. Direct Mapping** (simplest):
```typescript
// Use controller's control ID directly
"ENCODER_1" → "encoder-1"
"FADER_3" → "fader-3"
```

**2. Semantic Mapping** (with plugin info):
```typescript
// Map to plugin parameter names
"ENCODER_1" → "filter-cutoff"
"FADER_3" → "filter-resonance"
```

**3. Index-Based Mapping**:
```typescript
// Generic numbered parameters
"ENCODER_1" → "param-0"
"FADER_3" → "param-8"
```

## Step 3: Register in DeploymentWorkflow

### 3.1 Add Controller Detection

Edit `src/orchestrator/DeploymentWorkflow.ts`:

```typescript
private static async detectController(): Promise<ControllerAdapterInterface> {
  // Try Launch Control XL 3 first
  try {
    const adapter = await LaunchControlXL3Adapter.create();
    if (adapter.isConnected()) {
      return adapter;
    }
  } catch (error) {
    // Controller not found, try next...
  }

  // Add X-Touch detection
  try {
    const adapter = await BehringerXTouchAdapter.create();
    if (adapter.isConnected()) {
      return adapter;
    }
  } catch (error) {
    // Controller not found, try next...
  }

  // Future: Add more controller detection here

  throw new Error(
    'No supported controller detected. Currently supported: Launch Control XL 3, Behringer X-Touch. ' +
      'Ensure your controller is connected and in Custom Mode.',
  );
}
```

### 3.2 Add Converter Mapping

Edit the `getConverterFor()` method:

```typescript
private static getConverterFor(adapter: ControllerAdapterInterface): CanonicalConverterInterface {
  const controllerKey = `${adapter.manufacturer}:${adapter.model}`.toLowerCase();

  // Map controller to converter
  const converterMap: Record<string, () => CanonicalConverterInterface> = {
    'novation:launch control xl 3': () => new LaunchControlXL3Converter(),
    'behringer:x-touch': () => new BehringerXTouchConverter(), // Add this line
    // Future: Add more converters here
  };

  const converterFactory = converterMap[controllerKey];
  if (!converterFactory) {
    throw new Error(
      `No converter available for ${adapter.manufacturer} ${adapter.model}. ` +
        `Supported controllers: ${Object.keys(converterMap).join(', ')}`,
    );
  }

  return converterFactory();
}
```

### 3.3 Update Exports

Edit `src/index.ts` to export your new components:

```typescript
// Adapters
export { BehringerXTouchAdapter, createBehringerXTouchAdapter } from './adapters/controllers/BehringerXTouchAdapter.js';

// Converters
export { BehringerXTouchConverter, createBehringerXTouchConverter } from './converters/BehringerXTouchConverter.js';
```

## Step 4: Testing

### 4.1 Unit Tests

Create test files for your adapter and converter:

```typescript
// src/adapters/controllers/BehringerXTouchAdapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { BehringerXTouchAdapter } from './BehringerXTouchAdapter.js';

describe('BehringerXTouchAdapter', () => {
  let adapter: BehringerXTouchAdapter;

  beforeEach(async () => {
    adapter = await BehringerXTouchAdapter.create();
  });

  it('should have correct manufacturer and model', () => {
    expect(adapter.manufacturer).toBe('Behringer');
    expect(adapter.model).toBe('X-Touch');
  });

  it('should report capabilities', () => {
    expect(adapter.capabilities.maxConfigSlots).toBe(8);
    expect(adapter.capabilities.supportsRead).toBe(true);
    expect(adapter.capabilities.supportsWrite).toBe(true);
  });

  // Add more tests for connect, readConfiguration, etc.
});
```

```typescript
// src/converters/BehringerXTouchConverter.test.ts
import { describe, it, expect } from 'vitest';
import { BehringerXTouchConverter } from './BehringerXTouchConverter.js';
import type { ControllerConfiguration } from '@/types/controller-adapter.js';

describe('BehringerXTouchConverter', () => {
  const converter = new BehringerXTouchConverter();

  it('should convert valid X-Touch configuration', () => {
    const config: ControllerConfiguration = {
      name: 'Test Config',
      controls: [
        { id: 'ENCODER_1', type: 'encoder', cc: 16, channel: 0 },
        { id: 'FADER_1', type: 'slider', cc: 0, channel: 0 },
      ],
    };

    const canonical = converter.convert(config, {});

    expect(canonical.metadata.name).toBe('Test Config');
    expect(canonical.controls).toHaveLength(2);
    expect(canonical.device.manufacturer).toBe('Behringer');
  });

  it('should validate configurations', () => {
    const validConfig: ControllerConfiguration = {
      name: 'Valid',
      controls: [{ id: 'ENCODER_1', type: 'encoder', cc: 16 }],
    };

    expect(converter.canConvert(validConfig)).toBe(true);

    const invalidConfig: ControllerConfiguration = {
      name: 'Invalid',
      controls: [],
    };

    expect(converter.canConvert(invalidConfig)).toBe(false);
  });
});
```

### 4.2 Integration Testing

Test with actual hardware:

```bash
# Build the module
pnpm build

# Test CLI with connected controller
controller-deploy list
controller-deploy deploy --slot 0 --daw ardour --dry-run
```

## Step 5: Documentation

### 5.1 Update README.md

Add your controller to the supported controllers table:

```markdown
| Behringer X-Touch | ✅ Complete | `BehringerXTouchAdapter` | `BehringerXTouchConverter` |
```

### 5.2 Create Example Configurations

Add example YAML files showing your controller's canonical output:

```yaml
# examples/behringer-xtouch-example.yaml
metadata:
  name: "X-Touch Generic"
  version: "1.0.0"
  description: "Behringer X-Touch configuration exported from slot 0"

device:
  manufacturer: "Behringer"
  model: "X-Touch"

controls:
  - id: "encoder-1"
    label: "Encoder 1"
    midi:
      type: "cc"
      channel: 0
      cc: 16
  # ... more controls
```

## Common Pitfalls

### 1. SysEx Timing Issues

**Problem**: SysEx messages might not be received immediately

**Solution**:
```typescript
async function waitForSysExResponse(timeout = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SysEx timeout')), timeout);

    this.device.on('sysex', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}
```

### 2. Control ID Collisions

**Problem**: Multiple controls map to the same canonical ID

**Solution**: Use unique identifiers that include control type and index:
```typescript
const id = `${control.type}-${control.id}-${index}`;
```

### 3. Missing Error Handling

**Problem**: Errors in device communication crash the application

**Solution**: Wrap all device operations in try-catch and provide descriptive errors:
```typescript
try {
  const data = await this.device.readSlot(slot);
  return this.parseData(data);
} catch (error) {
  throw new Error(`Failed to read slot ${slot} from X-Touch: ${error.message}`);
}
```

## Checklist

Before submitting your controller implementation:

- [ ] ControllerAdapterInterface fully implemented
- [ ] CanonicalConverterInterface fully implemented
- [ ] Registered in DeploymentWorkflow
- [ ] Unit tests for adapter (80%+ coverage)
- [ ] Unit tests for converter (80%+ coverage)
- [ ] Integration tests with hardware
- [ ] README.md updated
- [ ] Example configurations added
- [ ] Error handling tested
- [ ] TypeScript compiles with no errors
- [ ] Documentation comments (JSDoc) added

## Getting Help

If you need help implementing support for a new controller:

1. Check existing implementations (LaunchControlXL3Adapter, LaunchControlXL3Converter)
2. Review the interface documentation in [API.md](./API.md)
3. Review the architecture in [ARCHITECTURE.md](./ARCHITECTURE.md)
4. Open a GitHub issue with your questions

## Next Steps

After implementing controller support, consider:

1. **Create a standalone library** for your controller (like `@oletizi/launch-control-xl3`)
2. **Add DAW deployer support** for additional DAWs
3. **Share example configurations** with the community
4. **Contribute back** via pull request

Happy controller hacking!
