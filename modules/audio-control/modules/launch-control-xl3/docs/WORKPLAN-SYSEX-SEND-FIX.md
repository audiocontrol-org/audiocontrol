# SysEx Send Fix Workplan

Based on comprehensive analysis of the failing unit tests for the `SysExParser.buildCustomModeWriteRequest` function, this workplan provides a detailed roadmap to fix critical issues in the launch-control-xl3 module that prevent proper communication with the device.

## Executive Summary

The current `buildCustomModeWriteRequest` function has three major issues causing device communication failures:

1. **Generic Label Generation**: The function generates generic labels like "Fader 1" instead of using user-configured control names from the `name` field
2. **Incorrect Byte Positioning**: Color markers are positioned incorrectly, causing corruption (0x65 instead of expected 0x60)
3. **Protocol Specification Mismatch**: The message structure doesn't fully comply with the MIDI-PROTOCOL.md specification requirements

These issues result in corrupted data being sent to the device, causing slots to end up empty after write operations.

## Root Cause Analysis

### Issue 1: Generic Label Generation ✅ FIXED
**Location**: `SysExParser.encodeCustomModeData()` method, lines 891-894
**Problem**: The function calls `generateControlLabel(controlId)` which produces generic labels like "Fader 1", "Top 1", etc., instead of using the actual `control.name` field from the input data.

**Test Evidence**:
- Test "should use actual control names in labels, not generic ones" (lines 429-455)
- Test expects "MyVolume" but gets "Fader 1"

**Solution Implemented**: Modified to use `control.name` when available, falling back to `generateControlLabel()` for unnamed controls.

### Issue 2: Incorrect Color Marker Positioning 🚧 IN PROGRESS
**Location**: `SysExParser.encodeCustomModeData()` method, lines 897-902
**Problem**: The color markers (0x60) are being positioned incorrectly due to improper offset calculations, resulting in corrupted byte values.

**Test Evidence**:
- Test "should include color data with 0x60 marker"
- Expected 0x60 but receiving 0x65 (offset corruption)

### Issue 3: Message Structure Compliance
**Location**: Multiple locations in `buildCustomModeWriteRequest()` and `encodeCustomModeData()`
**Problem**: The generated message structure doesn't fully match the protocol specification for control definitions, label sections, and color sections.

**Test Evidence**:
- Test "should encode control with 0x49 marker and +0x28 offset as per protocol"
- Test "should include label markers (0x69) for controls with names"

## Detailed Implementation Plan

### Phase 1: Fix Label Generation ✅ COMPLETED

**Objective**: Replace generic label generation with actual control names

**Implementation Completed**:
```typescript
// Use actual control name if available, otherwise generate generic label
const labelText = control.name && control.name.trim() !== ''
  ? control.name.substring(0, 12) // Truncate to max 12 chars for device compatibility
  : this.generateControlLabel(controlId);
```

**Result**: Test "should use actual control names in labels, not generic ones" now passes

### Phase 2: Fix Color Marker Positioning 🚧 IN PROGRESS

**Objective**: Correct the byte positioning of color markers to prevent corruption

**Changes Required**:
1. **Review offset calculations in color section (lines 897-902)**:
   - Verify the 0x28 offset is applied correctly
   - Ensure no buffer overflows or incorrect indexing
   - Check that color marker 0x60 is written at the correct position

2. **Add proper validation**:
   - Validate control ID ranges before applying offsets
   - Add bounds checking for array operations
   - Ensure color data is written in the correct sequence

**Current Status**: Debugging why 0x65 appears instead of 0x60

### Phase 3: Protocol Compliance Enhancement (Medium Priority)

**Objective**: Ensure full compliance with MIDI protocol specification

**Changes Required**:
1. **Control Definition Structure**:
   - Verify 11-byte control format: `49 [ID+0x28] 02 [TYPE] [CH] 01 40 00 [CC] 7F 00`
   - Ensure proper control type mapping based on hardware position
   - Validate channel and CC number encoding

2. **Label Section Structure**:
   - Implement proper label marker format: `69 [ID+0x28] [ASCII_TEXT...]`
   - Ensure labels are null-terminated or properly delimited
   - Handle variable-length label encoding

3. **Color Section Structure**:
   - Implement proper color marker format: `60 [ID+0x28] [COLOR_VALUE]`
   - Ensure color values are within valid range (0-127)
   - Add proper section termination

### Phase 4: Message Length and Structure Validation (Medium Priority)

**Objective**: Ensure generated messages meet expected length and structure requirements

**Changes Required**:
1. **Message Length Validation**:
   - Add checks for minimum message length (100+ bytes for complete modes)
   - Ensure all required sections are included
   - Validate total message size doesn't exceed device limits

2. **Section Ordering**:
   - Verify correct order: Header → Data Header → Name → Controls → Labels → Colors → Footer
   - Ensure proper section boundaries and transitions
   - Add section markers where required

## Task Breakdown with Priorities

### High Priority Tasks
- [x] **Task 1.1**: Fix label generation to use `control.name` field (COMPLETED)
- [x] **Task 1.2**: Add fallback logic for missing control names (COMPLETED)
- [ ] **Task 2.1**: Debug and fix color marker positioning issues (IN PROGRESS)
- [ ] **Task 2.2**: Add validation for offset calculations

### Medium Priority Tasks
- [ ] **Task 3.1**: Verify control definition format compliance
- [ ] **Task 3.2**: Implement proper label section structure
- [ ] **Task 3.3**: Fix color section structure and encoding
- [ ] **Task 4.1**: Add message length validation
- [ ] **Task 4.2**: Verify section ordering and boundaries

### Low Priority Tasks
- [ ] **Task 5.1**: Add comprehensive error messages for debugging
- [ ] **Task 5.2**: Optimize encoding performance
- [ ] **Task 5.3**: Add protocol documentation updates

**Total Estimated Effort**: 33 hours

## Validation and Testing Strategy

### Unit Test Validation
1. **Existing Tests**: All failing tests in `SysExParser.test.ts` must pass
2. **New Tests**: Add tests for edge cases and error conditions
3. **Integration Tests**: Test with actual device communication

### Test Results Status
- ✅ "should use actual control names in labels, not generic ones" - PASSING
- ❌ "should include label data with 0x69 marker and control names" - FAILING
- ❌ "should include color data with 0x60 marker" - FAILING (gets 0x65)
- ❌ "should fail if current implementation is incorrect" - FAILING

### Validation Criteria
- [x] Control names are used instead of generic labels
- [ ] Color markers (0x60) appear at correct byte positions
- [ ] Message structure matches MIDI protocol specification
- [ ] Message length is appropriate for data complexity
- [ ] No data corruption or offset errors
- [ ] All unit tests pass

## Risk Assessment and Mitigation

### High Risks
1. **Device Communication Failure**: Current bugs cause slots to be empty
   - **Mitigation**: Comprehensive testing with actual device
   - **Rollback Plan**: Keep current working read functionality intact

2. **Protocol Breaking Changes**: Fixes might break existing functionality
   - **Mitigation**: Incremental changes with continuous testing
   - **Rollback Plan**: Git branches for each phase

### Medium Risks
1. **Performance Impact**: More complex encoding might slow down operations
   - **Mitigation**: Profile encoding performance during implementation
   - **Acceptable Threshold**: <50ms for typical mode encoding

2. **Backward Compatibility**: Changes might affect other device models
   - **Mitigation**: Maintain device-specific code paths
   - **Testing**: Verify other Launch Control variants still work

## Progress Tracking

### Phase 1: Label Generation Fix ✅ COMPLETED
- [x] **1.1**: Analyze current label generation logic
- [x] **1.2**: Implement control.name usage in encodeCustomModeData()
- [x] **1.3**: Add fallback logic for missing names
- [x] **1.4**: Test with "should use actual control names" test case
- [x] **1.5**: Verify no regression in other label tests

### Phase 2: Color Marker Fix 🚧 IN PROGRESS
- [x] **2.1**: Debug color marker positioning issue
- [ ] **2.2**: Fix offset calculations in color section
- [ ] **2.3**: Add bounds checking and validation
- [ ] **2.4**: Test with "should include color markers (0x60)" test case
- [ ] **2.5**: Verify color values are correct (0x60 not 0x65)

### Phase 3: Protocol Compliance
- [ ] **3.1**: Review protocol specification requirements
- [ ] **3.2**: Fix control definition format
- [ ] **3.3**: Fix label section structure
- [ ] **3.4**: Fix color section structure
- [ ] **3.5**: Test all protocol validation test cases

### Phase 4: Final Validation
- [ ] **4.1**: Run complete test suite
- [ ] **4.2**: Test with actual device hardware
- [ ] **4.3**: Verify message lengths are appropriate
- [ ] **4.4**: Performance testing and optimization
- [ ] **4.5**: Documentation updates and code review

### Completion Criteria
- [ ] All unit tests in SysExParser.test.ts pass
- [ ] Device successfully receives and applies custom mode data
- [ ] Control names appear correctly on device
- [ ] No corruption in slot data after write operations
- [ ] Message structure fully compliant with MIDI protocol
- [ ] Performance acceptable (<50ms encoding time)
- [ ] Code review approved
- [ ] Documentation updated

---

**Current Status**: Phase 1 completed successfully. Phase 2 in progress - debugging color marker positioning issue.

**Next Steps**: Continue debugging why color marker shows 0x65 instead of 0x60, likely an issue with how the color section offset is calculated or how the marker byte is written.

**Estimated Timeline**: 2-3 weeks for complete implementation and testing, assuming 15-20 hours per week availability.