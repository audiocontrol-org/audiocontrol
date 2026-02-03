/*
 * RC-100 Protocol Discovery Tool
 * ==============================
 *
 * Purpose: Reverse engineer the RC-100 protocol by sending test patterns
 * to a Roland S-330/S-550/S-770 sampler and observing its behavior.
 *
 * Hardware Setup:
 * ---------------
 * Arduino Nano/Uno -> DB-9 Female Connector -> Sampler EXT CTRL port
 *
 * Pin Connections:
 *   Arduino D2  <- DB-9 Pin 8 (Strobe input from sampler) - DIRECTLY TO PIN, DIRECTLY TO GND OPTIONAL
 *   Arduino D3  -> DB-9 Pin 1 (Data bit 0 / Up)
 *   Arduino D4  -> DB-9 Pin 2 (Data bit 1 / Down)
 *   Arduino D5  -> DB-9 Pin 3 (Data bit 2 / Left)
 *   Arduino D6  -> DB-9 Pin 4 (Data bit 3 / Right)
 *   Arduino D7  -> DB-9 Pin 6 (Button 1 / Left click)
 *   Arduino D8  -> DB-9 Pin 7 (Button 2 / Right click)
 *   Arduino GND -> DB-9 Pin 9 (Ground)
 *
 * WARNING: Do NOT connect anything to DB-9 Pin 5 (+5V) - it has a sensitive fuse!
 *
 * Sampler Setup:
 * --------------
 * 1. Connect a monitor to the sampler's RGB output
 * 2. Boot the sampler while holding the down arrow (or numeric key for your model)
 * 3. Set control mode to "DT-100" or "RC-100" (not "MOUSE" or "NONE")
 * 4. You should see the sampler's GUI on the monitor
 *
 * Usage:
 * ------
 * Open Serial Monitor at 115200 baud and use these commands:
 *   m <x> <y>    - Send mouse movement (e.g., "m 10 0" moves right 10 units)
 *   b <1|2>      - Toggle button 1 or 2
 *   n <hex>      - Send raw nibble sequence (e.g., "n 0F0F" sends 4 nibbles)
 *   t            - Run timing test (measure strobe frequency)
 *   s            - Show current state
 *   r            - Reset to idle state
 *   x <pattern>  - Send experimental pattern (for button discovery)
 *
 * Protocol Notes:
 * ---------------
 * MSX Mouse Protocol (base):
 *   - Sampler toggles Pin 8 (strobe) to request data
 *   - On each strobe edge, we output one nibble on Pins 1-4
 *   - Sequence: X_high, X_low, Y_high, Y_low (4 nibbles = 2 bytes)
 *   - Data is ACTIVE LOW (accent: Roland sees grounded pins as "1")
 *
 * Roland Quirk:
 *   - Roland polls MUCH faster than standard MSX
 *   - Pins must be actively driven, not floated between reads
 *   - Use DDRD |= 0x3C (not DDRD &= ~0x3C) for JoyHigh()
 */

// Pin definitions
#define PIN_STROBE    2   // Input: Strobe from sampler (directly monitored)
#define PIN_DATA0     3   // Output: Data bit 0 (directly drives DB9 pin via resistance))
#define PIN_DATA1     4   // Output: Data bit 1
#define PIN_DATA2     5   // Output: Data bit 2
#define PIN_DATA3     6   // Output: Data bit 3
#define PIN_BUTTON1   7   // Output: Button 1 (directly drives DB9 pin)
#define PIN_BUTTON2   8   // Output: Button 2

// Protocol state
volatile uint8_t nibbleIndex = 0;      // Which nibble we're on (0-3 for mouse, 0-7+ for extended)
volatile int8_t mouseX = 0;            // X movement to send
volatile int8_t mouseY = 0;            // Y movement to send
volatile uint8_t button1State = 1;     // 1 = not pressed (active low)
volatile uint8_t button2State = 1;     // 1 = not pressed
volatile uint32_t lastStrobeTime = 0;  // For timing analysis
volatile uint32_t strobeCount = 0;     // Count strobes for analysis
volatile bool strobeDetected = false;  // Flag for main loop

// Extended protocol testing
volatile uint8_t extendedNibbles[16];  // Buffer for experimental nibble sequences
volatile uint8_t extendedLength = 0;   // How many nibbles in extended sequence
volatile bool useExtendedMode = false; // Use extended nibbles instead of mouse data

// Timing analysis
volatile uint32_t strobeIntervals[100];
volatile uint8_t intervalIndex = 0;
volatile bool timingTestActive = false;

// Debug
volatile uint8_t lastStrobeState = HIGH;
volatile uint8_t lastOutputNibble = 0;

void setup() {
    Serial.begin(115200);
    while (!Serial) { ; } // Wait for serial port

    Serial.println(F(""));
    Serial.println(F("========================================"));
    Serial.println(F("  RC-100 Protocol Discovery Tool v1.0"));
    Serial.println(F("========================================"));
    Serial.println(F(""));

    // Configure pins
    pinMode(PIN_STROBE, INPUT_PULLUP);  // Strobe input with pullup
    pinMode(PIN_DATA0, OUTPUT);
    pinMode(PIN_DATA1, OUTPUT);
    pinMode(PIN_DATA2, OUTPUT);
    pinMode(PIN_DATA3, OUTPUT);
    pinMode(PIN_BUTTON1, OUTPUT);
    pinMode(PIN_BUTTON2, OUTPUT);

    // Initialize outputs - ACTIVE LOW, so HIGH = not pressed/no movement
    // But for Roland, we need to actively drive pins
    setDataNibble(0x0F);  // All high (no data)
    digitalWrite(PIN_BUTTON1, HIGH);  // Not pressed
    digitalWrite(PIN_BUTTON2, HIGH);  // Not pressed

    // Attach interrupt for strobe detection
    // Try CHANGE to catch both edges
    attachInterrupt(digitalPinToInterrupt(PIN_STROBE), strobeISR, CHANGE);

    Serial.println(F("Hardware initialized."));
    Serial.println(F(""));
    Serial.println(F("IMPORTANT: Set sampler to DT-100 or RC-100 mode!"));
    Serial.println(F(""));
    Serial.println(F("Commands:"));
    Serial.println(F("  m <x> <y>  - Mouse move (e.g., 'm 10 0' = right 10)"));
    Serial.println(F("  b <1|2>    - Toggle button"));
    Serial.println(F("  c          - Click (press and release button 1)"));
    Serial.println(F("  n <hex>    - Raw nibbles (e.g., 'n 05FA')"));
    Serial.println(F("  t          - Timing test"));
    Serial.println(F("  s          - Show state"));
    Serial.println(F("  r          - Reset"));
    Serial.println(F("  ?          - Help"));
    Serial.println(F(""));
    Serial.print(F("> "));
}

// Interrupt Service Routine for strobe signal
void strobeISR() {
    uint32_t now = micros();
    uint8_t strobeState = digitalRead(PIN_STROBE);

    // Timing analysis
    if (timingTestActive && intervalIndex < 100) {
        strobeIntervals[intervalIndex++] = now - lastStrobeTime;
    }
    lastStrobeTime = now;
    strobeCount++;

    // Output the appropriate nibble based on strobe state and index
    uint8_t nibble;

    if (useExtendedMode && extendedLength > 0) {
        // Extended mode: output from buffer
        nibble = extendedNibbles[nibbleIndex % extendedLength];
    } else {
        // Standard mouse mode
        switch (nibbleIndex) {
            case 0: nibble = (mouseX >> 4) & 0x0F; break;  // X high nibble
            case 1: nibble = mouseX & 0x0F; break;         // X low nibble
            case 2: nibble = (mouseY >> 4) & 0x0F; break;  // Y high nibble
            case 3: nibble = mouseY & 0x0F;                // Y low nibble
                    // Reset movement after complete read
                    mouseX = 0;
                    mouseY = 0;
                    break;
            default: nibble = 0x00; break;  // Extra nibbles return 0
        }
    }

    // Output nibble (inverted for active-low protocol)
    // Roland expects: grounded = 1, floating/high = 0
    // So we invert: our 1s become LOW (grounded), our 0s become HIGH
    setDataNibble(~nibble & 0x0F);

    lastOutputNibble = nibble;
    lastStrobeState = strobeState;

    // Advance nibble counter on one edge (typically falling edge = strobe going LOW)
    // But Roland might use both edges differently - this is what we're discovering!
    nibbleIndex = (nibbleIndex + 1) & 0x07;  // Wrap at 8 for extended protocol

    strobeDetected = true;
}

// Set the 4 data pins from a nibble value
// Note: We're driving pins directly based on the nibble
// For active-low: 0 in nibble = pin HIGH, 1 in nibble = pin LOW
void setDataNibble(uint8_t nibble) {
    // Fast port manipulation for timing-critical response
    // Pins 3-6 are bits 3-6 of PORTD
    uint8_t portValue = PORTD & 0x87;  // Clear bits 3-6
    portValue |= ((nibble & 0x0F) << 3);  // Set bits 3-6 from nibble
    PORTD = portValue;
}

// Keep pins actively driven (Roland fix)
void keepPinsDriven() {
    // Set pins as outputs and keep them driven
    DDRD |= 0x78;  // Bits 3-6 as outputs (D3-D6)
}

void loop() {
    // Process serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        processCommand(cmd);
        Serial.print(F("> "));
    }

    // Report strobe activity periodically
    static uint32_t lastReport = 0;
    static uint32_t lastStrobeCount = 0;

    if (millis() - lastReport > 1000) {
        if (strobeCount != lastStrobeCount) {
            Serial.print(F("[Strobes/sec: "));
            Serial.print(strobeCount - lastStrobeCount);
            Serial.print(F(", last nibble: 0x"));
            Serial.print(lastOutputNibble, HEX);
            Serial.println(F("]"));
            lastStrobeCount = strobeCount;
        }
        lastReport = millis();
    }

    // Keep pins driven (Roland fix)
    keepPinsDriven();
}

void processCommand(String cmd) {
    if (cmd.length() == 0) return;

    char c = cmd.charAt(0);

    switch (c) {
        case 'm':  // Mouse movement
        case 'M':
            {
                int x = 0, y = 0;
                int spaceIdx = cmd.indexOf(' ', 2);
                if (spaceIdx > 0) {
                    x = cmd.substring(2, spaceIdx).toInt();
                    y = cmd.substring(spaceIdx + 1).toInt();
                } else if (cmd.length() > 2) {
                    x = cmd.substring(2).toInt();
                }

                // Clamp to signed byte range
                mouseX = constrain(x, -127, 127);
                mouseY = constrain(y, -127, 127);
                useExtendedMode = false;

                Serial.print(F("Mouse: X="));
                Serial.print(mouseX);
                Serial.print(F(", Y="));
                Serial.println(mouseY);

                Serial.print(F("  Nibbles: "));
                Serial.print((mouseX >> 4) & 0x0F, HEX);
                Serial.print(F(" "));
                Serial.print(mouseX & 0x0F, HEX);
                Serial.print(F(" "));
                Serial.print((mouseY >> 4) & 0x0F, HEX);
                Serial.print(F(" "));
                Serial.println(mouseY & 0x0F, HEX);
            }
            break;

        case 'b':  // Button toggle
        case 'B':
            {
                int btn = cmd.substring(2).toInt();
                if (btn == 1) {
                    button1State = !button1State;
                    digitalWrite(PIN_BUTTON1, button1State);
                    Serial.print(F("Button 1: "));
                    Serial.println(button1State ? F("RELEASED") : F("PRESSED"));
                } else if (btn == 2) {
                    button2State = !button2State;
                    digitalWrite(PIN_BUTTON2, button2State);
                    Serial.print(F("Button 2: "));
                    Serial.println(button2State ? F("RELEASED") : F("PRESSED"));
                }
            }
            break;

        case 'c':  // Click (press and release)
        case 'C':
            {
                digitalWrite(PIN_BUTTON1, LOW);  // Press
                Serial.println(F("Click: PRESS"));
                delay(100);
                digitalWrite(PIN_BUTTON1, HIGH);  // Release
                Serial.println(F("Click: RELEASE"));
            }
            break;

        case 'n':  // Raw nibble sequence
        case 'N':
            {
                String hex = cmd.substring(2);
                hex.trim();
                extendedLength = 0;

                for (int i = 0; i < hex.length() && extendedLength < 16; i++) {
                    char hc = hex.charAt(i);
                    uint8_t val = 0;
                    if (hc >= '0' && hc <= '9') val = hc - '0';
                    else if (hc >= 'A' && hc <= 'F') val = hc - 'A' + 10;
                    else if (hc >= 'a' && hc <= 'f') val = hc - 'a' + 10;
                    else continue;  // Skip invalid chars

                    extendedNibbles[extendedLength++] = val;
                }

                useExtendedMode = true;
                nibbleIndex = 0;

                Serial.print(F("Raw nibbles ("));
                Serial.print(extendedLength);
                Serial.print(F("): "));
                for (int i = 0; i < extendedLength; i++) {
                    Serial.print(extendedNibbles[i], HEX);
                    Serial.print(F(" "));
                }
                Serial.println();
            }
            break;

        case 't':  // Timing test
        case 'T':
            {
                Serial.println(F("Starting timing test (5 seconds)..."));
                intervalIndex = 0;
                timingTestActive = true;
                uint32_t startCount = strobeCount;

                delay(5000);

                timingTestActive = false;
                uint32_t endCount = strobeCount;

                Serial.println(F("Timing results:"));
                Serial.print(F("  Total strobes: "));
                Serial.println(endCount - startCount);
                Serial.print(F("  Strobes/sec: "));
                Serial.println((endCount - startCount) / 5);

                if (intervalIndex > 10) {
                    // Calculate average interval
                    uint32_t sum = 0;
                    uint32_t minInterval = 0xFFFFFFFF;
                    uint32_t maxInterval = 0;

                    for (int i = 1; i < intervalIndex; i++) {  // Skip first
                        sum += strobeIntervals[i];
                        if (strobeIntervals[i] < minInterval) minInterval = strobeIntervals[i];
                        if (strobeIntervals[i] > maxInterval) maxInterval = strobeIntervals[i];
                    }

                    Serial.print(F("  Avg interval: "));
                    Serial.print(sum / (intervalIndex - 1));
                    Serial.println(F(" us"));
                    Serial.print(F("  Min interval: "));
                    Serial.print(minInterval);
                    Serial.println(F(" us"));
                    Serial.print(F("  Max interval: "));
                    Serial.print(maxInterval);
                    Serial.println(F(" us"));

                    // Show first 20 intervals
                    Serial.println(F("  First 20 intervals (us):"));
                    Serial.print(F("    "));
                    for (int i = 1; i < min(21, (int)intervalIndex); i++) {
                        Serial.print(strobeIntervals[i]);
                        Serial.print(F(" "));
                    }
                    Serial.println();
                }
            }
            break;

        case 's':  // Show state
        case 'S':
            {
                Serial.println(F("Current State:"));
                Serial.print(F("  Strobe pin: "));
                Serial.println(digitalRead(PIN_STROBE) ? F("HIGH") : F("LOW"));
                Serial.print(F("  Strobe count: "));
                Serial.println(strobeCount);
                Serial.print(F("  Nibble index: "));
                Serial.println(nibbleIndex);
                Serial.print(F("  Mouse X: "));
                Serial.println(mouseX);
                Serial.print(F("  Mouse Y: "));
                Serial.println(mouseY);
                Serial.print(F("  Button 1: "));
                Serial.println(button1State ? F("RELEASED") : F("PRESSED"));
                Serial.print(F("  Button 2: "));
                Serial.println(button2State ? F("RELEASED") : F("PRESSED"));
                Serial.print(F("  Mode: "));
                Serial.println(useExtendedMode ? F("EXTENDED") : F("MOUSE"));
                Serial.print(F("  Last output nibble: 0x"));
                Serial.println(lastOutputNibble, HEX);
            }
            break;

        case 'r':  // Reset
        case 'R':
            {
                noInterrupts();
                nibbleIndex = 0;
                mouseX = 0;
                mouseY = 0;
                button1State = 1;
                button2State = 1;
                useExtendedMode = false;
                extendedLength = 0;
                strobeCount = 0;
                interrupts();

                digitalWrite(PIN_BUTTON1, HIGH);
                digitalWrite(PIN_BUTTON2, HIGH);
                setDataNibble(0x0F);

                Serial.println(F("Reset to idle state."));
            }
            break;

        case 'x':  // Experimental button patterns
        case 'X':
            {
                int pattern = cmd.substring(2).toInt();
                Serial.print(F("Experimental pattern "));
                Serial.print(pattern);
                Serial.println(F(":"));

                // Try various patterns that might trigger button functions
                switch (pattern) {
                    case 1:
                        // Pattern 1: All 0xF nibbles (escape sequence hypothesis)
                        Serial.println(F("  Trying 0xFFFF (possible escape)"));
                        extendedNibbles[0] = 0xF;
                        extendedNibbles[1] = 0xF;
                        extendedNibbles[2] = 0xF;
                        extendedNibbles[3] = 0xF;
                        extendedLength = 4;
                        break;
                    case 2:
                        // Pattern 2: Button code in extended nibbles
                        Serial.println(F("  Trying F001 (escape + button 1)"));
                        extendedNibbles[0] = 0xF;
                        extendedNibbles[1] = 0x0;
                        extendedNibbles[2] = 0x0;
                        extendedNibbles[3] = 0x1;
                        extendedLength = 4;
                        break;
                    case 3:
                        // Pattern 3: High nibble flag
                        Serial.println(F("  Trying 8000 (high bit flag)"));
                        extendedNibbles[0] = 0x8;
                        extendedNibbles[1] = 0x0;
                        extendedNibbles[2] = 0x0;
                        extendedNibbles[3] = 0x0;
                        extendedLength = 4;
                        break;
                    case 4:
                        // Pattern 4: Extended 8-nibble sequence
                        Serial.println(F("  Trying 00000001 (8 nibbles)"));
                        for (int i = 0; i < 7; i++) extendedNibbles[i] = 0x0;
                        extendedNibbles[7] = 0x1;
                        extendedLength = 8;
                        break;
                    case 5:
                        // Pattern 5: Trackball-style encoding
                        Serial.println(F("  Trying 8888 (trackball neutral)"));
                        extendedNibbles[0] = 0x8;
                        extendedNibbles[1] = 0x8;
                        extendedNibbles[2] = 0x8;
                        extendedNibbles[3] = 0x8;
                        extendedLength = 4;
                        break;
                    default:
                        Serial.println(F("  Unknown pattern. Try 1-5."));
                        return;
                }

                useExtendedMode = true;
                nibbleIndex = 0;
                Serial.print(F("  Nibbles: "));
                for (int i = 0; i < extendedLength; i++) {
                    Serial.print(extendedNibbles[i], HEX);
                    Serial.print(F(" "));
                }
                Serial.println();
            }
            break;

        case '?':  // Help
        case 'h':
        case 'H':
            {
                Serial.println(F(""));
                Serial.println(F("Commands:"));
                Serial.println(F("  m <x> <y>  - Mouse movement (-127 to 127)"));
                Serial.println(F("               Example: 'm 20 0' moves cursor right"));
                Serial.println(F("               Example: 'm 0 -20' moves cursor up"));
                Serial.println(F("  b <1|2>    - Toggle button (1=left, 2=right)"));
                Serial.println(F("  c          - Click (press+release button 1)"));
                Serial.println(F("  n <hex>    - Send raw nibble sequence"));
                Serial.println(F("               Example: 'n 1234' sends nibbles 1,2,3,4"));
                Serial.println(F("  t          - Run 5-second timing test"));
                Serial.println(F("  s          - Show current state"));
                Serial.println(F("  r          - Reset to idle"));
                Serial.println(F("  x <1-5>    - Try experimental button patterns"));
                Serial.println(F("  ?          - This help"));
                Serial.println(F(""));
                Serial.println(F("Tips:"));
                Serial.println(F("  - Start with 't' to verify sampler is polling"));
                Serial.println(F("  - Try 'm 50 0' to see cursor move right"));
                Serial.println(F("  - Try 'c' to click on GUI elements"));
                Serial.println(F("  - Use 'n' to experiment with raw data patterns"));
                Serial.println(F(""));
            }
            break;

        default:
            Serial.print(F("Unknown command: "));
            Serial.println(cmd);
            Serial.println(F("Type '?' for help."));
            break;
    }
}
