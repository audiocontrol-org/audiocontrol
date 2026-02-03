Found the bug!

The parser is stopping early because it's only looking for 0x48 control markers, but
looking at the actual MIDI data from the capture (line 79-80, 86), the device sends a
MIXED format:

- Configured controls (with CH/CC set): Full 0x48 structure (10 bytes)
- Unconfigured controls (CH0/CC0): Short 0x40 [controlId] pairs (2 bytes)

Example from line 79:
48 10 02 05 06 01 48 00 5B 7F    ← Full structure (control 0x10 configured)
48 11 02 05 00 01 48 00 00 7F    ← Full structure (control 0x11 has CH0/CC0)
48 12 02 05 00 01 48 00 00 7F    ← Full structure (control 0x12 has CH0/CC0)
40 13 40 14 40 15 40 16 40 17    ← Short format (controls 0x13-0x17 unconfigured)
48 18 02 09 00 01 48 00 00 7F    ← Full structure (control 0x18)

The parser's logic at line 615-653 tries to handle 0x40 entries, but it only uses them
if NO 0x48 controls were found (if (controls.length === 0 && ccData.length > 0)). But
in reality, the device sends BOTH in the same message!

The fix: We need to process BOTH 0x48 full structures AND 0x40 short structures to
build a complete list of all 48 controls.

## 2025-09-29 10:15 PM

Fetching data happens across two messages.

```
I see the issue! The library is currently only sending one read request with 0x00
  (first page) but not the second request with 0x03 (second page). This is why we're only
   getting 24 controls instead of all 48!

  The web editor pattern shows:
  - First request: F0 00 20 29 02 15 05 00 40 00 00 F7 → Gets controls 0x10-0x27
  (encoders)
  - Second request: F0 00 20 29 02 15 05 00 40 03 00 F7 → Gets controls 0x28-0x3F
  (faders/buttons)

  The key difference is the 10th byte: 00 for first page, 03 for second page.

  Our current implementation incorrectly uses the slot number where it should be using
  the page indicator. The library needs to:
  1. Send TWO read requests (one for each page)
  2. Combine the responses to get all 48 controls
  3. The slot number should be in the last byte before F7, not the page indicator
  position

  This is a significant discovery that explains why the library is only reading half the
  controls!
  ```
  