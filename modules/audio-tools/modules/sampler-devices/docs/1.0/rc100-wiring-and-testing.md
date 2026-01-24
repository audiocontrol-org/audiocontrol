# RC-100 Protocol Discovery Tool
## Wiring Guide & Testing Procedure

---

## Hardware Requirements

- Arduino Nano or Uno
- DB-9 Female connector (solder type)
- ~1 meter of multi-conductor cable (or individual wires)
- Soldering iron & solder
- Optional: 100Ω-470Ω resistors for protection (recommended)

---

## Wiring Diagram

```
                            DB-9 FEMALE
                           (Solder Side)
                          ┌───────────┐
                          │ 5 4 3 2 1 │
                          │  ○ ○ ○ ○ ○│
                          │   ○ ○ ○ ○ │
                          │   9 8 7 6 │
                          └───────────┘

    ARDUINO                    DB-9
    ═══════                    ═════

    D2  ◄────────────────────► Pin 8  (Strobe - INPUT from sampler)
    D3  ────[R]──────────────► Pin 1  (Data bit 0 - Up)
    D4  ────[R]──────────────► Pin 2  (Data bit 1 - Down)
    D5  ────[R]──────────────► Pin 3  (Data bit 2 - Left)
    D6  ────[R]──────────────► Pin 4  (Data bit 3 - Right)
    D7  ────[R]──────────────► Pin 6  (Button 1 - Left click)
    D8  ────[R]──────────────► Pin 7  (Button 2 - Right click)
    GND ◄────────────────────► Pin 9  (Ground)

    [R] = Optional 100-470Ω series resistor for protection

    ⚠️  DO NOT CONNECT PIN 5 (+5V) - FUSED, VERY SENSITIVE!
```

### Pin Reference Table

| Arduino Pin | DB-9 Pin | Signal Name | Direction | Function |
|-------------|----------|-------------|-----------|----------|
| D2 | 8 | Strobe/ATN | INPUT | Clock signal from sampler |
| D3 | 1 | Data 0 / Up | OUTPUT | Data nibble bit 0 |
| D4 | 2 | Data 1 / Down | OUTPUT | Data nibble bit 1 |
| D5 | 3 | Data 2 / Left | OUTPUT | Data nibble bit 2 |
| D6 | 4 | Data 3 / Right | OUTPUT | Data nibble bit 3 |
| D7 | 6 | Button 1 | OUTPUT | Left mouse button |
| D8 | 7 | Button 2 | OUTPUT | Right mouse button |
| GND | 9 | Ground | - | Common ground |
| - | 5 | +5V | **DO NOT USE** | Fused power (danger!) |

---

## Sampler Setup

### S-330 Boot Sequence:
1. Power off the sampler
2. Hold the **DOWN ARROW** (▼) button
3. Power on while continuing to hold
4. The boot menu should appear on the monitor
5. Select **"DT-100"** or **"RC-100"** mode (NOT "MOUSE" or "NONE")
6. Press EXECUTE to confirm

### S-550/S-770 Boot Sequence:
1. Power off the sampler
2. Hold numeric key **2** on the front panel
3. Power on while continuing to hold
4. Select external control mode from the menu
5. Choose **DT-100** for RC-100 + mouse support

### Verification:
- You should see the sampler's GUI on the connected monitor
- The cursor should be visible (even if not moving)
- Some samplers show "EXT CTRL" or similar indicator

---

## Testing Procedure

### Step 1: Verify Hardware Connection

1. Upload the sketch to Arduino
2. Open Serial Monitor at **115200 baud**
3. Connect Arduino to sampler's EXT CTRL port
4. Power on sampler in DT-100/RC-100 mode

You should see:
```
========================================
  RC-100 Protocol Discovery Tool v1.0
========================================

Hardware initialized.
IMPORTANT: Set sampler to DT-100 or RC-100 mode!
```

### Step 2: Check Strobe Activity

Type `t` and press Enter to run timing test:

```
> t
Starting timing test (5 seconds)...
Timing results:
  Total strobes: 2500
  Strobes/sec: 500
  Avg interval: 2000 us
  Min interval: 1950 us
  Max interval: 2100 us
```

**Expected results:**
- You SHOULD see strobes (>0)
- Frequency typically 200-1000 Hz for Roland samplers
- If 0 strobes: check wiring, check sampler mode

### Step 3: Test Mouse Movement

Try small movements first:

```
> m 10 0
Mouse: X=10, Y=0
  Nibbles: 0 A 0 0
```

**Watch the monitor** - the cursor should move right!

Try other directions:
```
> m -10 0    (left)
> m 0 10     (down - Y is inverted in MSX)
> m 0 -10    (up)
> m 20 20    (diagonal)
```

### Step 4: Test Button Click

```
> c
Click: PRESS
Click: RELEASE
```

This should act like a mouse click. Try clicking on GUI elements!

### Step 5: Test Button Hold

```
> b 1
Button 1: PRESSED

> b 1
Button 1: RELEASED
```

### Step 6: Experiment with Raw Nibbles

If mouse works, try sending experimental patterns to discover button encoding:

```
> n F000
Raw nibbles (4): F 0 0 0

> n FF00
Raw nibbles (4): F F 0 0

> x 1
Experimental pattern 1:
  Trying 0xFFFF (possible escape)
  Nibbles: F F F F
```

Watch the sampler screen for ANY reaction - button highlights, menu changes, etc.

---

## Discovery Methodology

### Phase 1: Confirm Basic Protocol
1. Verify strobes are being received (timing test)
2. Confirm mouse movement works
3. Confirm mouse buttons work
4. Document exact timing characteristics

### Phase 2: Button Discovery
The RC-100 has ~37 buttons. To discover the encoding:

1. **Try escape sequences**: Many protocols use 0xF or 0xFF as escape codes
   ```
   > n F001
   > n F002
   > n F003
   ...
   ```

2. **Try extended nibble counts**: RC-100 might send 6 or 8 nibbles instead of 4
   ```
   > n 00000001
   > n 00000002
   ```

3. **Try high-bit patterns**: Button data might use bit 7 as a flag
   ```
   > n 8001
   > n 8002
   ```

4. **Try trackball-style encoding**: Some devices use offset encoding
   ```
   > n 8888    (neutral)
   > n 8988    (button 1?)
   ```

### Phase 3: Systematic Scan
Once you find a working pattern, systematically scan for all buttons:

```python
# Pseudo-code for systematic scan
for button_code in range(0, 64):
    send_pattern(0xF0 | (button_code >> 4), button_code & 0x0F, 0, 0)
    wait(500ms)
    observe_sampler_screen()
    log_result()
```

---

## Troubleshooting

### No Strobes Detected
- Check Pin 8 (strobe) connection
- Verify sampler is in DT-100/RC-100 mode (not MOUSE or NONE)
- Try booting sampler with cable already connected
- Check ground connection

### Cursor Drifts to Corner
- This is the "Roland polling" issue
- The code already includes the fix (DDRD |= 0x78)
- If still drifting, try adding small delay in ISR

### Cursor Moves Wrong Direction
- X/Y might be swapped or inverted
- Try: `m -10 0` instead of `m 10 0`
- MSX Y-axis is typically inverted from modern conventions

### Erratic Movement
- Check for loose connections
- Add series resistors if not present
- Verify ground is solid

### No Response to Buttons
- Button pins might need to be active-low (pull to ground)
- Try toggling the logic: change HIGH to LOW in the code
- Some samplers might need the cursor over a clickable element

---

## Data Logging

When you discover something interesting, document it:

```
FINDING: Pattern 0xF001 triggers WAVE button highlight
  - Nibbles sent: F 0 0 1
  - Sampler model: S-330
  - Firmware version: 2.00
  - Observed behavior: WAVE button on screen becomes highlighted
  - Reproducible: Yes
```

---

## Next Steps After Discovery

Once you've mapped the button encodings:

1. **Document the encoding table** - map each nibble pattern to its function
2. **Update the Arduino sketch** - add named button functions
3. **Create web interface** - send commands via serial from your web app
4. **Share findings** - help others with Roland samplers!

---

## Safety Notes

⚠️ **NEVER connect Pin 5 (+5V)** - The PICO fuse is extremely sensitive and expensive to replace

⚠️ **Use series resistors** - Protects both Arduino and sampler from accidental shorts

⚠️ **Don't hot-plug** - Connect/disconnect with sampler powered off when possible

⚠️ **Ground first** - Always ensure ground is connected before other signals
