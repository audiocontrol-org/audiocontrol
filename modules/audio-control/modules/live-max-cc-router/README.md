# CC Router - TypeScript for Max for Live

A TypeScript-based CC router for Launch Control XL3 that compiles to JavaScript for Max for Live. This gives you the
benefits of TypeScript development (types, IntelliSense, refactoring) while producing Max-compatible JavaScript.

## Features

- ✅ **TypeScript Development** - Full type safety and IntelliSense
- ✅ **Auto-compilation** - TypeScript compiles to Max-compatible JavaScript
- ✅ **Live Reload** - File watching for instant updates
- ✅ **Track-Aware Routing** - CC messages only affect the selected track
- ✅ **Plugin Presets** - Built-in mappings for common Ableton devices
- ✅ **Debug Mode** - Detailed logging for development
- ✅ **No External Dependencies** - Pure Max for Live integration

## Quick Start

### 1. Setup

```bash
npm install
npm run setup
```

### 2. Development

```bash
npm run dev    # Start TypeScript watch mode with notifications
```

### 3. Use in Max for Live

1. Open Max for Live
2. Navigate to your Max projects folder
3. Open `cc-router/patchers/cc-router.maxpat`
4. Save as an Audio Effect in your Live set
5. Connect Launch Control XL3 and start mapping!

## Architecture

```
TypeScript Source → Compiled JavaScript → Max for Live → Ableton Live
     (src/)            (dist/)           (js object)    (parameters)
```

## Project Structure

```
cc-router/
├── src/
│   ├── types.ts              # TypeScript definitions
│   ├── cc-router.ts          # Core routing logic
│   └── max-integration.ts    # Max for Live interface
├── dist/                     # Compiled JavaScript
├── scripts/
│   ├── setup.js             # Initial setup
│   └── deploy.js            # Deploy to Max for Live
└── package.json             # Dependencies and scripts
```

## Default Mappings (Launch Control XL3)

| Control | CC Number | Parameter Index | Description       |
|---------|-----------|-----------------|-------------------|
| Knob 1  | CC 13     | Parameter 0     | Device 0, Param 0 |
| Knob 2  | CC 14     | Parameter 1     | Device 0, Param 1 |
| Knob 3  | CC 15     | Parameter 2     | Device 0, Param 2 |
| Knob 4  | CC 16     | Parameter 3     | Device 0, Param 3 |
| Knob 5  | CC 17     | Parameter 4     | Device 0, Param 4 |
| Knob 6  | CC 18     | Parameter 5     | Device 0, Param 5 |
| Knob 7  | CC 19     | Parameter 6     | Device 0, Param 6 |
| Knob 8  | CC 20     | Parameter 7     | Device 0, Param 7 |

## Available Commands (in Max Console)

### Basic Usage

- `loadbang` - Initialize the router
- `help` - Show all available commands
- `config` - Display current configuration
- `trackinfo` - Show selected track and devices

### Mapping Management

- `setmapping <cc> <device> <param> [name] [curve]` - Add/update mapping
- `removemapping <cc>` - Remove a mapping
- `setupfor <plugin>` - Load preset for specific plugin

### Testing & Debug

- `debug <0|1>` - Toggle debug mode
- `testcc <cc> <value>` - Test a specific CC message
- `bang` - Show track info

### Plugin Presets

- `setupfor eq8` - EQ Eight with frequency/gain controls
- `setupfor compressor` - Compressor with threshold/ratio/attack/release
- `setupfor reverb` - Reverb with decay/room size/dry-wet
- `setupfor operator` - Operator with oscillator levels and filter

## Development Workflow

### 1. Edit TypeScript Files

```bash
# Start watch mode
npm run dev

# Edit files in src/
code src/cc-router.ts
```

### 2. Auto-Compilation

- Files automatically compile to `dist/`
- Notifications show compilation status
- Max device picks up changes via `@autowatch 1`

### 3. Test in Max for Live

- Reload js object if needed
- Use debug commands to test functionality
- Send MIDI CC messages to verify routing

### 4. Deploy Updates

```bash
npm run deploy  # Copy latest compiled JS to Max projects
```

## Value Transformation

### Curves

- **Linear**: Direct 1:1 mapping (default)
- **Exponential**: Squared response (more precision at low values)
- **Logarithmic**: Square root response (more precision at high values)

### Custom Ranges

Set min/max values in parameter mappings:

```javascript
setmapping
13
0
1
"Filter Freq"
exponential
0.2
0.8
// CC 13 now maps from 20% to 80% of parameter range
```

## Advanced Usage

### Custom Plugin Integration

1. **Discover parameters:**
   ```
   trackinfo  # Shows devices and parameter counts
   ```

2. **Create mappings:**
   ```
   setmapping 13 0 5 "Custom Param" linear
   ```

3. **Save configuration:**
    - Mappings persist within the Max object
    - Export/import via TypeScript code

### Multiple Device Support

Map different CC ranges to different devices:

```javascript
// Device 0 (first in chain)
setmapping
13
0
0
"Device 1 Param 1"
setmapping
14
0
1
"Device 1 Param 2"

// Device 1 (second in chain)  
setmapping
21
1
0
"Device 2 Param 1"
setmapping
22
1
1
"Device 2 Param 2"
```

## TypeScript Benefits

### Type Safety

```typescript
interface ParameterMapping {
    ccNumber: number;
    deviceIndex: number;
    parameterIndex: number;
    parameterName: string;
    curve: 'linear' | 'exponential' | 'logarithmic';
}
```

### IntelliSense

- Auto-completion for Live API calls
- Parameter hints and documentation
- Compile-time error checking

### Refactoring

- Safe renaming across files
- Find all references
- Automated code transformations

## Scripts

```bash
npm run build      # Compile TypeScript to JavaScript
npm run watch      # Auto-compile on file changes  
npm run dev        # Watch mode with notifications
npm run deploy     # Deploy compiled JS to Max for Live
npm run setup      # Initial project setup
npm run clean      # Clean dist folder
```

## Troubleshooting

### TypeScript Compilation Errors

- Check `tsconfig.json` configuration
- Ensure proper type definitions in `src/types.ts`
- Run `npm run build` to see detailed errors

### Max for Live Integration Issues

- Verify `@autowatch 1` in js object
- Check Max console for JavaScript errors
- Reload js object after compilation
- Ensure file paths are correct

### MIDI Routing Problems

- Use `debug 1` to enable verbose logging
- Check track selection with `trackinfo`
- Verify device/parameter indices exist
- Test with `testcc` command

### Launch Control XL3 Setup

- Use custom mode (not DAW control)
- Verify CC numbers 13-20 for top knobs
- Check MIDI channel (default: channel 1)
- Test with external MIDI monitor first

## Acknowledgements

This project uses [ioRouting.js](https://github.com/h1data/M4L-ioRouting-js) by [h1data](https://github.com/h1data) to enable MIDI input routing on audio tracks. The MIDI routing approach was inspired by the MidiRouter Max for Live device.

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Edit TypeScript files in `src/`
4. Test with `npm run dev`
5. Submit pull request

## License

MIT License - see LICENSE file for details
