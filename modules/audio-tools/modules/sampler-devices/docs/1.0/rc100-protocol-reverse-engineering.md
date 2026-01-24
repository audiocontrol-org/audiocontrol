# RC-100 Protocol Reverse Engineering
## Based on December 1987 Service Manual Schematic

---

## 1. Circuit Diagram Signal Tracing

### DB-9 EXT CONTROLLER Connector (CN1)

Looking at the schematic (coordinates D-E, columns 1-4), the D-SUB 9PIN connector shows the following signal names:

From the schematic labeling at CN1:
```
Pin 1: MX1 (DAT1)    → Through FL1  → To CPU
Pin 2: MX2 (DAT)     → Through FL2  → To CPU
Pin 3: MX3 (GND)     → Ground
Pin 4: MX4 (CLK)     → Through FL4  → To CPU (likely strobe)
Pin 5: MX5 (+5V)     → Fused +5V supply
Pin 6: MX6           → Through FL6  → From CPU (data output)
Pin 7: MX7           → Through FL7  → From CPU (data output)
Pin 8: MX8 (ATN)     → Through FL8  → To CPU (attention/strobe)
Pin 9: MX9           → Ground/Shield
```

The FL1-FL18 components are EMI filters (ferrite beads) protecting the signals.

---

## 2. 80C31 Microcontroller (IC14) Port Analysis

The M5M80C31RS (Mitsubishi version of Intel 80C31) has 4 ports:

### Standard 80C31 Pinout (40-pin DIP):
```
Port 0 (P0.0-P0.7): Pins 32-39 - Multiplexed Address/Data bus
Port 1 (P1.0-P1.7): Pins 1-8   - General purpose I/O
Port 2 (P2.0-P2.7): Pins 21-28 - High address bus (A8-A15)
Port 3 (P3.0-P3.7): Pins 10-17 - Special functions + I/O
```

### Port 3 Special Functions (Critical for protocol):
```
P3.0 (Pin 10): RXD  - Serial receive
P3.1 (Pin 11): TXD  - Serial transmit
P3.2 (Pin 12): INT0 - External Interrupt 0 ← LIKELY STROBE INPUT
P3.3 (Pin 13): INT1 - External Interrupt 1
P3.4 (Pin 14): T0   - Timer 0 external input
P3.5 (Pin 15): T1   - Timer 1 external input
P3.6 (Pin 16): WR   - External write strobe
P3.7 (Pin 17): RD   - External read strobe
```

### Key Insight: Interrupt-Driven Strobe Response

The MSX mouse protocol requires responding to strobe signal edges. The 80C31's INT0 (P3.2) is ideal for this because:
- Hardware interrupt for immediate response
- Edge-triggered (configurable rising/falling)
- Allows fast response time (<1µs with proper code)

**Hypothesis**: DB-9 Pin 8 (ATN/Strobe) → FL8 → P3.2 (INT0)

---

## 3. Memory Architecture

### External ROM (IC13): M5M27C128 or LH5764-20
- 16KB (128Kbit) EPROM
- Contains RC-100 firmware
- Address lines A0-A12 from CPU
- Data lines D0-D7 to P0 (multiplexed with address)

### Address Latch (IC12): 74HC373
- Latches low address byte (A0-A7) from P0
- Controlled by ALE signal from CPU

### Support Logic:
- IC11: 74HC04 (Hex inverter)
- IC15: 74HC00 (Quad NAND)
- IC42: SN 82C100UP (Unknown function - possibly bus interface)

---

## 4. Gate Array (IC2): M60063A-0175P

This is a **custom Roland gate array** that handles button matrix scanning. From the schematic:

### Inputs:
- Button matrix connections from SW1-SW37
- Timing signals from 74HC393 counter (IC1)
- Data bus connection to CPU

### Outputs:
- Encoded button data to CPU
- LED driver signals to the 14-LED display

### Function Analysis:
The gate array likely:
1. Scans the button matrix in a round-robin fashion
2. Detects button press/release events
3. Encodes button identity as a numeric value
4. Signals the CPU when a button state changes

The 74HC393 dual 4-bit counter provides:
- Column select signals (4 bits = 16 columns max)
- Row timing (4 bits = 16 rows max)
- Matrix capacity: up to 256 buttons (only ~37 used)

---

## 5. Button Matrix Analysis

From the Control Board Assembly section, I can see:

### Button Groups (approximately):
```
SW1-SW9:   Numeric keypad (0-9, with SW10 being something else)
SW10-SW19: Function buttons (LOOP, WAVE, PATCH, etc.)
SW20-SW29: Mode/selection buttons
SW30-SW37: Navigation and special functions
```

### Matrix Organization:
Looking at the wiring pattern:
- Approximately 6 columns × 7 rows = 42 positions
- 37 buttons used, 5 positions unused

### Alpha Dial:
The large rotary encoder (shown bottom right of Control Board) is likely:
- Quadrature encoder (A/B outputs)
- Connected to Timer inputs (T0/T1) on P3.4/P3.5
- Provides continuous rotation sensing

---

## 6. Protocol Hypothesis

Based on the circuit analysis, here's my hypothesis for how the RC-100 protocol works:

### Mouse Data Mode (Standard MSX):
When only mouse movements are being sent:
```
Strobe LOW  → P1.0-P1.3 outputs X high nibble
Strobe HIGH → P1.0-P1.3 outputs X low nibble
Strobe LOW  → P1.0-P1.3 outputs Y high nibble
Strobe HIGH → P1.0-P1.3 outputs Y low nibble
```

### Button Data Mode (Extended Protocol):
When a button is pressed, the RC-100 likely:

**Option A: Special Escape Sequence**
```
Nibble 1: 0xF (escape code - never valid mouse data)
Nibble 2: Button number high nibble
Nibble 3: Button number low nibble
Nibble 4: Button state (0=released, 1=pressed)
```

**Option B: Separate Data Lines**
The MX6 and MX7 lines might carry:
- Button press indicator
- Button number encoding
While MX1-MX4 carry mouse data

**Option C: Time-Division Multiplexing**
Alternating between mouse data frames and button data frames
based on internal timing or button activity detection.

---

## 7. Critical Timing Parameters

### MSX Standard Timing:
- Strobe frequency: ~50Hz (20ms period)
- Nibble read time: ~100µs per nibble
- Complete mouse read: ~400µs

### Roland Modification (Known Issue):
Roland samplers poll MUCH faster than standard MSX. This is why:
- Standard MSX mouse code causes cursor drift
- The JoyHigh() fix is required
- Pins must be actively driven, not floated

**Estimated Roland Timing:**
- Strobe frequency: Possibly 200-500Hz
- Much tighter timing requirements
- Requires interrupt-driven response

---

## 8. Firmware Behavior (Hypothetical)

Based on 80C31 architecture, the RC-100 firmware likely:

### Initialization:
```assembly
; Enable INT0 interrupt (strobe detection)
SETB EX0      ; Enable External Interrupt 0
SETB IT0      ; Edge-triggered mode
SETB EA       ; Enable all interrupts
```

### Main Loop:
```assembly
MAIN:
    ; Scan button matrix via gate array
    CALL SCAN_BUTTONS
    ; Read alpha dial encoder
    CALL READ_ENCODER
    ; Update internal mouse position
    CALL UPDATE_MOUSE
    ; Loop
    SJMP MAIN
```

### INT0 ISR (Strobe Handler):
```assembly
INT0_ISR:
    ; Determine which nibble to output (0-3)
    ; Based on strobe count modulo 4

    ; Output appropriate nibble to Port 1
    MOV P1, current_nibble

    ; Increment nibble counter
    INC nibble_count
    ANL nibble_count, #03h  ; Wrap at 4

    RETI
```

---

## 9. Proposed Emulation Strategy

### Hardware Setup:
```
Arduino Pin Assignments:
D2 (INT0) ← DB-9 Pin 8 (Strobe) - Interrupt input
D3        → DB-9 Pin 1 (Data bit 0)
D4        → DB-9 Pin 2 (Data bit 1)
D5        → DB-9 Pin 3 (Data bit 2)
D6        → DB-9 Pin 4 (Data bit 3)
D7        → DB-9 Pin 6 (Button 1/Left click)
D8        → DB-9 Pin 7 (Button 2/Right click)
GND       → DB-9 Pin 9 (Ground)
```

### Software Architecture:
```cpp
volatile uint8_t nibbleCount = 0;
volatile int8_t mouseX = 0;
volatile int8_t mouseY = 0;
volatile uint8_t buttonData = 0;

void setup() {
    // Configure data pins as outputs
    DDRD |= 0x78;  // D3-D6 as outputs
    DDRB |= 0x03;  // D8-D9 as outputs

    // Attach strobe interrupt
    attachInterrupt(digitalPinToInterrupt(2), strobeISR, CHANGE);
}

void strobeISR() {
    uint8_t nibble;

    switch(nibbleCount) {
        case 0: nibble = (mouseX >> 4) & 0x0F; break;
        case 1: nibble = mouseX & 0x0F; break;
        case 2: nibble = (mouseY >> 4) & 0x0F; break;
        case 3: nibble = mouseY & 0x0F;
                mouseX = 0; mouseY = 0; // Reset after full read
                break;
    }

    // Output nibble on D3-D6 (bits 3-6 of PORTD)
    PORTD = (PORTD & 0x87) | (nibble << 3);

    nibbleCount = (nibbleCount + 1) & 0x03;
}
```

---

## 10. Testing Methodology

### Phase 1: Mouse Emulation Only
1. Implement basic MSX mouse protocol
2. Apply Roland-specific timing fix (keep pins driven)
3. Verify cursor movement on sampler

### Phase 2: Button Capture
If you have access to a real RC-100:
1. Connect logic analyzer to DB-9
2. Capture data during button presses
3. Analyze patterns to determine encoding

### Phase 3: Button Emulation
1. Implement button encoding based on capture analysis
2. Add serial command interface for web control
3. Test individual buttons

---

## 11. Unknown Factors Requiring Verification

1. **Exact strobe edge**: Rising or falling?
2. **Button encoding scheme**: Escape sequence, separate lines, or multiplexed?
3. **Alpha dial protocol**: Standard quadrature or custom encoding?
4. **Response timing**: Minimum time from strobe edge to valid data?
5. **Simultaneous mouse + buttons**: How are they interleaved?

---

## 12. Next Steps

### If You Have an RC-100:
1. Use logic analyzer to capture all 8 DB-9 signals
2. Record strobe timing
3. Capture button press sequences
4. Document exact protocol

### If You Don't Have an RC-100:
1. Start with mouse-only emulation
2. Use known NYYRIKKI code as base
3. Apply Roland fixes
4. Test with sampler
5. Try common encoding schemes for buttons
6. Contact Chris Sugar/Andrew Cielecki for protocol details

### Alternative Approach - EPROM Dump:
1. Read the M5M27C128 ROM from an RC-100
2. Disassemble 8051 code
3. Find INT0 handler
4. Extract exact encoding algorithm

---

## Appendix A: Component Reference

| Designator | Part Number | Function |
|------------|-------------|----------|
| IC14 | M5M80C31RS | Main CPU (8051 family) |
| IC13 | M5M27C128 | 16KB Firmware ROM |
| IC12 | 74HC373 | Address latch |
| IC11 | 74HC04 | Hex inverter |
| IC15 | 74HC00 | Quad NAND gate |
| IC2 | M60063A-0175P | Gate array (button matrix scanner) |
| IC1 | 74HC393 | Dual 4-bit counter |
| IC42 | SN 82C100UP | Support logic |
| X1.1/X1.2 | KSR7/500Y11 | Crystal oscillator |
| FL1-FL18 | - | EMI filter beads |
| RA1 | RGLA06-103J | 10kΩ resistor array |

## Appendix B: Related Resources

1. 80C31 Datasheet (Philips/NXP/Intel)
2. MSX Mouse Protocol (msx.org wiki)
3. NYYRIKKI PS/2 to MSX code (MSX Resource Center)
4. PLZILandia S-770 modifications
5. S-xxx Project (synpro.heimat.eu)
6. Roland S-330/S-550/S-770 Service Manuals
