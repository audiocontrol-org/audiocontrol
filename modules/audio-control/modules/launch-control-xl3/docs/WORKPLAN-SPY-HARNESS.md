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
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │  MIDI Spy Tool  │    │ Launch Control  │
│  (Playwright)   │────│   (Intercept)   │────│      XL 3       │
│                 │    │                 │    │                 │
│ Novation Editor │    │ Log Messages    │    │    Device       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                        │
          │                        │
          ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│ Action Scripts  │    │  Message Log    │
│ (Automated)     │    │  (Analysis)     │
└─────────────────┘    └─────────────────┘
```

## Phase 1: MIDI Interception Infrastructure

### Objective
Set up a robust MIDI message interception system that can capture all communication between the web editor and device.

### Technical Approach

#### Option A: Virtual MIDI Port (Recommended)
- Create virtual MIDI ports using `IAC Driver` (macOS) or `loopMIDI` (Windows)
- Route web editor → virtual port → spy tool → device
- Provides clean separation and guaranteed message capture

#### Option B: Native MIDI Monitoring
- Use system-level MIDI monitoring tools
- Less intrusive but may miss some messages
- Platform-dependent implementation

### Implementation Tasks

1. **Set up Virtual MIDI Environment**
   ```bash
   # macOS: Enable IAC Driver in Audio MIDI Setup
   # Create virtual ports: "SPY_IN" and "SPY_OUT"
   ```

2. **Create MIDI Spy Tool**
   ```typescript
   // utils/midi-spy.ts
   class MidiSpy {
     private inputPort: MidiPort;
     private outputPort: MidiPort;
     private logFile: FileHandle;

     async startSpying(options: {
       inputPortName: string;
       outputPortName: string;
       logPath: string;
       timestampFormat: 'relative' | 'absolute';
     }): Promise<void>;

     private onMidiMessage(message: MidiMessage): void;
     private logMessage(direction: 'IN' | 'OUT', message: MidiMessage): void;
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
- [ ] Virtual MIDI port configuration guide
- [ ] MIDI spy tool implementation
- [ ] Message logging and parsing utilities
- [ ] Test verification that spy captures our own library's messages

**Estimated Time**: 8 hours

## Phase 2: Playwright Web Editor Automation

### Objective
Create systematic automation of the Novation web editor to trigger known actions while capturing the corresponding MIDI messages.

### Web Editor Analysis

#### Target URL
- Official Novation Launch Control XL 3 web editor
- Likely at: `https://components.novationmusic.com/` or similar
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
- [ ] Web editor discovery and access documentation
- [ ] Playwright automation framework
- [ ] Systematic test action library
- [ ] Test execution and results collection system

**Estimated Time**: 12 hours

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
- [ ] Message correlation analysis tools
- [ ] Pattern recognition and comparison utilities
- [ ] Updated protocol specification document
- [ ] Recommendations for fixing our implementation

**Estimated Time**: 10 hours

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
| **Phase 1**: MIDI Interception | 2 days | Hardware setup | Spy tool, virtual MIDI |
| **Phase 2**: Web Automation | 3 days | Phase 1, web editor access | Playwright scripts |
| **Phase 3**: Analysis | 2.5 days | Phases 1-2, captured data | Protocol fixes |
| **Phase 4**: Implementation | 2 days | Phase 3 analysis | Working SysEx writes |
| **Phase 5**: Test Automation | 1.5 days | Phase 4 fixes | CI validation |

**Total Estimated Duration**: 11 days (44 hours)

## Next Steps

1. **Immediate Actions** (Next 2 hours):
   - Set up virtual MIDI ports on development machine
   - Locate and access Novation web editor
   - Create basic MIDI spy tool structure

2. **Phase 1 Implementation** (Next 2 days):
   - Complete MIDI interception infrastructure
   - Test with our current library to verify capture works
   - Document setup process for team members

3. **Stakeholder Communication**:
   - Review workplan with user for approval
   - Confirm access to necessary tools and hardware
   - Establish communication cadence for progress updates

---

**Document Version**: 1.0
**Last Updated**: 2024-01-15
**Author**: Claude AI Assistant
**Status**: Draft - Awaiting Approval