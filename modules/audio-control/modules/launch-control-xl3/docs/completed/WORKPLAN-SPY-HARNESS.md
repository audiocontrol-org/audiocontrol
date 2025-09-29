# MIDI Spy Harness Workplan

## Executive Summary

Since our current SysEx implementation is not successfully writing data to the device (slots remain unchanged despite successful message transmission), we need to reverse-engineer the actual MIDI protocol by intercepting and analyzing real communication between the Launch Control XL 3 and the official Novation web editor.

This workplan outlines creating a comprehensive MIDI spy harness that will:
1. Intercept all MIDI messages between the device and web editor
2. Use Playwright automation to systematically test web editor functions
3. Correlate user actions with captured SysEx messages
4. Refine our protocol understanding based on real-world data

## Problem Statement

**Current Issue**: Our library successfully connects to the device and can read custom modes, but write operations fail silently - the device receives our SysEx messages but doesn't update the slot contents.

**Root Cause Hypothesis**: Our SysEx write message format doesn't match the device's actual expectations, despite passing our unit tests which are based on incomplete protocol documentation.

**Solution**: Capture and analyze real MIDI traffic from the working web editor to understand the correct protocol.

## Architecture Overview

```
┌─────────────────┐                    ┌─────────────────┐
│   Web Browser   │────────────────────│ Launch Control  │
│  (Playwright)   │    Direct MIDI     │      XL 3       │
│                 │    Connection      │                 │
│ Novation Editor │                    │    Device       │
└─────────────────┘                    └─────────────────┘
          │                                      │
          │                                      │
          ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐
│ Action Scripts  │                    │ Passive Monitor │
│ (Automated)     │                    │ (All MIDI I/O) │
└─────────────────┘                    └─────────────────┘
                                                 │
                                                 ▼
                                       ┌─────────────────┐
                                       │  Message Log    │
                                       │  (Analysis)     │
                                       └─────────────────┘
```

## Phase 1: Passive MIDI Monitoring Infrastructure

### Objective
Set up a passive MIDI monitoring system that observes all MIDI traffic on the system without interfering with the direct connection between the web editor and device.

### Technical Approach

#### Core MIDI Passive Monitoring
- Leverage macOS Core MIDI's hub-based architecture
- Subscribe to all MIDI sources simultaneously
- No virtual ports or routing needed - just passive observation
- Web MIDI API and Node.js both support this natively

### Implementation Tasks

1. **Create Passive MIDI Monitor**
   ```typescript
   // utils/midi-passive-monitor.ts
   import { Input } from 'midi';

   class PassiveMidiMonitor {
     private inputs: Input[] = [];
     private isMonitoring = false;
     private logFile: string;
     private capturedMessages: CaptureEntry[] = [];

     async startMonitoring(options: {
       logPath: string;
       timestampFormat: 'relative' | 'absolute';
       filterToDevice?: string; // Optional: only log specific device
     }): Promise<void> {
       // Subscribe to ALL MIDI inputs on the system
       // No routing or virtual ports needed
     }

     private onMidiMessage(portName: string, message: number[]): void {
       // Log all MIDI traffic passively
     }

     stopMonitoring(): CaptureEntry[] {
       // Return captured messages for analysis
     }
   }
   ```

2. **Web MIDI API Monitor (Alternative)**
   ```typescript
   // utils/web-midi-monitor.ts
   class WebMidiMonitor {
     async startMonitoring(): Promise<void> {
       const midiAccess = await navigator.requestMIDIAccess({ sysex: true });

       // Monitor ALL inputs without interfering
       midiAccess.inputs.forEach(input => {
         console.log(`Monitoring: ${input.name}`);
         input.onmidimessage = (event) => {
           this.logMessage(input.name, Array.from(event.data));
         };
       });
     }
   }
   ```

3. **Message Format Standardization**
   ```typescript
   interface SpyCaptureEntry {
     timestamp: number;
     direction: 'WEB_TO_DEVICE' | 'DEVICE_TO_WEB';
     messageType: 'sysex' | 'cc' | 'note' | 'other';
     rawBytes: number[];
     hexString: string;
     parsedData?: {
       manufacturer?: string;
       deviceId?: string;
       command?: string;
       slotIndex?: number;
       dataLength?: number;
     };
     context?: {
       webAction?: string;
       expectedResult?: string;
     };
   }
   ```

### Deliverables
- [x] Passive MIDI monitoring tool implementation (`utils/midi-monitor.ts`)
- [x] Message logging and parsing utilities (`utils/monitor-session-analyzer.ts`)
- [x] Test verification that monitor captures our own library's messages (`utils/test-midi-monitor.ts`)
- [x] Cross-platform compatibility (Node.js + Web MIDI API) (`utils/midi-monitor-web.html`)

**Estimated Time**: 4 hours (reduced due to simpler approach) ✅ COMPLETED

## Phase 2: Playwright Web Editor Automation

### Objective
Create systematic automation of the Novation web editor to trigger known actions while capturing the corresponding MIDI messages.

### Web Editor Analysis

#### Target URL
- Official Novation Launch Control XL 3 web editor
- At: `https://components.novationmusic.com/launch-control-xl-3/custom-modes`
- Need to identify the exact URL and access requirements

#### Key Functions to Automate
1. **Mode Management**
   - Create new custom mode
   - Save mode to device slot
   - Load mode from device slot
   - Copy mode between slots

2. **Control Configuration**
   - Set control names
   - Configure MIDI CC numbers
   - Set control types (fader, encoder, button)
   - Configure control behaviors

3. **Visual/LED Configuration**
   - Set LED colors
   - Configure LED behaviors
   - Set button pad colors

### Implementation Tasks

1. **Web Editor Discovery and Setup**
   ```typescript
   // utils/web-editor-automation.ts
   class WebEditorAutomation {
     private page: Page;
     private midiSpy: MidiSpy;

     async launchEditor(): Promise<void>;
     async connectToDevice(): Promise<void>;
     async waitForDeviceReady(): Promise<void>;
   }
   ```

2. **Action Automation Scripts**
   ```typescript
   interface TestAction {
     name: string;
     description: string;
     execute: (page: Page) => Promise<void>;
     expectedMidiMessages?: number;
     verification?: (capturedMessages: SpyCaptureEntry[]) => boolean;
   }

   const TEST_ACTIONS: TestAction[] = [
     {
       name: 'create_simple_mode',
       description: 'Create a new mode with basic settings',
       execute: async (page) => {
         await page.click('[data-testid="new-mode"]');
         await page.fill('[data-testid="mode-name"]', 'SPY_TEST_1');
         await page.click('[data-testid="save-mode"]');
       },
       expectedMidiMessages: 1,
     },
     // ... more actions
   ];
   ```

3. **Systematic Testing Framework**
   ```typescript
   class ProtocolReverseEngineer {
     async runActionSequence(actions: TestAction[]): Promise<TestResults> {
       const results: TestResults = { actions: [], messages: [] };

       for (const action of actions) {
         // Start message capture
         await this.midiSpy.startCapture();

         // Execute web action
         await action.execute(this.page);

         // Stop capture and analyze
         const messages = await this.midiSpy.stopCapture();
         results.actions.push({
           action: action.name,
           timestamp: Date.now(),
           capturedMessages: messages.length,
           messages: messages
         });
       }

       return results;
     }
   }
   ```

### Deliverables
- [x] Web editor discovery and access documentation (URL confirmed: https://components.novationmusic.com/launch-control-xl-3/custom-modes)
- [x] Playwright automation framework (`utils/web-editor-automation.ts`)
- [x] Systematic test action library (`utils/playwright-test-actions.ts`)
- [x] Test execution and results collection system (`utils/protocol-reverse-engineer.ts`, `utils/test-web-automation.ts`)

**Estimated Time**: 12 hours ✅ COMPLETED

## Phase 3: Message Correlation and Analysis

### Objective
Correlate captured MIDI messages with specific web editor actions to understand the true SysEx protocol.

### Analysis Framework

1. **Message Pattern Recognition**
   ```typescript
   class SysExAnalyzer {
     analyzeWritePatterns(entries: SpyCaptureEntry[]): WritePatternAnalysis {
       // Group messages by action type
       // Identify common byte patterns
       // Extract variable fields
       // Map to our current understanding
     }

     compareWithCurrentImplementation(
       capturedMessage: SpyCaptureEntry,
       ourMessage: number[]
     ): ComparisonResult {
       // Byte-by-byte comparison
       // Identify differences
       // Suggest corrections
     }
   }
   ```

2. **Protocol Reconstruction**
   ```typescript
   interface ProtocolSpecification {
     messageTypes: {
       customModeWrite: {
         header: number[];
         slotIndexPosition: number;
         nameSection: {
           marker: number;
           maxLength: number;
           encoding: 'ascii' | 'utf8';
         };
         controlSection: {
           marker: number;
           controlFormat: number[];
           controlCount: number;
         };
         labelSection: {
           marker: number;
           labelFormat: string;
         };
         colorSection: {
           marker: number;
           colorFormat: string;
         };
         footer: number[];
       };
     };
   }
   ```

### Implementation Tasks

1. **Data Collection Scripts**
   ```bash
   # utils/run-spy-session.ts
   npm run spy:start -- --session "control-name-test"
   npm run playwright:action -- "set-fader-name" --name "TestVol" --slot 1
   npm run spy:stop
   npm run spy:analyze -- --session "control-name-test"
   ```

2. **Message Analysis Tools**
   ```typescript
   // utils/analyze-captures.ts
   class CaptureAnalyzer {
     async analyzeCaptureSession(sessionPath: string): Promise<Analysis> {
       const entries = await this.loadCaptureData(sessionPath);

       return {
         messageCount: entries.length,
         patterns: this.identifyPatterns(entries),
         differences: this.compareWithCurrentImpl(entries),
         recommendations: this.generateRecommendations(entries)
       };
     }
   }
   ```

3. **Protocol Documentation Generator**
   ```typescript
   // Generate updated MIDI-PROTOCOL.md based on findings
   class ProtocolDocGenerator {
     generateUpdatedSpec(analysis: Analysis[]): string {
       // Create comprehensive protocol documentation
       // Include examples from real captures
       // Highlight differences from current implementation
     }
   }
   ```

### Deliverables
- [x] Message correlation analysis tools (`utils/capture-analyzer.ts`, `utils/run-analysis.ts`)
- [x] Pattern recognition and comparison utilities (`utils/sysex-analyzer.ts`)
- [x] Protocol documentation generator (`utils/protocol-doc-generator.ts`)
- [x] Recommendations generation system (integrated in all analysis tools)

**Estimated Time**: 10 hours ✅ COMPLETED

## Phase 4: Implementation Fixes and Validation

### Objective
Apply insights from the spy harness to fix our SysEx implementation and validate against real device behavior.

### Implementation Strategy

1. **Incremental Fixes**
   - Start with the most obvious differences
   - Test each fix individually
   - Maintain compatibility with existing read functionality

2. **Validation Process**
   - Compare our fixed messages with captured reference messages
   - Test with actual device to confirm slots update correctly
   - Verify no regression in existing functionality

### Implementation Tasks

1. **SysEx Message Fixes**
   ```typescript
   // src/core/SysExParser.ts - Apply discovered protocol fixes
   class SysExParser {
     buildCustomModeWriteRequest(slotIndex: number, mode: CustomMode): number[] {
       // Apply fixes based on spy harness findings
       // Use exact byte patterns from working web editor
       // Maintain our existing API compatibility
     }
   }
   ```

2. **Comprehensive Testing**
   ```bash
   # Test script to validate fixes
   npm run test:simple-write  # Verify basic functionality
   npm run spy:validate      # Compare with reference captures
   npm run test:round-trip   # End-to-end verification
   ```

3. **Documentation Updates**
   - Update MIDI-PROTOCOL.md with accurate specifications
   - Document any breaking changes
   - Provide migration guide if API changes needed

### Deliverables
- [ ] Fixed SysEx implementation
- [ ] Comprehensive test validation
- [ ] Updated protocol documentation
- [ ] Migration guide (if needed)

**Estimated Time**: 8 hours

## Phase 5: Test Automation and CI Integration

### Objective
Set up automated testing that validates our implementation against known-good reference messages.

### Testing Framework

1. **Reference Message Library**
   ```typescript
   // test/fixtures/reference-messages.ts
   export const REFERENCE_SYSEX_MESSAGES = {
     customModeWrite: {
       slot1_simple_mode: {
         description: 'Simple mode with 3 named controls',
         webEditorAction: 'Created via web editor on 2024-01-15',
         expectedSlotState: {
           name: 'SimpleTest',
           controls: [
             { id: 'control_1', name: 'Volume1', cc: 13 },
             { id: 'control_2', name: 'Volume2', cc: 14 },
             { id: 'control_9', name: 'Pan1', cc: 21 }
           ]
         },
         sysexMessage: [0xf0, 0x00, 0x20, 0x29, ...] // Captured bytes
       }
     }
   };
   ```

2. **Automated Validation Tests**
   ```typescript
   // test/integration/sysex-validation.test.ts
   describe('SysEx Message Validation', () => {
     it('should generate messages matching web editor reference', () => {
       const ourMessage = sysexParser.buildCustomModeWriteRequest(0, testMode);
       const reference = REFERENCE_SYSEX_MESSAGES.customModeWrite.slot1_simple_mode;

       expect(ourMessage).toEqual(reference.sysexMessage);
     });
   });
   ```

### Deliverables
- [ ] Reference message test fixtures
- [ ] Automated validation test suite
- [ ] CI integration for regression testing
- [ ] Performance benchmarks for message generation

**Estimated Time**: 6 hours

## Tools and Dependencies

### Required Software
- **Node.js/TypeScript**: Core development environment
- **Playwright**: Web automation framework
- **MIDI Libraries**: `easymidi`, `jzz`, or similar for MIDI I/O
- **Virtual MIDI**: IAC Driver (macOS) or loopMIDI (Windows)

### Hardware Requirements
- Launch Control XL 3 device
- Computer with MIDI capabilities
- Web browser supporting Web MIDI API

### Development Tools
```bash
# Install additional dependencies
npm install --save-dev playwright @playwright/test
npm install --save midi jzz-midi-gear

# Set up virtual MIDI (macOS)
# Open Audio MIDI Setup → MIDI Studio → IAC Driver → Properties
# Create ports: "LCX3_SPY_IN", "LCX3_SPY_OUT"
```

## Risk Assessment and Mitigation

### High Risks
1. **Web Editor Access**: Official editor may not be publicly available
   - **Mitigation**: Research Novation's web tools, contact support if needed
   - **Fallback**: Use device's built-in editor if available

2. **MIDI Routing Complexity**: Virtual MIDI setup may be unreliable
   - **Mitigation**: Provide detailed setup guides, test on multiple platforms
   - **Fallback**: Use system-level MIDI monitoring tools

3. **Protocol Encryption**: Messages may be encrypted or obfuscated
   - **Mitigation**: Start with simple test cases, analyze for patterns
   - **Fallback**: Focus on message structure rather than specific bytes

### Medium Risks
1. **Web Editor Changes**: Novation may update the editor, breaking automation
   - **Mitigation**: Version-pin editor, create adaptable selectors
   - **Recovery**: Update automation scripts as needed

2. **Message Volume**: Too many MIDI messages may overwhelm analysis
   - **Mitigation**: Filter to SysEx only, use targeted test actions
   - **Recovery**: Implement message filtering and batching

## Success Criteria

### Phase 1 Success
- [ ] MIDI spy tool captures all communication
- [ ] Virtual MIDI routing works reliably
- [ ] Message logging format is comprehensive and analyzable

### Phase 2 Success
- [ ] Playwright automation can control web editor
- [ ] Systematic actions trigger predictable MIDI messages
- [ ] Test action library covers key device functions

### Phase 3 Success
- [ ] Message patterns are identified and documented
- [ ] Differences from current implementation are clear
- [ ] Updated protocol specification is complete

### Phase 4 Success
- [ ] Fixed implementation successfully writes to device slots
- [ ] Device displays correct control names and settings
- [ ] No regression in existing functionality

### Phase 5 Success
- [ ] Automated tests validate against reference messages
- [ ] CI prevents regression in protocol implementation
- [ ] Performance meets acceptable thresholds

## Timeline

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|-------------|
| **Phase 1**: Passive MIDI Monitoring | 1 day | Hardware setup | Monitor tool |
| **Phase 2**: Web Automation | 3 days | Phase 1, web editor access | Playwright scripts |
| **Phase 3**: Analysis | 2.5 days | Phases 1-2, captured data | Protocol fixes |
| **Phase 4**: Implementation | 2 days | Phase 3 analysis | Working SysEx writes |
| **Phase 5**: Test Automation | 1.5 days | Phase 4 fixes | CI validation |

**Total Estimated Duration**: 10 days (40 hours)

## Next Steps

1. **Immediate Actions** (Next 2 hours):
   - Locate and access Novation web editor
   - Create basic passive MIDI monitor structure
   - Test monitoring with existing device communication

2. **Phase 1 Implementation** (Next 1 day):
   - Complete passive MIDI monitoring tool
   - Test with our current library to verify capture works
   - Document setup process for team members

3. **Stakeholder Communication**:
   - Review workplan with user for approval
   - Confirm access to necessary tools and hardware
   - Establish communication cadence for progress updates

---

## Critical Findings - Session 3

### Major Discovery: Excessive LED Control Messages

During live testing with Playwright automation and MIDI monitoring, we discovered a critical implementation issue:

#### The Problem
Our library sends **hundreds of excessive LED control messages** after SysEx operations:
- Pattern: `0x11 0x78` messages repeated 200+ times
- These messages flood the MIDI communication channel
- Likely causing device to ignore or fail processing legitimate commands
- The web editor does NOT send these messages

#### Evidence Captured
```json
{
  "timestamp": 1759157043879,
  "portName": "Launch Control XL3",
  "messageType": "cc",
  "rawData": [177, 120, 0],
  "hexData": "0xb1 0x78 0x00",
  "parsedData": {
    "channel": 1,
    "controller": 120,
    "value": 0,
    "_type": "cc"
  }
}
// ... repeated 200+ times
```

#### Web Editor Protocol (Correct Implementation)
The official web editor sends clean, minimal SysEx messages:
```
Write command: 0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x15 0x00 0x06 0xf7
```
- No excessive LED messages
- Clean, focused communication
- Device responds correctly

### Test Session Details

Successfully automated the Novation web editor using Playwright MCP:
1. Navigated to https://components.novationmusic.com/launch-control-xl-3/custom-modes
2. Created new custom mode
3. Named Encoder 1 as "TestVolume1"
4. Sent configuration to device slot 1
5. Captured all MIDI traffic during operation

### Root Cause Analysis

The excessive `0x11 0x78` messages appear to be:
- **Controller 120 (0x78)**: All Sound Off MIDI message
- **Channel 2 (0xb1)**: Being sent on MIDI channel 2
- **Unnecessary repetition**: Sent hundreds of times after each operation
- **Blocking legitimate traffic**: Flooding prevents proper SysEx processing

### Required Fixes

1. **Remove excessive LED control messages** from SysEx operations
2. **Audit all MIDI message sending** to ensure no unnecessary traffic
3. **Match web editor's clean protocol** - only send required messages
4. **Test with monitoring** to verify clean communication

### Implementation Recommendations

Based on our spy harness findings, the following changes are required:

1. **Locate and Remove LED Flooding Code**
   - Search for code sending CC 120 (0x78) messages
   - Remove or comment out the loop causing repetition
   - Likely in LED update or device sync functions

2. **Review SysEx Write Implementation**
   - Compare our SysEx format with captured web editor format
   - Web editor uses: `0xf0 0x00 0x20 0x29 0x02 0x15 0x05 0x00 0x15 0x00 0x06 0xf7`
   - Ensure we're not adding unnecessary wrapper messages

3. **Testing Protocol**
   - Run MIDI monitor during all tests
   - Verify only necessary messages are sent
   - Compare message count with web editor (should be minimal)

4. **Code Locations to Check**
   - `src/device/LaunchControlXL3Device.ts` - Device communication
   - `src/core/SysExParser.ts` - SysEx message building
   - Any LED or control update functions
   - Factory reset or sync operations that might trigger bulk updates

---

## Progress Update - Session 2

### Completed Tasks (Session 2)
- ✅ **Phase 1 Testing**: Verified passive MIDI monitoring infrastructure works correctly
- ✅ **Phase 2 Complete**: Implemented Playwright automation framework
  - Created `utils/web-editor-automation.ts` - Web editor control with Playwright
  - Created `utils/playwright-test-actions.ts` - 20+ test action definitions
  - Created `utils/protocol-reverse-engineer.ts` - Session orchestration
  - Created `utils/test-web-automation.ts` - CLI test runner
  - Added npm scripts for easy testing
- ✅ **Phase 3 Complete**: Implemented message analysis framework
  - Created `utils/sysex-analyzer.ts` - Pattern recognition and comparison
  - Created `utils/capture-analyzer.ts` - Session analysis and summaries
  - Created `utils/protocol-doc-generator.ts` - Documentation generation
  - Created `utils/run-analysis.ts` - Analysis workflow CLI
  - Created `utils/test-analysis.ts` - Test script with mock data
  - Created `utils/README-PHASE3.md` - Phase 3 documentation

### Key Achievements
- **Complete automation pipeline** ready for testing with actual device
- **Comprehensive analysis tools** for pattern recognition and protocol comparison
- **Documentation generation** in multiple formats (Markdown, JSON, HTML)
- **CLI tools** for running analysis and generating reports
- **TypeScript best practices** followed throughout implementation

### Next Session Tasks (Phase 4)
1. **Run actual device tests** to capture real MIDI traffic
2. **Execute web automation** to capture official protocol messages
3. **Analyze captured data** to identify implementation differences
4. **Fix SysEx implementation** based on findings
5. **Create comprehensive test suite** with reference messages

---

## Progress Update - Session 1

### Completed Tasks
- ✅ **Workplan Updated**: Changed from man-in-the-middle interception to passive monitoring approach
- ✅ **Phase 1 Implementation Started**: Created passive MIDI monitoring infrastructure
  - Created `utils/midi-monitor.ts` - Node.js passive monitor implementation
  - Created `utils/midi-monitor-web.html` - Web MIDI API monitor
  - Created `utils/test-midi-monitor.ts` - Test script for verification
  - Created `utils/monitor-session-analyzer.ts` - Session analysis tool

### Key Discoveries
- Web editor URL confirmed: `https://components.novationmusic.com/launch-control-xl-3/custom-modes`
- Passive monitoring approach is simpler and more reliable than interception
- Core MIDI's hub architecture allows multiple simultaneous listeners

### Next Session Tasks
1. **Test the monitoring tools** with actual device
2. **Capture baseline messages** from our library's current implementation
3. **Begin Phase 2**: Set up Playwright automation for web editor
4. **Capture web editor messages** for comparison

### Technical Notes
- Monitor captures all MIDI traffic without interference
- Supports filtering by device name (e.g., "LCXL3")
- Logs messages in JSON format with timestamps and hex representation
- Analyzer tool provides detailed comparison and pattern recognition

---

**Document Version**: 1.3
**Last Updated**: 2025-01-29 (End of Session 3)
**Author**: Claude AI Assistant
**Status**: Critical Issue Identified - Excessive LED Messages Blocking Communication