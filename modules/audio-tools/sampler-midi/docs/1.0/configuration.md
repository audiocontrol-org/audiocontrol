## Configuration

### MidiConfig

Configuration options for the MIDI system.

```typescript
interface MidiConfig {
    enableSysex?: boolean;  // Enable SysEx message handling (default: true)
    debug?: boolean;        // Enable debug logging (default: false)
}
```

### Port Selection

By default, `start()` auto-selects the first available input and output ports. To use specific ports:

```typescript
await midiSystem.start();

// Manually select specific ports
midiSystem.setInput('My MIDI Controller');
midiSystem.setOutput('Hardware Synth');
```

### Virtual Ports

Create virtual MIDI ports (macOS/Linux):

```typescript
const backend = new EasyMidiBackend();
const virtualInput = backend.createInput('My Virtual Input', true);
const virtualOutput = backend.createOutput('My Virtual Output', true);
```

## Examples
