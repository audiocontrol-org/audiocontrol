# SysEx Protocol Comparison

## Known Working Messages from Web Editor

### 1. Custom Mode Write to Slot 1
When writing "TestVolume1" to encoder 1 in slot 1:
```
0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x15 0x00 0x06 0xf7
```

Breaking down:
- `0xf0` - SysEx start
- `0x00 0x20 0x29` - Novation manufacturer ID
- `0x02 0x15` - Device/model identifiers
- `0x05` - Command (write?)
- `0x00` - Unknown
- `0x15` - Unknown (21 decimal)
- `0x00` - Slot index (0 = slot 1)
- `0x06` - Unknown (possibly data length or checksum?)
- `0xf7` - SysEx end

### 2. Another Write Operation
```
0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x15 0x03 0x06 0xf7
```

Similar structure but:
- `0x03` instead of `0x00` at position 9 (slot 4?)

### 3. Longer Custom Mode Data
From earlier capture:
```
0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x10 0x03 0x06 0x20 0x10 0x44 0x65 0x66 0x61 0x75 0x6c 0x74 0x20 0x43 0x75 0x73 0x74 0x6f 0x6d 0x20 0x4d 0x21 0x00 ... 0xf7
```

This appears to be a complete custom mode with:
- Similar header: `0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00`
- `0x10` instead of `0x15` at position 8
- `0x03` - slot index
- `0x06` - unknown
- Followed by mode data including ASCII text "Default Custom M"

## Our SysExParser Implementation

Our parser generates a COMPLETELY DIFFERENT format:

### What Our Parser Generates:
```
0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x45 0x00 ... [1000+ bytes of data] ... 0xf7
```

- **Length**: 1049 bytes (!!!)
- **Structure**: Full data dump with all control definitions, labels, and colors
- **Header**: `0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x45`
- **Content**: Includes definitions for ALL 48 controls, even if not used

### Key Differences:

| Position | Web Editor | Our Parser | Meaning |
|----------|------------|------------|---------|
| 0-7      | Same       | Same       | Standard header |
| 8        | 0x15       | 0x45       | Command type |
| 9        | Slot       | Slot       | Slot number |
| 10       | 0x06       | Data...    | Web: end marker, Ours: start of data |
| 11       | 0xf7       | Data...    | Web: SysEx end, Ours: more data |

## The Core Problem

**We're using the WRONG PROTOCOL!**

1. **Web Editor Protocol**: Sends simple 12-byte "commands" that likely trigger the device to use preset configurations
2. **Our Protocol**: Tries to send a complete custom mode data dump (1000+ bytes)

The web editor messages appear to be:
- **Commands to activate/select modes** rather than data transfers
- **Reference existing configurations** by slot number
- **Do not contain actual control mappings** in the message itself

## Hypothesis

The short messages from the web editor (e.g., `0xf0...0x15 0x00 0x06 0xf7`) are likely:
1. **Mode activation commands** - "Switch to custom mode in slot X"
2. **Configuration references** - "Use preset configuration Y"
3. **Not data writes at all** - The actual data may be pre-configured or sent differently

This explains why our 1000+ byte messages don't work - we're trying to use a data transfer protocol when the device expects simple command messages.