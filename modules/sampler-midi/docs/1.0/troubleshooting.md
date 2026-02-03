## Troubleshooting

### No MIDI Ports Found

**Problem**: `getInputs()` or `getOutputs()` returns empty arrays.

**Solutions**:

1. Ensure MIDI devices are connected and powered on
2. Check operating system MIDI settings
3. On macOS, verify Audio MIDI Setup recognizes devices
4. On Linux, check ALSA MIDI connections: `aconnect -l`
5. Try running with elevated permissions (some systems require it)

### SysEx Messages Not Received

**Problem**: SysEx listener not firing.

**Solutions**:

1. Enable SysEx in config: `await midiSystem.start({ enableSysex: true })`
2. Check if device sends SysEx (some devices need configuration)
3. Verify device is on correct MIDI channel
4. Enable debug mode: `await midiSystem.start({ debug: true })`

### Port Already in Use

**Problem**: Error when opening MIDI port.

**Solutions**:

1. Close other applications using the MIDI port
2. Call `stop()` on previous MidiSystem instance
3. Check for zombie processes holding the port
4. Restart the MIDI device

### Akai S3000XL Not Responding

**Problem**: Device methods timeout or fail.

**Solutions**:

1. Verify MIDI cables (In/Out correctly connected)
2. Check Akai's MIDI channel setting (default: channel 0)
3. Enable SysEx transmission in Akai's MIDI settings
4. Verify device ID (default: 0x48)
5. Try sending simple status request: `device.send(0x00, [])`

### TypeScript Errors After Migration

**Problem**: Type errors after upgrading to v7.x.

**Solutions**:

1. Import `EasyMidiBackend` explicitly
2. Remove `createMidiSystem` imports (no longer exists)
3. Update to TypeScript 5.7+ for best compatibility
4. Check that `@types/node` is installed
5. Run `pnpm install` to update dependencies

### Virtual Ports Not Working

**Problem**: Virtual ports fail to create.

**Solutions**:

1. Virtual ports only work on macOS and Linux (not Windows)
2. Check if another app already has a virtual port with same name
3. Use unique names for virtual ports
4. Verify permissions for creating virtual MIDI devices

## Testing

This package uses Vitest for testing with comprehensive test coverage.

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Run unit tests only
pnpm test:unit
```

### Writing Tests with Mock Backend

```typescript
import {describe, it, expect} from 'vitest';
import {MidiSystem, MidiBackend, MidiPortInfo, RawMidiInput, RawMidiOutput} from '@audiocontrol/sampler-midi';

class TestMidiBackend implements MidiBackend {
    getInputs(): MidiPortInfo[] {
        return [{name: 'Test Input'}];
    }

    getOutputs(): MidiPortInfo[] {
        return [{name: 'Test Output'}];
    }

    createInput(name: string): RawMidiInput {
        return {
            on: vi.fn(),
            removeListener: vi.fn(),
            close: vi.fn()
        };
    }

    createOutput(name: string): RawMidiOutput {
        return {
            send: vi.fn(),
            close: vi.fn()
        };
    }
}

describe('MidiSystem', () => {
    it('should list available ports', async () => {
        const backend = new TestMidiBackend();
        const system = new MidiSystem(backend);

        await system.start();

        expect(system.getInputs()).toHaveLength(1);
        expect(system.getOutputs()).toHaveLength(1);
    });
});
```

## Contributing
