/**
 * Custom Adapter Example
 *
 * This example demonstrates how to create a custom controller adapter
 * and converter for a hypothetical "MyController" MIDI device.
 *
 * Use this as a template when adding support for a new controller.
 *
 * @module controller-workflow/examples
 */

import type {
  ControllerAdapterInterface,
  ControllerCapabilities,
  ControllerConfiguration,
  ConfigurationSlot,
  DeviceInfo,
  ControlMapping,
  CanonicalConverterInterface,
  ConversionOptions,
  ConverterInfo,
} from '../src/index.js';
import type { CanonicalMidiMap, DeviceDefinition, PluginDefinition, ControlDefinition } from '@audiocontrol/canonical-midi-maps';
import { DeploymentWorkflow } from '../src/index.js';

// ============================================================================
// Step 1: Implement ControllerAdapterInterface
// ============================================================================

/**
 * Example adapter for a hypothetical "MyController" MIDI device
 */
class MyControllerAdapter implements ControllerAdapterInterface {
  // Define controller metadata
  readonly manufacturer = 'MyCompany';
  readonly model = 'MyController Pro';
  readonly capabilities: ControllerCapabilities = {
    supportsCustomModes: true,
    maxConfigSlots: 8,
    supportsRead: true,
    supportsWrite: true,
    supportedControlTypes: ['encoder', 'slider', 'button'],
  };

  // Internal state
  private connected = false;
  private mockConfigs: Map<number, ControllerConfiguration>;

  private constructor() {
    // Initialize with mock data for demonstration
    this.mockConfigs = new Map();
    this.mockConfigs.set(0, {
      name: 'Demo Configuration',
      controls: [
        { id: 'KNOB_1', type: 'encoder', cc: 1, channel: 0 },
        { id: 'KNOB_2', type: 'encoder', cc: 2, channel: 0 },
        { id: 'FADER_1', type: 'slider', cc: 7, channel: 0 },
        { id: 'FADER_2', type: 'slider', cc: 8, channel: 0 },
        { id: 'BUTTON_1', type: 'button', cc: 16, channel: 0 },
      ],
    });
  }

  /**
   * Factory method for creating the adapter
   */
  static async create(): Promise<MyControllerAdapter> {
    const adapter = new MyControllerAdapter();
    // In a real implementation, you might:
    // - Search for USB device
    // - Verify device is accessible
    // - Initialize device communication
    return adapter;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // In a real implementation, you would:
    // 1. Open USB/MIDI device connection
    // 2. Send handshake/initialization commands
    // 3. Verify device is responsive
    console.log('Connecting to MyController...');

    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.connected = true;
    console.log('Connected successfully');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // In a real implementation, you would:
    // 1. Send disconnect/cleanup commands
    // 2. Close device connection
    console.log('Disconnecting from MyController...');

    this.connected = false;
    console.log('Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listConfigurations(): Promise<ConfigurationSlot[]> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    // In a real implementation, you would:
    // 1. Query device for slot information
    // 2. Parse slot metadata (name, empty status)
    const slots: ConfigurationSlot[] = [];

    for (let i = 0; i < this.capabilities.maxConfigSlots; i++) {
      const hasConfig = this.mockConfigs.has(i);
      slots.push({
        index: i,
        name: hasConfig ? this.mockConfigs.get(i)!.name : undefined,
        isEmpty: !hasConfig,
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

    // In a real implementation, you would:
    // 1. Send SysEx/MIDI command to request config
    // 2. Wait for and parse response
    // 3. Convert device-specific format to ControllerConfiguration
    const config = this.mockConfigs.get(slot);

    if (!config) {
      throw new Error(`Slot ${slot} is empty`);
    }

    console.log(`Read configuration "${config.name}" from slot ${slot}`);
    return config;
  }

  async writeConfiguration(slot: number, config: ControllerConfiguration): Promise<void> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    if (slot < 0 || slot >= this.capabilities.maxConfigSlots) {
      throw new Error(`Invalid slot ${slot}. Must be between 0 and ${this.capabilities.maxConfigSlots - 1}`);
    }

    // In a real implementation, you would:
    // 1. Convert ControllerConfiguration to device-specific format
    // 2. Send SysEx/MIDI write command
    // 3. Verify write success
    console.log(`Writing configuration "${config.name}" to slot ${slot}`);
    this.mockConfigs.set(slot, config);
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.connected) {
      throw new Error('Controller not connected');
    }

    // In a real implementation, you would:
    // 1. Query device for firmware version
    // 2. Get device serial number or other metadata
    return {
      manufacturer: this.manufacturer,
      model: this.model,
      firmwareVersion: '1.0.0',
    };
  }
}

// ============================================================================
// Step 2: Implement CanonicalConverterInterface
// ============================================================================

/**
 * Example converter for MyController configurations
 */
class MyControllerConverter implements CanonicalConverterInterface {
  convert(config: ControllerConfiguration, options: ConversionOptions): CanonicalMidiMap {
    if (!this.canConvert(config)) {
      throw new Error('Invalid MyController configuration - cannot convert');
    }

    // Build device definition
    const device: DeviceDefinition = {
      manufacturer: 'MyCompany',
      model: 'MyController Pro',
      ...(options.deviceOverrides || {}),
    };

    // Use plugin info if provided
    const plugin: PluginDefinition | undefined = options.pluginInfo;

    // Convert controls to canonical format
    const controls: ControlDefinition[] = config.controls.map((control, index) => {
      // Generate canonical control ID
      const controlId = this.generateControlId(control, index, plugin);

      // Generate label
      const name = this.generateLabel(control, options.preserveLabels);

      return {
        id: controlId,
        name,
        type: control.type,
        cc: control.cc!,
        channel: options.midiChannel ?? control.channel ?? 0,
        range: control.range ?? [0, 127],
      };
    });

    // Build canonical map
    return {
      version: '1.0.0',
      metadata: {
        name: config.name,
        description: `MyController configuration`,
      },
      device,
      ...(plugin && { plugin }),
      controls,
    };
  }

  canConvert(config: ControllerConfiguration): boolean {
    // Validate configuration has required fields
    if (!config || !config.controls || config.controls.length === 0) {
      return false;
    }

    // Validate all controls have required fields
    return config.controls.every(
      (control) => control.id && control.type && (control.cc !== undefined || control.type === 'button_group')
    );
  }

  getConverterInfo(): ConverterInfo {
    return {
      supportedController: 'MyCompany MyController Pro',
      version: '1.0.0',
      features: ['Encoder mapping', 'Fader mapping', 'Button mapping', 'Plugin parameter mapping'],
    };
  }

  // Helper methods

  private generateControlId(control: ControlMapping, index: number, plugin?: PluginDefinition): string {
    if (plugin) {
      // Generate semantic ID based on plugin
      return `${plugin.name.toLowerCase().replace(/\s+/g, '-')}-param-${index}`;
    }

    // Use controller's control ID
    return control.id.toLowerCase().replace(/_/g, '-');
  }

  private generateLabel(control: ControlMapping, preserveLabels?: boolean): string {
    if (preserveLabels && control.name) {
      return control.name;
    }

    // Generate from control ID
    return control.id.replace(/_/g, ' ');
  }
}

// ============================================================================
// Step 3: Use Custom Adapter and Converter
// ============================================================================

/**
 * Demonstrate using a custom adapter and converter
 */
async function demonstrateCustomAdapter(): Promise<void> {
  console.log('Custom Adapter Example\n');

  // Create custom adapter and converter
  const customAdapter = await MyControllerAdapter.create();
  const customConverter = new MyControllerConverter();

  // Create workflow with custom components
  const workflow = await DeploymentWorkflow.create({
    controllerAdapter: customAdapter,
    targets: [], // No deployers for this demo
  });

  try {
    // Add progress monitoring
    workflow.on('progress', ({ step, message }) => {
      console.log(`[${step}/4] ${message}`);
    });

    workflow.on('canonical-saved', ({ path }) => {
      console.log(`\n✅ Canonical YAML saved to: ${path}`);
    });

    // Execute workflow
    const result = await workflow.execute({
      configSlot: 0,
      targets: [], // Don't deploy to any DAWs
      preserveLabels: true,
      outputDir: './output',
    });

    if (result.success) {
      console.log('\n✅ Workflow completed successfully');
      console.log(`   Controller: ${result.controllerConfig?.name}`);
      console.log(`   Controls: ${result.controllerConfig?.controls.length}`);
      console.log(`   Canonical: ${result.canonicalPath}`);
    } else {
      console.error('\n❌ Workflow failed:', result.errors);
    }
  } finally {
    await workflow.cleanup();
  }
}

/**
 * Demonstrate testing the converter independently
 */
function demonstrateConverterTesting(): void {
  console.log('\nConverter Testing Example\n');

  const converter = new MyControllerConverter();

  // Test configuration
  const testConfig: ControllerConfiguration = {
    name: 'Test Config',
    controls: [
      { id: 'KNOB_1', type: 'encoder', cc: 1, channel: 0 },
      { id: 'FADER_1', type: 'slider', cc: 7, channel: 0 },
    ],
  };

  // Test validation
  console.log('Testing validation:');
  console.log(`  Valid config: ${converter.canConvert(testConfig)}`);
  console.log(`  Invalid config: ${converter.canConvert({ name: 'Bad', controls: [] })}`);

  // Test conversion
  console.log('\nTesting conversion:');
  const canonical = converter.convert(testConfig, {
    pluginInfo: {
      manufacturer: 'TAL',
      name: 'TAL-Filter',
    },
    midiChannel: 0,
    preserveLabels: true,
  });

  console.log(`  Name: ${canonical.metadata.name}`);
  console.log(`  Device: ${canonical.device.manufacturer} ${canonical.device.model}`);
  console.log(`  Plugin: ${canonical.plugin?.name}`);
  console.log(`  Controls: ${canonical.controls.length}`);
  canonical.controls.forEach((control) => {
    console.log(`    - ${control.id} (${control.name}): CC ${control.cc} on channel ${control.channel}`);
  });

  // Get converter info
  console.log('\nConverter info:');
  const info = converter.getConverterInfo();
  console.log(`  Controller: ${info.supportedController}`);
  console.log(`  Version: ${info.version}`);
  console.log(`  Features: ${info.features.join(', ')}`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const mode = process.argv[2] || 'workflow';

  switch (mode) {
    case 'workflow':
      await demonstrateCustomAdapter();
      break;
    case 'converter':
      demonstrateConverterTesting();
      break;
    default:
      console.log('Usage: ts-node custom-adapter-example.ts [workflow|converter]');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Mock adapter factory for unit tests
 */
export function createMockAdapter(configs: Map<number, ControllerConfiguration>): ControllerAdapterInterface {
  let connected = false;

  return {
    manufacturer: 'Mock',
    model: 'Test Controller',
    capabilities: {
      supportsCustomModes: true,
      maxConfigSlots: 8,
      supportsRead: true,
      supportsWrite: true,
      supportedControlTypes: ['encoder', 'slider', 'button'],
    },

    async connect() {
      connected = true;
    },

    async disconnect() {
      connected = false;
    },

    isConnected() {
      return connected;
    },

    async listConfigurations() {
      const slots: ConfigurationSlot[] = [];
      for (let i = 0; i < 8; i++) {
        slots.push({
          index: i,
          isEmpty: !configs.has(i),
        });
      }
      return slots;
    },

    async readConfiguration(slot: number) {
      const config = configs.get(slot);
      if (!config) {
        throw new Error(`Slot ${slot} is empty`);
      }
      return config;
    },

    async writeConfiguration(slot: number, config: ControllerConfiguration) {
      configs.set(slot, config);
    },

    async getDeviceInfo() {
      return {
        manufacturer: 'Mock',
        model: 'Test Controller',
        firmwareVersion: '1.0.0',
      };
    },
  };
}
