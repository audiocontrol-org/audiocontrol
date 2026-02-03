# API Reference

Complete API documentation for the controller-workflow module.

## Table of Contents

- [Core Interfaces](#core-interfaces)
  - [ControllerAdapterInterface](#controlleradapterinterface)
  - [CanonicalConverterInterface](#canonicalconverterinterface)
  - [DAWDeployerInterface](#dawdeployerinterface)
- [Orchestration](#orchestration)
  - [DeploymentWorkflow](#deploymentworkflow)
- [Type Definitions](#type-definitions)
- [CLI Commands](#cli-commands)

## Core Interfaces

### ControllerAdapterInterface

Provides uniform access to MIDI controller hardware.

**Import:**
```typescript
import type { ControllerAdapterInterface } from '@oletizi/controller-workflow';
```

**Definition:**
```typescript
interface ControllerAdapterInterface {
  // Metadata
  readonly manufacturer: string;
  readonly model: string;
  readonly capabilities: ControllerCapabilities;

  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Configuration access
  listConfigurations(): Promise<ConfigurationSlot[]>;
  readConfiguration(slot: number): Promise<ControllerConfiguration>;
  writeConfiguration?(slot: number, config: ControllerConfiguration): Promise<void>;

  // Device information
  getDeviceInfo(): Promise<DeviceInfo>;
}
```

#### Properties

**`manufacturer`** (readonly string)

Controller manufacturer name (e.g., "Novation", "Behringer").

**`model`** (readonly string)

Controller model name (e.g., "Launch Control XL 3", "X-Touch").

**`capabilities`** (readonly [ControllerCapabilities](#controllercapabilities))

Describes the controller's feature set and limitations.

#### Methods

**`connect(): Promise<void>`**

Establish connection to the controller hardware.

- **Throws**: Error if controller is not found or connection fails
- **Note**: Safe to call multiple times (idempotent)

**Example:**
```typescript
const adapter = await LaunchControlXL3Adapter.create();
await adapter.connect();
```

---

**`disconnect(): Promise<void>`**

Close connection to the controller hardware.

- **Note**: Safe to call when already disconnected (idempotent)

**Example:**
```typescript
await adapter.disconnect();
```

---

**`isConnected(): boolean`**

Check if currently connected to controller.

- **Returns**: `true` if connected, `false` otherwise

**Example:**
```typescript
if (!adapter.isConnected()) {
  await adapter.connect();
}
```

---

**`listConfigurations(): Promise<ConfigurationSlot[]>`**

List all configuration slots available on the controller.

- **Returns**: Array of [ConfigurationSlot](#configurationslot) objects
- **Throws**: Error if not connected or communication fails

**Example:**
```typescript
const slots = await adapter.listConfigurations();
for (const slot of slots) {
  console.log(`Slot ${slot.index}: ${slot.name || '(empty)'}`);
}
```

---

**`readConfiguration(slot: number): Promise<ControllerConfiguration>`**

Read a configuration from the specified slot.

- **Parameters**:
  - `slot` (number): Slot index (0 to maxConfigSlots - 1)
- **Returns**: [ControllerConfiguration](#controllerconfiguration) object
- **Throws**: Error if slot is invalid, empty, or read fails

**Example:**
```typescript
const config = await adapter.readConfiguration(0);
console.log(`Config name: ${config.name}`);
console.log(`Controls: ${config.controls.length}`);
```

---

**`writeConfiguration?(slot: number, config: ControllerConfiguration): Promise<void>`** (optional)

Write a configuration to the specified slot.

- **Parameters**:
  - `slot` (number): Slot index (0 to maxConfigSlots - 1)
  - `config` ([ControllerConfiguration](#controllerconfiguration)): Configuration to write
- **Throws**: Error if slot is invalid or write fails
- **Note**: Optional - not all controllers support writing

**Example:**
```typescript
if (adapter.writeConfiguration) {
  await adapter.writeConfiguration(1, modifiedConfig);
}
```

---

**`getDeviceInfo(): Promise<DeviceInfo>`**

Retrieve device metadata and firmware information.

- **Returns**: [DeviceInfo](#deviceinfo) object
- **Throws**: Error if not connected or query fails

**Example:**
```typescript
const info = await adapter.getDeviceInfo();
console.log(`${info.manufacturer} ${info.model} v${info.firmwareVersion}`);
```

---

### CanonicalConverterInterface

Converts controller-specific configurations to canonical MIDI maps.

**Import:**
```typescript
import type { CanonicalConverterInterface } from '@oletizi/controller-workflow';
```

**Definition:**
```typescript
interface CanonicalConverterInterface {
  convert(
    config: ControllerConfiguration,
    options: ConversionOptions
  ): CanonicalMidiMap;

  canConvert(config: ControllerConfiguration): boolean;

  getConverterInfo(): ConverterInfo;
}
```

#### Methods

**`convert(config: ControllerConfiguration, options: ConversionOptions): CanonicalMidiMap`**

Convert a controller configuration to canonical MIDI map format.

- **Parameters**:
  - `config` ([ControllerConfiguration](#controllerconfiguration)): Controller configuration to convert
  - `options` ([ConversionOptions](#conversionoptions)): Conversion options (plugin info, MIDI channel, etc.)
- **Returns**: [CanonicalMidiMap](https://github.com/oletizi/canonical-midi-maps) object
- **Throws**: Error if conversion fails or config is invalid

**Example:**
```typescript
const converter = new LaunchControlXL3Converter();
const canonical = converter.convert(config, {
  pluginInfo: {
    manufacturer: 'TAL',
    name: 'TAL-Filter',
  },
  midiChannel: 0,
  preserveLabels: true,
});
```

---

**`canConvert(config: ControllerConfiguration): boolean`**

Validate that a configuration can be converted.

- **Parameters**:
  - `config` ([ControllerConfiguration](#controllerconfiguration)): Configuration to validate
- **Returns**: `true` if conversion is possible, `false` otherwise

**Example:**
```typescript
if (converter.canConvert(config)) {
  const canonical = converter.convert(config, {});
} else {
  console.error('Invalid configuration');
}
```

---

**`getConverterInfo(): ConverterInfo`**

Get metadata about this converter.

- **Returns**: [ConverterInfo](#converterinfo) object

**Example:**
```typescript
const info = converter.getConverterInfo();
console.log(`Converter: ${info.supportedController} v${info.version}`);
console.log(`Features: ${info.features.join(', ')}`);
```

---

### DAWDeployerInterface

Deploys canonical MIDI maps to DAW-specific formats.

**Import:**
```typescript
import type { DAWDeployerInterface } from '@oletizi/controller-workflow';
```

**Definition:**
```typescript
interface DAWDeployerInterface {
  // Metadata
  readonly dawName: string;
  readonly version: string;

  // Deployment
  deploy(
    canonicalMap: CanonicalMidiMap,
    options: DeploymentOptions
  ): Promise<DeploymentResult>;

  // Platform queries
  isInstalled(): Promise<boolean>;
  getConfigDirectory(): Promise<string>;
}
```

#### Properties

**`dawName`** (readonly string)

Name of the DAW (e.g., "Ardour", "Ableton Live").

**`version`** (readonly string)

DAW version this deployer targets (e.g., "8.0", "11.0").

#### Methods

**`deploy(canonicalMap: CanonicalMidiMap, options: DeploymentOptions): Promise<DeploymentResult>`**

Deploy a canonical MIDI map to this DAW's format.

- **Parameters**:
  - `canonicalMap` ([CanonicalMidiMap](https://github.com/oletizi/canonical-midi-maps)): Map to deploy
  - `options` ([DeploymentOptions](#deploymentoptions)): Deployment options
- **Returns**: [DeploymentResult](#deploymentresult) object
- **Throws**: Error if deployment fails critically

**Example:**
```typescript
const deployer = ArdourDeployer.create();
const result = await deployer.deploy(canonicalMap, {
  autoInstall: true,
  outputPath: './output/my-map.map',
});

if (result.success) {
  console.log(`Deployed to ${result.outputPath}`);
}
```

---

**`isInstalled(): Promise<boolean>`**

Check if this DAW is installed on the system.

- **Returns**: `true` if DAW is installed and accessible, `false` otherwise

**Example:**
```typescript
if (await deployer.isInstalled()) {
  console.log('Ardour is installed');
}
```

---

**`getConfigDirectory(): Promise<string>`**

Get the configuration directory for this DAW.

- **Returns**: Absolute path to DAW configuration directory
- **Throws**: Error if DAW is not installed or path cannot be determined

**Example:**
```typescript
const configDir = await deployer.getConfigDirectory();
console.log(`Ardour config: ${configDir}`);
// Output: /Users/username/.config/ardour8/midi_maps/
```

---

## Orchestration

### DeploymentWorkflow

Main orchestrator for the complete controller → DAW workflow.

**Import:**
```typescript
import { DeploymentWorkflow } from '@oletizi/controller-workflow';
```

**Class Definition:**
```typescript
class DeploymentWorkflow extends EventEmitter {
  static create(options: CreateOptions): Promise<DeploymentWorkflow>;
  execute(options: WorkflowOptions): Promise<WorkflowResult>;
  cleanup(): Promise<void>;

  // EventEmitter events:
  // - 'progress': (event: ProgressEvent) => void
  // - 'canonical-saved': (event: CanonicalSavedEvent) => void
  // - 'error': (error: Error) => void
}
```

#### Static Methods

**`DeploymentWorkflow.create(options: CreateOptions): Promise<DeploymentWorkflow>`**

Create a new DeploymentWorkflow with auto-detection and defaults.

- **Parameters**:
  - `options` ([CreateOptions](#createoptions)): Creation options
- **Returns**: Configured DeploymentWorkflow instance
- **Throws**: Error if no controller detected or deployer creation fails

**Example:**
```typescript
const workflow = await DeploymentWorkflow.create({
  targets: ['ardour']
});
```

With custom adapters:
```typescript
const workflow = await DeploymentWorkflow.create({
  controllerAdapter: customAdapter,
  targets: ['ardour'],
  deployers: new Map([['ardour', customArdourDeployer]]),
});
```

---

#### Instance Methods

**`execute(options: WorkflowOptions): Promise<WorkflowResult>`**

Execute the complete workflow: read → convert → save → deploy.

- **Parameters**:
  - `options` ([WorkflowOptions](#workflowoptions)): Workflow execution options
- **Returns**: [WorkflowResult](#workflowresult) object with complete execution details

**Example:**
```typescript
const result = await workflow.execute({
  configSlot: 0,
  targets: ['ardour'],
  pluginInfo: {
    manufacturer: 'TAL',
    name: 'TAL-Filter',
  },
  preserveLabels: true,
  outputDir: './output',
  autoInstall: true,
});

if (result.success) {
  console.log('Deployment successful!');
  console.log(`Canonical YAML: ${result.canonicalPath}`);
  for (const deployment of result.deployments) {
    console.log(`${deployment.dawName}: ${deployment.outputPath}`);
  }
} else {
  console.error('Deployment failed:');
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
}
```

---

**`cleanup(): Promise<void>`**

Disconnect from controller and clean up resources.

- **Note**: Always call this when done to release controller connection

**Example:**
```typescript
try {
  const result = await workflow.execute({ ... });
} finally {
  await workflow.cleanup();
}
```

---

#### Events

**`'progress'` Event**

Emitted throughout workflow execution with progress updates.

- **Payload**: [ProgressEvent](#progressevent)

**Example:**
```typescript
workflow.on('progress', ({ step, message, data }) => {
  console.log(`[${step}/4] ${message}`);
  if (data) {
    console.log('  Data:', data);
  }
});
```

---

**`'canonical-saved'` Event**

Emitted when canonical YAML is successfully saved.

- **Payload**: [CanonicalSavedEvent](#canonicalsavedevent)

**Example:**
```typescript
workflow.on('canonical-saved', ({ path, map }) => {
  console.log(`Canonical saved: ${path}`);
  console.log(`Controls: ${map.controls.length}`);
});
```

---

**`'error'` Event**

Emitted on workflow errors.

- **Payload**: Error object

**Example:**
```typescript
workflow.on('error', (error) => {
  console.error('Workflow error:', error.message);
});
```

---

## Type Definitions

### ControllerCapabilities

Describes the capabilities of a MIDI controller.

```typescript
interface ControllerCapabilities {
  supportsCustomModes: boolean;
  maxConfigSlots: number;
  supportsRead: boolean;
  supportsWrite: boolean;
  supportedControlTypes: ControlType[];
}
```

**Fields:**
- `supportsCustomModes`: Whether controller supports custom mode programming
- `maxConfigSlots`: Maximum number of configuration slots (typically 8-16)
- `supportsRead`: Whether configurations can be read from device
- `supportsWrite`: Whether configurations can be written to device
- `supportedControlTypes`: Array of supported control types

---

### ControllerConfiguration

Generic controller configuration format.

```typescript
interface ControllerConfiguration {
  name: string;
  controls: ControlMapping[];
  metadata?: Record<string, unknown>;
}
```

**Fields:**
- `name`: Human-readable configuration name
- `controls`: Array of control mappings
- `metadata`: Optional controller-specific metadata

---

### ConfigurationSlot

Represents a configuration slot on the controller.

```typescript
interface ConfigurationSlot {
  index: number;
  name?: string;
  isEmpty: boolean;
}
```

**Fields:**
- `index`: Zero-based slot index
- `name`: Optional user-defined slot name
- `isEmpty`: Whether this slot contains a configuration

---

### ControlMapping

Represents a single control mapping.

```typescript
interface ControlMapping {
  id: string;
  name?: string;
  type: ControlType;
  cc?: number;
  channel?: number;
  range?: [number, number];
}
```

**Fields:**
- `id`: Unique identifier for this control (e.g., "SEND_A1", "FADER1")
- `name`: Optional human-readable control name
- `type`: Type of control (see [ControlType](#controltype))
- `cc`: MIDI CC number for this control
- `channel`: MIDI channel (0-15)
- `range`: Value range [min, max]

---

### ControlType

Types of MIDI controls supported.

```typescript
type ControlType = 'encoder' | 'slider' | 'button' | 'button_group';
```

---

### DeviceInfo

Device information retrieved from the controller.

```typescript
interface DeviceInfo {
  manufacturer: string;
  model: string;
  firmwareVersion?: string;
}
```

---

### ConversionOptions

Options for controlling the conversion process.

```typescript
interface ConversionOptions {
  pluginInfo?: PluginDefinition;
  midiChannel?: number;
  preserveLabels?: boolean;
  deviceOverrides?: Partial<DeviceDefinition>;
}
```

**Fields:**
- `pluginInfo`: Plugin information to include in canonical map
- `midiChannel`: MIDI channel override (0-15)
- `preserveLabels`: Whether to preserve controller-specific control labels
- `deviceOverrides`: Device definition overrides

---

### ConverterInfo

Metadata about a converter implementation.

```typescript
interface ConverterInfo {
  supportedController: string;
  version: string;
  features: string[];
}
```

---

### DeploymentOptions

Options for controlling the deployment process.

```typescript
interface DeploymentOptions {
  autoInstall?: boolean;
  outputPath?: string;
  dryRun?: boolean;
}
```

**Fields:**
- `autoInstall`: Whether to automatically install to DAW config directory
- `outputPath`: Custom output path (overrides default)
- `dryRun`: Preview deployment without writing files

---

### DeploymentResult

Result of a deployment operation.

```typescript
interface DeploymentResult {
  success: boolean;
  dawName?: string;
  outputPath?: string;
  installed?: boolean;
  errors?: string[];
}
```

**Fields:**
- `success`: Whether deployment succeeded
- `dawName`: Name of the DAW deployed to
- `outputPath`: Path where configuration was written
- `installed`: Whether configuration was installed to DAW directory
- `errors`: List of errors that occurred during deployment

---

### CreateOptions

Options for creating a DeploymentWorkflow instance.

```typescript
interface CreateOptions {
  controllerAdapter?: ControllerAdapterInterface;
  targets: string[];
  deployers?: Map<string, DAWDeployerInterface>;
}
```

**Fields:**
- `controllerAdapter`: Optional pre-configured controller adapter (auto-detect if omitted)
- `targets`: Target DAW names (e.g., ['ardour', 'live'])
- `deployers`: Optional pre-configured DAW deployers

---

### WorkflowOptions

Options for workflow execution.

```typescript
interface WorkflowOptions {
  configSlot: number;
  targets: string[];
  pluginInfo?: PluginDefinition;
  midiChannel?: number;
  preserveLabels?: boolean;
  outputDir?: string;
  autoInstall?: boolean;
  dryRun?: boolean;
}
```

**Fields:**
- `configSlot`: Configuration slot to read from controller (0-15)
- `targets`: Target DAW names for deployment
- `pluginInfo`: Optional plugin information
- `midiChannel`: Optional MIDI channel override (0-15)
- `preserveLabels`: Whether to preserve controller-specific labels
- `outputDir`: Output directory for canonical YAML and DAW configs
- `autoInstall`: Whether to auto-install configs to DAW directories
- `dryRun`: Preview mode - don't write any files

---

### WorkflowResult

Complete workflow execution result.

```typescript
interface WorkflowResult {
  success: boolean;
  controllerConfig?: ControllerConfiguration;
  canonicalMap?: CanonicalMidiMap;
  canonicalPath?: string;
  deployments: DeploymentResult[];
  errors: string[];
}
```

**Fields:**
- `success`: Whether the entire workflow succeeded
- `controllerConfig`: Controller configuration read from device
- `canonicalMap`: Canonical MIDI map generated from controller config
- `canonicalPath`: Path where canonical YAML was saved
- `deployments`: Results from each DAW deployment
- `errors`: Accumulated error messages

---

### ProgressEvent

Progress event emitted during workflow execution.

```typescript
interface ProgressEvent {
  step: number;
  message: string;
  data?: unknown;
}
```

**Fields:**
- `step`: Current step number (1-4)
- `message`: Human-readable progress message
- `data`: Optional data associated with this step

---

### CanonicalSavedEvent

Event emitted when canonical YAML is written.

```typescript
interface CanonicalSavedEvent {
  path: string;
  map: CanonicalMidiMap;
}
```

**Fields:**
- `path`: Path where canonical YAML was saved
- `map`: The canonical MIDI map that was saved

---

## CLI Commands

### `controller-deploy list`

List all configuration slots on the connected controller.

**Usage:**
```bash
controller-deploy list
```

**Example Output:**
```
🎛️  Controller: Novation Launch Control XL 3

Configuration Slots:
──────────────────────────────────────────────────
  ● Slot 00: TAL-Filter
  ● Slot 01: Dexed
  ○ Slot 02: (empty)
  ...
──────────────────────────────────────────────────

Total slots: 16
```

---

### `controller-deploy deploy`

Deploy controller configuration to DAW formats.

**Usage:**
```bash
controller-deploy deploy [options]
```

**Options:**
- `-c, --controller <type>` - Controller type (auto-detect if omitted)
- `-s, --slot <number>` - Configuration slot number (default: 0)
- `-d, --daw <daws...>` - Target DAWs (default: ['ardour'])
- `-p, --plugin <name>` - Plugin name for parameter mapping
- `-m, --midi-channel <number>` - MIDI channel override (0-15)
- `-o, --output <dir>` - Output directory (default: './output')
- `--install` - Auto-install to DAW config directories
- `--dry-run` - Preview deployment without writing files

**Examples:**

Basic deployment:
```bash
controller-deploy deploy --slot 0 --daw ardour
```

With plugin name and auto-install:
```bash
controller-deploy deploy -s 2 -d ardour -p "TAL-Filter" --install
```

Multiple DAWs:
```bash
controller-deploy deploy -s 0 -d ardour live --install
```

Dry run:
```bash
controller-deploy deploy -s 0 -d ardour --dry-run
```

---

## Factory Functions

### `createDeploymentWorkflow(options: CreateOptions): Promise<DeploymentWorkflow>`

Factory function for creating DeploymentWorkflow instances.

**Import:**
```typescript
import { createDeploymentWorkflow } from '@oletizi/controller-workflow';
```

**Usage:**
```typescript
const workflow = await createDeploymentWorkflow({
  targets: ['ardour']
});
```

This is equivalent to `DeploymentWorkflow.create()` and provided for backward compatibility.

---

## Error Handling

All methods follow these error handling conventions:

1. **Throw descriptive errors** - No fallbacks or mock data
2. **Error messages include context** - What failed, why, and how to fix
3. **Async methods reject with Error objects** - Never return error codes
4. **Workflow aggregates errors** - Non-fatal errors collected in result

**Example Error Messages:**
```
Error: No supported controller detected. Currently supported: Launch Control XL 3.
       Ensure your controller is connected and in Custom Mode.

Error: Invalid slot 20. Must be between 0 and 15.

Error: Failed to read slot 5 from Launch Control XL 3: Device disconnected
```

---

## TypeScript Usage

All types are exported and can be imported individually:

```typescript
import type {
  ControllerAdapterInterface,
  CanonicalConverterInterface,
  DAWDeployerInterface,
  ControllerConfiguration,
  ControlMapping,
  WorkflowOptions,
  WorkflowResult,
} from '@oletizi/controller-workflow';
```

The module is built with TypeScript strict mode enabled for maximum type safety.
