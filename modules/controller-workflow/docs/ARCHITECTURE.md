# Controller Workflow Architecture

This document provides a comprehensive overview of the controller-workflow module's architecture, design patterns, and implementation details.

## System Overview

The controller-workflow module implements a universal framework for reading MIDI controller configurations and deploying them to multiple DAW formats. It follows a clean, interface-driven architecture with three distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────┐          ┌────────────────────┐          │
│  │     CLI      │          │  Library API       │          │
│  │  (Commander) │          │  (DeploymentWorkflow)│        │
│  └──────────────┘          └────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Orchestration Layer                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │          DeploymentWorkflow                         │    │
│  │  - Auto-detection                                   │    │
│  │  - Progress events (EventEmitter)                   │    │
│  │  - Error aggregation                                │    │
│  │  - YAML serialization                               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Adapter Layer                           │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │   Controller     │  │    Canonical     │  │   DAW    │ │
│  │    Adapters      │  │   Converters     │  │ Deployers│ │
│  │                  │  │                  │  │          │ │
│  │ - LCXL3Adapter   │  │ - LCXL3Converter │  │ - Ardour │ │
│  │ - (future...)    │  │ - (future...)    │  │ - (fut.) │ │
│  └──────────────────┘  └──────────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Hardware/Filesystem                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  MIDI Device │  │  Canonical   │  │  DAW Config  │     │
│  │   (USB)      │  │  YAML Files  │  │  Directory   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Core Interfaces

The architecture is built around three primary interfaces that define clear contracts:

### ControllerAdapterInterface

**Purpose**: Provides uniform access to MIDI controller hardware

**Responsibilities**:
- Establish USB/MIDI connection to controller
- Query device metadata (manufacturer, model, firmware)
- List available configuration slots
- Read controller-specific configuration data
- Write configurations back to controller (optional)

**Key Methods**:
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

  // Device info
  getDeviceInfo(): Promise<DeviceInfo>;
}
```

**Data Flow**:
```
Controller Hardware
        │
        │ SysEx/MIDI
        ▼
ControllerAdapterInterface
        │
        │ ControllerConfiguration (generic format)
        ▼
Orchestrator
```

### CanonicalConverterInterface

**Purpose**: Convert controller-specific formats to canonical MIDI maps

**Responsibilities**:
- Validate controller configurations
- Map controller-specific control IDs to canonical format
- Preserve or generate human-readable labels
- Apply MIDI channel and plugin metadata
- Generate compliant canonical MIDI maps

**Key Methods**:
```typescript
interface CanonicalConverterInterface {
  // Conversion
  convert(
    config: ControllerConfiguration,
    options: ConversionOptions
  ): CanonicalMidiMap;

  // Validation
  canConvert(config: ControllerConfiguration): boolean;

  // Metadata
  getConverterInfo(): ConverterInfo;
}
```

**Data Flow**:
```
ControllerConfiguration
        │
        │ Controller-specific data
        ▼
CanonicalConverterInterface
        │
        │ CanonicalMidiMap (YAML-serializable)
        ▼
Orchestrator / YAML File
```

### DAWDeployerInterface

**Purpose**: Deploy canonical MIDI maps to DAW-specific formats

**Responsibilities**:
- Convert canonical format to DAW-specific format (XML, JSON, scripts)
- Locate DAW configuration directories (platform-specific)
- Write DAW configuration files
- Optionally install to DAW directories
- Validate DAW installation status

**Key Methods**:
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

**Data Flow**:
```
CanonicalMidiMap
        │
        │ Generic MIDI mapping
        ▼
DAWDeployerInterface
        │
        │ DAW-specific format (XML, JSON, etc.)
        ▼
DAW Config Directory
```

## Orchestration Layer

### DeploymentWorkflow Class

The `DeploymentWorkflow` class is the central orchestrator that coordinates the entire workflow.

**Design Pattern**: Facade + Template Method

**Event-Driven Architecture**:
```typescript
class DeploymentWorkflow extends EventEmitter {
  // Events emitted:
  // - 'progress': ProgressEvent (step, message, data)
  // - 'canonical-saved': CanonicalSavedEvent (path, map)
  // - 'error': Error
}
```

**Workflow Steps**:

1. **Read Controller Configuration**
   - Auto-detect or use provided controller adapter
   - Connect to hardware via USB/MIDI
   - Read configuration from specified slot
   - Emit progress: "Reading configuration from controller..."

2. **Convert to Canonical Format**
   - Select appropriate converter for controller
   - Apply conversion options (plugin, MIDI channel, labels)
   - Validate canonical map
   - Emit progress: "Converting to canonical MIDI map format..."

3. **Save Canonical YAML** (optional)
   - Serialize canonical map to YAML
   - Write to output directory
   - Emit event: 'canonical-saved'
   - Emit progress: "Canonical YAML saved to {path}"

4. **Deploy to DAWs**
   - For each target DAW:
     - Get or create DAW deployer
     - Convert canonical → DAW format
     - Write to output path or install to DAW directory
     - Aggregate results and errors
   - Emit progress: "Deploying to {DAW}..."

**Error Handling Strategy**:
- Non-fatal errors: Aggregate in `errors` array, continue workflow
- Fatal errors: Catch in execute(), return failed result
- All errors are logged to progress events
- Result object contains both success status and error details

## Data Flow

### Complete Workflow Data Flow

```
┌─────────────────────┐
│ Controller Hardware │
│  (Launch Control)   │
└──────────┬──────────┘
           │
           │ 1. readConfiguration(slot)
           │
           ▼
┌───────────────────────────────┐
│  ControllerConfiguration      │
│  {                             │
│    name: "TAL-Filter",        │
│    controls: [                │
│      {id: "SEND_A1", cc: 13}, │
│      {id: "FADER1", cc: 77}   │
│    ]                           │
│  }                             │
└──────────┬────────────────────┘
           │
           │ 2. convert(config, options)
           │
           ▼
┌───────────────────────────────┐
│  CanonicalMidiMap             │
│  {                             │
│    metadata: {...},           │
│    device: {...},             │
│    plugin: {...},             │
│    controls: [                │
│      {id: "filter-cutoff",    │
│       midi: {cc: 13, ...}},   │
│      {id: "filter-resonance", │
│       midi: {cc: 77, ...}}    │
│    ]                           │
│  }                             │
└──────────┬────────────────────┘
           │
           │ 3a. serializeToYAML()
           │
           ▼
┌───────────────────────────────┐
│  canonical-map.yaml           │
│  (Saved to disk)              │
└───────────────────────────────┘
           │
           │ 3b. deploy(canonicalMap)
           │
           ▼
┌───────────────────────────────┐
│  DAW-Specific Format          │
│  (e.g., Ardour XML)           │
│  <?xml version="1.0"?>        │
│  <ArdourMIDIBindings>         │
│    <Binding cc="13" .../>     │
│    <Binding cc="77" .../>     │
│  </ArdourMIDIBindings>        │
└──────────┬────────────────────┘
           │
           │ 4. install to DAW directory
           │
           ▼
┌───────────────────────────────┐
│  ~/.config/ardour8/midi_maps/ │
│  tal-filter.map               │
└───────────────────────────────┘
```

## Component Details

### Controller Adapters

#### LaunchControlXL3Adapter

**Implementation**: Uses `@oletizi/launch-control-xl3` library

**Key Features**:
- USB device detection and connection
- SysEx message parsing for configuration data
- Support for 16 configuration slots
- Read/write capabilities
- Device metadata retrieval

**Configuration Format**:
```typescript
{
  name: "User Config Name",
  controls: [
    { id: "SEND_A1", type: "encoder", cc: 13, channel: 0 },
    { id: "FADER1", type: "slider", cc: 77, channel: 0 },
    // ... more controls
  ],
  metadata: {
    slotIndex: 0,
    // controller-specific data
  }
}
```

### Canonical Converters

#### LaunchControlXL3Converter

**Conversion Strategy**:
1. Extract control mappings from LCXL3 configuration
2. Map LCXL3 control IDs to canonical control IDs
3. Apply user-provided plugin information
4. Generate device metadata
5. Set MIDI channel (default or override)
6. Preserve or generate control labels

**Control ID Mapping**:
```typescript
// LCXL3 → Canonical
"SEND_A1" → "param-0" (or custom label if plugin info provided)
"SEND_A2" → "param-1"
"FADER1" → "param-8"
// etc.
```

### DAW Deployers

#### ArdourDeployer

**Implementation**: Uses `@oletizi/ardour-midi-maps` library

**Key Features**:
- Canonical → Ardour XML format conversion
- Platform-specific config directory detection:
  - macOS: `~/.config/ardour{version}/midi_maps/`
  - Linux: `~/.config/ardour{version}/midi_maps/`
  - Windows: `%LOCALAPPDATA%\ardour{version}\midi_maps\`
- Ardour version detection
- Validation of Ardour installation

**Output Format**: Ardour MIDI Map XML
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ArdourMIDIBindings version="1.0.0">
  <DeviceInfo bank-size="16"/>
  <Binding channel="0" ctl="13" uri="/route/plugin/parameter B1 1 1"/>
  <Binding channel="0" ctl="77" uri="/route/plugin/parameter B1 1 2"/>
</ArdourMIDIBindings>
```

## Design Patterns

### 1. Adapter Pattern

**Purpose**: Wrap diverse controller hardware APIs with a uniform interface

**Benefits**:
- Controllers can be added without changing orchestration layer
- Controllers can be mocked/stubbed for testing
- Clear separation between controller specifics and workflow logic

### 2. Strategy Pattern

**Purpose**: Encapsulate conversion algorithms (CanonicalConverterInterface)

**Benefits**:
- Each controller has its own conversion strategy
- Converters are easily testable in isolation
- New converters can be added without affecting existing code

### 3. Facade Pattern

**Purpose**: DeploymentWorkflow provides simplified API for complex multi-step process

**Benefits**:
- Hides complexity of adapter coordination
- Provides single entry point for workflow
- Simplifies error handling and progress tracking

### 4. Factory Method

**Purpose**: `DeploymentWorkflow.create()` factory for object creation

**Benefits**:
- Auto-detection logic encapsulated
- Easier to test with dependency injection
- Backward compatibility via factory function

### 5. Dependency Injection

**Purpose**: All components receive dependencies via constructor

**Benefits**:
- Highly testable (inject mocks)
- Follows interface-first design
- No hardcoded dependencies

**Example**:
```typescript
// Production
const workflow = await DeploymentWorkflow.create({
  targets: ['ardour']
});

// Testing
const workflow = new DeploymentWorkflow(
  mockControllerAdapter,
  mockConverter,
  new Map([['ardour', mockDeployer]])
);
```

## Extension Points

### Adding a New Controller

1. **Implement ControllerAdapterInterface**
   - Handle controller-specific USB/MIDI communication
   - Parse controller's configuration format
   - Implement connection lifecycle

2. **Implement CanonicalConverterInterface**
   - Define control ID mapping strategy
   - Implement validation logic
   - Handle controller-specific quirks

3. **Register in DeploymentWorkflow**
   - Add detection logic to `detectController()`
   - Add converter mapping to `getConverterFor()`

### Adding a New DAW

1. **Implement DAWDeployerInterface**
   - Research DAW's MIDI configuration format
   - Implement canonical → DAW conversion
   - Handle platform-specific paths
   - Implement installation logic

2. **Register Deployer**
   - Add to deployer registry (future)
   - Currently: pass via `CreateOptions.deployers`

## Performance Considerations

### Memory

- Configurations loaded on-demand (not cached)
- YAML serialization is streaming-compatible
- No large in-memory buffers

### Latency

- Controller communication: ~100-500ms (USB/SysEx overhead)
- Conversion: <10ms (pure transformation)
- File I/O: <50ms (small files)
- Total workflow: ~1-2 seconds

### Concurrency

- DeploymentWorkflow is NOT thread-safe
- Each instance owns a single controller connection
- Multiple workflows can run in parallel (different controllers)

## Security Considerations

### File System Access

- Output paths are user-provided (validate/sanitize)
- DAW config directories are read-only checked before write
- No arbitrary code execution

### USB Device Access

- Only known device IDs are accessed
- SysEx messages are parsed with validation
- No raw device buffer exposure

### Input Validation

- Slot numbers validated (0-15 range)
- MIDI channels validated (0-15 range)
- File paths sanitized for filesystem safety

## Testing Strategy

### Unit Tests

- Each interface has mock implementations
- Converters tested with fixture configurations
- Deployers tested with mock filesystem
- No actual hardware required

### Integration Tests

- End-to-end workflow with mock adapters
- Event emission verification
- Error aggregation testing

### Manual Testing

- Actual controller hardware
- Real DAW installations
- Platform-specific paths

## Future Enhancements

### Planned Features

1. **Deployer Registry**
   - Dynamic deployer discovery
   - Plugin-based architecture

2. **Bidirectional Sync**
   - Read existing DAW configs
   - Convert DAW → Canonical → Controller

3. **Multi-Controller Support**
   - Deploy single canonical map to multiple controllers
   - Controller profile management

4. **Configuration Templates**
   - Pre-built templates for common plugins
   - Community template sharing

5. **Live MIDI Monitoring**
   - Real-time control change monitoring
   - Live preview before deployment

## Conclusion

The controller-workflow architecture is designed for:

- **Extensibility**: Easy to add new controllers and DAWs
- **Testability**: Interface-driven with dependency injection
- **Maintainability**: Clear separation of concerns
- **Usability**: Simple API hiding complex orchestration

The interface-first design ensures that the system can grow to support many controllers and DAWs without structural changes to the core architecture.
