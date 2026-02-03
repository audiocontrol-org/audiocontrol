---
"@audiocontrol/launch-control-xl3": patch
---

Fix Issue #36: Correct write acknowledgement status byte interpretation

The write acknowledgement status byte is a slot identifier (using CC 30 encoding), not a success/failure code. This fixes writes to slots 1-14 which were incorrectly rejected as failures.
