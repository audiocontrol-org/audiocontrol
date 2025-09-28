# Workplan: Device Custom Mode Fetch Implementation (Feature MVP.3)

## Problem Statement

### Current State
The Launch Control XL3 library has most infrastructure in place for custom mode fetching:
- ✅ 4-message handshake protocol implemented and working
- ✅ `LaunchControlXL3.readCustomMode(slot)` method exists
- ✅ `DeviceManager.readCustomMode(slot)` method exists
- ✅ `SysExParser.buildCustomModeReadRequest(slot)` implemented
- ✅ `SysExParser.parseCustomModeResponseXL3()` implemented
- ✅ `CustomMode` data structures defined
- ✅ Test script exists (`utils/test-fetch-custom-mode-node.ts`)

### Gaps Identified
- ❌ Custom mode fetch may timeout or return incorrect data
- ❌ SysEx message protocol may not match device expectations
- ❌ Response parsing may not handle all custom mode formats correctly
- ❌ Error handling for empty/invalid slots needs verification
- ❌ Data structure mapping from device response to `CustomMode` interface

### Expected Behavior
The library API should offer a function to:
1. Send a custom mode read request to a specific slot (0-14 for slots 1-15)
2. Listen for and parse the response message(s) from the device
3. Return a properly structured `CustomMode` object containing:
   - Mode name
   - Control mappings (MIDI channel, CC numbers, ranges, behaviors)
   - LED color mappings
   - Control labels (if available)
4. Handle timeout and error cases gracefully
5. Return `null` for empty slots

## Technical Analysis

### Current Implementation Review

**DeviceManager.readCustomMode() (Lines 528-575)**
- ✅ Implements timeout handling (5 seconds)
- ✅ Uses SysExParser for message building and parsing
- ✅ Returns Promise<CustomMode>
- ⚠️ Error messages provide good troubleshooting guidance
- ❓ May need validation of parsed response format

**SysExParser.buildCustomModeReadRequest() (Lines 438-457)**
- ✅ Implements correct protocol format: `F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7`
- ✅ Validates slot range (0-15)
- ✅ Based on actual MIDI capture from web editor

**SysExParser.parseCustomModeResponseXL3() (Lines 197-230)**
- ✅ Handles Launch Control XL3 format (operation 0x10)
- ✅ Extracts slot number from response
- ✅ Calls parseCustomModeData() for actual data parsing
- ❓ May need validation against different response formats

**SysExParser.parseCustomModeData() (Lines 267-400)**
- ✅ Parses mode name from ASCII data
- ✅ Extracts control definitions with proper markers (0x48/0x49)
- ✅ Handles control ID offsets and validation
- ✅ Generates color mappings based on control types
- ❓ Complex parsing logic may have edge cases

### Protocol Details

**Custom Mode Read Request Format:**
```
F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7
└─ SysEx Start
   └─ Novation Manufacturer ID (00 20 29)
      └─ Device ID (02 = Launch Control XL 3)
         └─ Command (15 = Custom mode)
            └─ Sub-command (05)
               └─ Reserved (00)
                  └─ Operation (40 = Read)
                     └─ Slot (0-14)
                        └─ Parameter (00)
                           └─ SysEx End
```

**Expected Response Format:**
```
F0 00 20 29 02 15 05 00 10 [SLOT] [419 bytes of custom mode data] F7
└─ SysEx Start
   └─ Novation Manufacturer ID (00 20 29)
      └─ Device ID (02)
         └─ Command (15)
            └─ Sub-command (05)
               └─ Reserved (00)
                  └─ Operation (10 = Response)
                     └─ Slot number
                        └─ Custom mode data
                           └─ SysEx End
```

## Implementation Phases

### Phase 1: Protocol Verification and Message Flow Analysis
**Duration:** 1-2 days
**Priority:** High

#### Task 1.1: Message Protocol Validation
- **File:** `src/core/SysExParser.ts`
- **Action:** Verify `buildCustomModeReadRequest()` format matches device expectations
- **Testing:** Use MIDI monitor to compare with working web editor messages
- **Success Criteria:** Read request generates expected device response

#### Task 1.2: Response Parser Validation
- **File:** `src/core/SysExParser.ts`
- **Action:** Validate `parseCustomModeResponseXL3()` handles all response formats
- **Testing:** Test with multiple slot configurations (empty, full, partial)
- **Success Criteria:** Parser correctly identifies and extracts all response types

#### Task 1.3: Data Structure Mapping Verification
- **File:** `src/core/SysExParser.ts`
- **Action:** Ensure `parseCustomModeData()` correctly maps to `CustomMode` interface
- **Testing:** Compare parsed data with known custom mode configurations
- **Success Criteria:** All control mappings, colors, and labels correctly extracted

### Phase 2: Error Handling and Edge Cases
**Duration:** 1-2 days
**Priority:** High

#### Task 2.1: Empty Slot Handling
- **File:** `src/device/DeviceManager.ts`
- **Action:** Ensure empty slots return `null` instead of throwing errors
- **Testing:** Test slots known to be empty
- **Success Criteria:** Empty slots return `null`, non-empty slots return `CustomMode`

#### Task 2.2: Invalid Response Handling
- **File:** `src/device/DeviceManager.ts`
- **Action:** Handle malformed or unexpected SysEx responses gracefully
- **Testing:** Inject invalid responses during testing
- **Success Criteria:** Invalid responses throw descriptive errors, don't crash

#### Task 2.3: Timeout and Retry Logic
- **File:** `src/device/DeviceManager.ts`
- **Action:** Optimize timeout values and add optional retry mechanism
- **Testing:** Test with device in various states (busy, disconnected)
- **Success Criteria:** Timeouts provide clear error messages with troubleshooting steps

### Phase 3: Data Structure Optimization
**Duration:** 1 day
**Priority:** Medium

#### Task 3.1: CustomMode Interface Consistency
- **File:** `src/types/CustomMode.ts`
- **Action:** Ensure all optional fields are properly handled
- **Testing:** Verify serialization/deserialization round-trips
- **Success Criteria:** All `CustomMode` objects can be serialized and deserialized

#### Task 3.2: Control Mapping Normalization
- **File:** `src/core/SysExParser.ts`
- **Action:** Normalize control mappings to consistent property names
- **Testing:** Ensure all control properties use standard names (ccNumber vs cc, etc.)
- **Success Criteria:** All controls use consistent property names

### Phase 4: Integration Testing and Validation
**Duration:** 2-3 days
**Priority:** High

#### Task 4.1: End-to-End Testing
- **File:** `utils/test-fetch-custom-mode-node.ts`
- **Action:** Validate complete fetch workflow with real device
- **Testing:** Test all 15 slots with various configurations
- **Success Criteria:** All slots read correctly, proper error handling for edge cases

#### Task 4.2: Performance Testing
- **File:** `utils/test-fetch-custom-mode-node.ts`
- **Action:** Measure fetch times and optimize if needed
- **Testing:** Read multiple slots sequentially and in parallel
- **Success Criteria:** Fetch times under 3 seconds per slot

#### Task 4.3: Cross-Platform Testing
- **Files:** Node.js and browser test scripts
- **Action:** Ensure custom mode fetch works in both environments
- **Testing:** Test with EasyMidiBackend and WebMidiBackend
- **Success Criteria:** Consistent behavior across platforms

## Data Structures

### Expected CustomMode Structure
```typescript
interface CustomMode {
  name: string;                    // Mode name (max 8 chars)
  controls: Record<string, ControlMapping>; // Control mappings by ID
  labels?: Map<number, string>;    // Control labels by hardware ID
  colors?: Map<number, number>;    // LED colors by hardware ID
  leds?: Map<number, { color: number; behaviour: string }>; // LED states
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    [key: string]: any;
  };
  slot?: number;                   // Source slot (0-14)
}
```

### ControlMapping Interface Requirements
```typescript
interface ControlMapping {
  controlId?: number;              // Hardware control ID (0x00-0x3F)
  type?: ControlType;              // Control type (knob/fader/button)
  midiChannel?: number;            // MIDI channel (0-15)
  ccNumber?: number;               // CC number (0-127)
  minValue?: number;               // Min value (usually 0)
  maxValue?: number;               // Max value (usually 127)
  behavior?: ControlBehavior;      // absolute/relative/toggle
  transform?: string | ((value: number) => number);
}
```

## Error Handling Requirements

### Error Categories

#### 1. Connection Errors
- **Cause:** Device not connected or handshake failed
- **Response:** Throw descriptive error with troubleshooting steps
- **Recovery:** User must fix connection before retrying

#### 2. Protocol Errors
- **Cause:** Invalid SysEx response or unexpected message format
- **Response:** Throw error with protocol details and raw message data
- **Recovery:** Log error for debugging, may indicate firmware incompatibility

#### 3. Timeout Errors
- **Cause:** Device doesn't respond within timeout period
- **Response:** Throw timeout error with specific slot information
- **Recovery:** User can retry with longer timeout or check device state

#### 4. Slot Errors
- **Cause:** Invalid slot number or slot doesn't exist
- **Response:** Throw validation error with valid range
- **Recovery:** User must provide valid slot number (0-14)

#### 5. Empty Slot Handling
- **Cause:** Slot contains no custom mode data
- **Response:** Return `null` (not an error)
- **Recovery:** Normal operation, slot is simply empty

## Testing Strategy

### Unit Tests
**Location:** `test/unit/`

#### SysExParser Tests
- ✅ `buildCustomModeReadRequest()` generates correct message format
- ✅ `parseCustomModeResponseXL3()` handles valid responses
- ✅ `parseCustomModeResponseXL3()` rejects invalid responses
- ✅ `parseCustomModeData()` extracts all control types correctly
- ✅ Edge case handling (malformed data, empty responses)

#### DeviceManager Tests
- ✅ `readCustomMode()` returns CustomMode for valid slots
- ✅ `readCustomMode()` returns null for empty slots
- ✅ `readCustomMode()` throws appropriate errors for invalid input
- ✅ Timeout handling works correctly
- ✅ Message listener cleanup on success/error

### Integration Tests
**Location:** `test/integration/`

#### End-to-End Custom Mode Tests
- ✅ Connect to device and read known custom mode slot
- ✅ Read empty slot returns null
- ✅ Read all 15 slots sequentially
- ✅ Error handling for disconnected device
- ✅ Performance testing (read times under 3 seconds)

### Manual Testing Checklist
1. [ ] Test with device containing custom modes in various slots
2. [ ] Test with device having empty slots
3. [ ] Test with device having partially configured modes
4. [ ] Test disconnection during read operation
5. [ ] Test with different firmware versions (if available)

## Success Criteria

### Functional Requirements
- ✅ `LaunchControlXL3.readCustomMode(slot)` successfully reads custom modes
- ✅ Returns properly structured `CustomMode` objects with all data
- ✅ Handles all 15 slots (0-14 for slots 1-15)
- ✅ Returns `null` for empty slots without throwing errors
- ✅ Proper timeout handling with descriptive error messages
- ✅ Works in both Node.js and browser environments

### Performance Requirements
- ✅ Read operation completes within 3 seconds per slot
- ✅ No memory leaks during multiple read operations
- ✅ Proper cleanup of event listeners and timers

### Quality Requirements
- ✅ 90%+ unit test coverage for custom mode functionality
- ✅ Integration tests pass on real hardware
- ✅ Comprehensive error handling with user-friendly messages
- ✅ API documentation updated with examples
- ✅ TypeScript types are complete and accurate

## Timeline Estimates

### Development Schedule
- **Phase 1 (Protocol Verification):** 1-2 days
- **Phase 2 (Error Handling):** 1-2 days
- **Phase 3 (Data Structure Optimization):** 1 day
- **Phase 4 (Integration Testing):** 2-3 days

**Total Estimated Duration:** 5-8 days

### Milestone Checkpoints

#### Milestone 1: Basic Fetch Working (Day 2-3)
- Custom mode read request successfully triggers device response
- Response parser correctly extracts basic custom mode data
- Test script can read at least one custom mode successfully

#### Milestone 2: Robust Error Handling (Day 4-5)
- All error conditions handled gracefully
- Empty slots return null consistently
- Timeout and connection errors provide clear guidance

#### Milestone 3: Complete Implementation (Day 6-8)
- All 15 slots can be read reliably
- Data structures are complete and consistent
- Performance meets requirements
- Integration tests pass

## Current Known Issues

Based on the test run output:
1. ✅ Handshake works correctly (serial number: LX280935400469)
2. ✅ Device connects successfully
3. ✅ `readCustomMode` method is now exposed on controller
4. ❓ Need to verify if device is responding to read requests
5. ❓ Need to check if timeout values are appropriate
6. ❓ Need to validate response parsing logic

## Next Steps

1. **Immediate:** Run the test script again to see if `readCustomMode` now works
2. **Debug:** Add detailed logging to trace SysEx messages sent/received
3. **Verify:** Compare our read request format with working web editor
4. **Test:** Try reading a known populated slot first
5. **Iterate:** Adjust protocol/parsing based on actual device responses

## Risk Assessment

### Low Risk
- Basic infrastructure already in place
- SysEx message building/parsing logic exists
- Test framework ready

### Medium Risk
- Protocol format may need adjustment
- Response parsing complexity
- Different firmware versions may behave differently

### High Risk
- None identified - feature is well-scoped with clear requirements

## Conclusion

This workplan provides a comprehensive roadmap for implementing Feature MVP.3: Device Custom Mode Fetch. The implementation focuses on making the existing `readCustomMode()` method work correctly with proper SysEx message formatting, response parsing, timeout handling, and data structure mapping. With most infrastructure already in place, the primary focus is on protocol verification, error handling, and thorough testing to ensure reliable custom mode fetching across all 15 slots.