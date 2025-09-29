# Utils Directory Tool Guide

## Official Tools (from WORKPLAN-SPY-HARNESS.md)

### Phase 1 - Passive MIDI Monitoring
- **`midi-monitor.ts`** - Main passive MIDI monitoring tool
  - Captures all MIDI traffic without interference
  - Supports device filtering and verbose logging
  - Saves sessions to JSON files

- **`monitor-session-analyzer.ts`** - Analyzes captured MIDI sessions
  - Pattern recognition and comparison
  - Generates detailed analysis reports

- **`test-midi-monitor.ts`** - Test script for midi-monitor
  - Verifies monitor functionality

- **`midi-monitor-web.html`** - Web-based MIDI monitor using Web MIDI API
  - Browser-based alternative to Node.js monitor

### Phase 2 - Web Editor Automation
- **`playwright-test-actions.ts`** - Library of test actions for web editor
  - Defines automated actions for Playwright

- **`capture-web-editor-write.ts`** - Playwright automation for web editor
  - Automates Novation web editor to capture traffic

### Test Utilities
- **`test-round-trip.ts`** - Tests write->read verification
- **`test-web-editor-protocol.ts`** - Tests web editor protocol
- **`test-fixed-write.ts`** - Tests SysEx write with 0x45
- **`test-simple-command.ts`** - Simple command testing

### Early/Simple Test Tools (kept for reference)
- `midi-listener.ts` - Simple MIDI listener (superseded by midi-monitor.ts)
- `test-control-names.ts` - Early control name testing
- `test-fetch-custom-mode-node.ts` - Custom mode fetching tests
- `test-factory-mode-copy.ts` - Factory mode copying tests

## DO NOT CREATE DUPLICATES
When working on MIDI monitoring or capturing, use the existing `midi-monitor.ts` tool.
It's the official implementation from the WORKPLAN-SPY-HARNESS.md.

## Important Note
The midi-monitor currently only captures messages FROM the device (output ports).
To capture messages TO the device, we need to either:
1. Create virtual MIDI ports to intercept traffic
2. Use the web editor with known-good messages for comparison