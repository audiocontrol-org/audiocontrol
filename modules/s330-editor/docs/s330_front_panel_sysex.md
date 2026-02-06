# Roland S-330 Front Panel Button SysEx Messages

## Overview

The S-330 sends SysEx messages when front-panel buttons are pressed. This is **undocumented** in the official Roland MIDI implementation and was discovered through hardware testing in January 2026.

## Physical Button Layout

The S-330 has the following physical buttons:

**Navigation buttons (D-pad):**
- Up, Down, Left, Right arrows

**Value buttons:**
- Inc (increment) - increases values, acts as "Yes" in boolean contexts
- Dec (decrement) - decreases values, acts as "No" in boolean contexts

**Function buttons:**
- MODE - Opens mode selection (PLAY, EDIT, DISK, FUNC, MIDI, UTIL)
- MENU - Opens context-sensitive submenu
- SUB MENU - Opens sub-menu (context dependent)
- COM (Command) - Opens command menu
- Execute - Confirms/executes selection

**Note:** The screen labels (Dec, Inc, exit, Sel, etc.) shown at the top of the display are clickable areas for the **optional mouse peripheral**, not physical buttons.

## Message Format

All front-panel button messages use the DT1 (Data Set) command:

```
F0 41 [dev] 1E 12 00 04 00 00 [cat] [code] [checksum] F7
```

| Byte | Value | Description |
|------|-------|-------------|
| F0 | - | SysEx Start |
| 41 | - | Roland Manufacturer ID |
| dev | 00-1F | Device ID |
| 1E | - | S-330 Model ID |
| 12 | - | DT1 (Data Set) command |
| 00 04 00 00 | - | Address (UI state area) |
| cat | 01 or 09 | Button category |
| code | varies | Button code |
| checksum | - | Roland checksum |
| F7 | - | SysEx End |

## Address Space

The address `00 04 00 00` is an **undocumented UI state area** not listed in the official S-330 MIDI implementation. This is separate from:
- `00 00 xx xx` - Patch parameters
- `00 01 xx xx` - Function parameters
- `00 02 xx xx` - Tone/MIDI parameters
- `00 03 xx xx` - Tone parameters (used for parameter change broadcasts)

## Button Categories

### Category `09` - Navigation/Value Buttons

These buttons send **two messages**: one on press, one on release.
- Press code: `00-05`
- Release code: Press code + `0x08`

| Button | Press | Release | Notes |
|--------|-------|---------|-------|
| Right Arrow | `09 00` | `09 08` | Cursor right |
| Left Arrow | `09 01` | `09 09` | Cursor left |
| Up Arrow | `09 02` | `09 0A` | Cursor up |
| Down Arrow | `09 03` | `09 0B` | Cursor down |
| Inc | `09 04` | `09 0C` | Increment value / Yes |
| Dec | `09 05` | `09 0D` | Decrement value / No |

### Category `01` - Menu Events and Function Buttons

Category `01` contains two ranges of codes:

#### Menu Navigation Events (`01 00-05`)

When navigation buttons are pressed **within a menu context**, an additional message is sent with category `01` before the normal `09` release message. These codes **mirror the category `09` navigation codes**:

| Event | Code | Data | Notes |
|-------|------|------|-------|
| Menu right | `00` | `01 00` | Cursor right in menu |
| Menu left | `01` | `01 01` | Cursor left in menu |
| Menu up | `02` | `01 02` | Cursor up in menu |
| Menu down | `03` | `01 03` | Cursor down in menu |
| Menu inc | `04` | `01 04` | Increment in menu (unconfirmed) |
| Menu dec | `05` | `01 05` | Decrement in menu (unconfirmed) |

**Note:** These events are sent regardless of whether the navigation has a visible effect. For example, pressing right in a single-column menu still sends `01 00` even though the cursor doesn't move.

**Example sequence for DOWN in MODE menu:**
1. `01 03` - Menu cursor down event
2. `09 0B` - Down arrow release

**Example sequence for RIGHT in EDIT menu (two columns):**
1. `01 00` - Menu cursor right event
2. `09 08` - Right arrow release

#### Function Buttons (`01 0B-0F`)

These buttons send **one message** only (no separate press/release).

| Button | Code | Data | Notes |
|--------|------|------|-------|
| MODE | `0B` | `01 0B` | Opens mode selection menu |
| MENU | `0C` | `01 0C` | Opens context menu |
| SUB MENU | `0D` | `01 0D` | Opens sub-menu (sent even if disabled) |
| COM | `0E` | `01 0E` | Opens command menu |
| Execute | `0F` | `01 0F` | Confirms/executes selection |

**Note:** Function buttons send their code even when disabled or when the action has no effect.

## Example Messages

### Down Arrow Press
```
F0 41 00 1E 12 00 04 00 00 09 03 70 F7
```
Checksum: `128 - ((00+04+00+00+09+03) & 0x7F) = 128 - 16 = 112 = 0x70`

### Down Arrow Release
```
F0 41 00 1E 12 00 04 00 00 09 0B 68 F7
```
Checksum: `128 - ((00+04+00+00+09+0B) & 0x7F) = 128 - 24 = 104 = 0x68`

### MODE Button
```
F0 41 00 1E 12 00 04 00 00 01 0B 70 F7
```

### Execute Button
```
F0 41 00 1E 12 00 04 00 00 01 0F 6C F7
```

### Menu Navigation (DOWN in MODE menu)
```
F0 41 00 1E 12 00 04 00 00 01 03 78 F7  (menu cursor down)
F0 41 00 1E 12 00 04 00 00 09 0B 68 F7  (down arrow release)
```

## Context-Specific Behavior

### Popup Menus vs Parameter Screens

Button behavior differs based on context:

**In popup menus** (MODE menu, EDIT menu, etc.):
- Navigation sends category `01` menu event + category `09` release
- Example: DOWN in MODE menu -> `01 03` then `09 0B`

**In parameter editing screens** (EDIT-LFO, EDIT-TVF, etc.):
- Navigation sends only category `09` press + release (no `01` events)
- Example: RIGHT in LFO screen -> `09 00` then `09 08`

### Parameter Change Broadcasts

When Inc/Dec buttons change a parameter value, the S-330 broadcasts the new value:

**Sequence for INC on LFO Rate parameter:**
1. `09 04` - Inc press (address `00 04 00 00`)
2. **Parameter update** - New value sent to parameter address (e.g., `00 03 04 38`)
3. `09 0C` - Inc release (address `00 04 00 00`)

**Example: LFO Rate changed from 0 to 1:**
```
F0 41 00 1E 12 00 04 00 00 09 04 6F F7  (Inc press)
F0 41 00 1E 12 00 03 04 38 00 01 40 F7  (Rate = 1, tone parameter address)
F0 41 00 1E 12 00 04 00 00 09 0C 67 F7  (Inc release)
```

This enables **real-time parameter monitoring** - a software editor can track changes made on the hardware by watching for DT1 messages to parameter addresses (`00 00 xx xx` for patches, `00 03 xx xx` for tones, etc.).

## Timing

- Navigation buttons (category `09`): ~120-170ms between press and release messages
- Function buttons (category `01`): Single message only
- Menu navigation: `01` event followed by `09` release within ~40ms
- Parameter changes: Value update sent between button press and release (~4ms after press)

## Potential Uses

1. **Remote monitoring**: Track user interactions with the hardware
2. **Automation**: Detect when user changes parameters on hardware
3. **Synchronization**: Keep software editor in sync with hardware state
4. **Macro recording**: Record button sequences for playback

## Remote Control (SUPPORTED!)

**Tested January 2026:** Sending these button messages TO the S-330 **works**! The S-330 accepts DT1 messages to address `00 04 00 00` and responds as if the physical button was pressed.

### Confirmed Working

| Button | Result |
|--------|--------|
| Down | Cursor moves down |
| Up | Cursor moves up |
| Right | Cursor moves right |
| Left | Cursor moves left |
| Inc | Value increments |
| Dec | Value decrements |
| MODE | Opens mode menu |
| MENU | Opens context menu (e.g., EDIT menu) |
| SUB MENU | Opens/closes context-specific submenu (e.g., tone selector) |
| COM | Opens/closes command menu |
| Execute | Confirms/executes selection |
| menu-down | Navigates down in menu context |
| menu-right | Navigates right in menu context |
| menu-left | Navigates left in menu context |
| menu-up | Navigates up in menu context |

### Remote Control Message Format

Send DT1 with press code, wait ~150ms, send release code:

```
# Press DOWN
F0 41 00 1E 12 00 04 00 00 09 03 70 F7

# (wait 150ms)

# Release DOWN
F0 41 00 1E 12 00 04 00 00 09 0B 68 F7
```

### Potential Uses

This enables **full remote control** of the S-330 UI:
- Navigate menus programmatically
- Change parameter values
- Automate repetitive tasks
- Build software editors with bidirectional sync

## Unknown/Untested

The following have not yet been tested:
- Mouse clicks on screen labels (requires optional mouse peripheral)
- Other mode-specific button behaviors

## Hardware Testing Notes

- Tested on Roland S-330 with Device ID 0 (displays as 1)
- Messages captured via Volt 4 MIDI interface
- All tests performed in PLAY-Standard mode unless noted

## References

- [S-330 SysEx Documentation](./s330_sysex.md) - Main protocol documentation
- Roland S-330 Owner's Manual (1987)
