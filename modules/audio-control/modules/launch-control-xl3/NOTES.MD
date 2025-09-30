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
  