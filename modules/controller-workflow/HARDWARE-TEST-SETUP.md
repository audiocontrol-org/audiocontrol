# Hardware Validation Test Setup - Feature 360

## Overview

Comprehensive hardware validation test suite for Feature 360 (MIDI Controller to DAW Deployment Pipeline).

**Device Under Test:** Novation Launch Control XL3
**Serial:** LX280935400469
**Test Location:** `/Users/orion/work/ol_dsp-audio-control-360/modules/audio-control/modules/controller-workflow`

## Test Scripts Created

### 1. `verify-setup.sh` (65 lines)
Pre-flight verification script that checks:
- CLI compilation status (`dist/cli/deploy.js`)
- Test script presence
- Node.js installation
- Overall readiness

**Usage:**
```bash
chmod +x verify-setup.sh
./verify-setup.sh
```

### 2. `test-hardware-validation.sh` (201 lines)
Main hardware validation test suite that executes 4 test phases:

#### Test 1: List Configuration Slots
- Connects to Launch Control XL3
- Lists all 16 slots (0-15)
- Verifies empty/populated status
- Checks slot naming

**Expected Output:**
```
Configuration Slots:
──────────────────────────────────────────────────
  ● Slot 00: (custom mode name or "empty")
  ● Slot 01: (custom mode name or "empty")
  ...
  ○ Slot 15: (empty)
──────────────────────────────────────────────────
Total slots: 16
```

#### Test 2: Read Slot 0 Configuration
- Reads configuration from slot 0
- Verifies control parsing
- Generates canonical YAML
- Saves to `./output/`

**Expected Output:**
```
[1/3] Reading controller configuration...
     ✓ Controller: Novation Launch Control XL 3
     ✓ Configuration: "MODE_NAME" from slot 0

[2/3] Converting to canonical format...
     ✓ Saved canonical: ./output/mode_name.yaml

[3/3] Deploying to DAWs...
     ✓ Ardour: ./output/mode_name.map
```

#### Test 3: Canonical YAML Structure Validation
- Examines generated YAML file
- Verifies metadata section
- Validates controls section
- Checks YAML syntax

**Required YAML Elements:**
- `metadata:` section with controller info
- `controls:` array with MIDI mappings
- Valid YAML syntax throughout

#### Test 4: Ardour Deployment
- Deploys to Ardour format
- Generates `.map` XML file
- Validates XML structure
- Checks for proper XML declaration

**Expected Ardour .map Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ArdourMIDIBindings version="1.0.0">
  <!-- Control mappings -->
</ArdourMIDIBindings>
```

### 3. `run-hardware-tests.sh` (37 lines)
Wrapper script that:
- Makes test script executable
- Executes full test suite
- Captures output to `hardware-test-results.txt`
- Reports final status

### 4. `execute-validation.sh` (90 lines)
Complete pre-flight and execution orchestrator:
- Verifies CLI compilation
- Checks test scripts
- Makes scripts executable
- Cleans output directory
- Prompts for device readiness
- Executes tests
- Shows final verification

## Test Execution Flow

```
execute-validation.sh
    ↓
Pre-flight checks:
    1. Check dist/cli/deploy.js exists
    2. Verify test scripts present
    3. Make scripts executable
    4. Clean output directory
    ↓
run-hardware-tests.sh
    ↓
test-hardware-validation.sh
    ↓
    TEST 1: List slots
    TEST 2: Deploy slot 0
    TEST 3: Validate YAML
    TEST 4: Deploy to Ardour
    ↓
Results saved to hardware-test-results.txt
```

## Expected Test Outcomes

### Success Criteria (All Tests Pass)

**Test 1 - List Command:**
- ✓ Device connection successful
- ✓ All 16 slots listed (0-15)
- ✓ Empty slots show "(empty)"
- ✓ Populated slots show names

**Test 2 - Deploy Command:**
- ✓ Slot 0 read successfully
- ✓ Configuration parsed
- ✓ Canonical YAML generated

**Test 3 - YAML Validation:**
- ✓ YAML file created
- ✓ Metadata section present
- ✓ Controls section present
- ✓ Valid YAML syntax

**Test 4 - Ardour Deployment:**
- ✓ Ardour .map file generated
- ✓ XML structure valid
- ✓ XML declaration present

### Pass/Fail Reporting

Each test reports:
- ✓ PASS (green) for successful tests
- ✗ FAIL (red) for failed tests

Final summary shows:
```
Total Tests Passed: X
Total Tests Failed: Y
```

## Generated Files

After successful test execution:

```
./output/
  ├── mode_name.yaml        # Canonical MIDI map
  ├── mode_name.map         # Ardour XML map
  ├── test1-list-output.txt
  ├── test2-deploy-output.txt
  └── test4-ardour-output.txt

./hardware-test-results.txt  # Complete test log
```

## Running the Tests

### Quick Start

```bash
cd /Users/orion/work/ol_dsp-audio-control-360/modules/audio-control/modules/controller-workflow

# Verify setup
chmod +x verify-setup.sh
./verify-setup.sh

# If all checks pass, run tests
chmod +x execute-validation.sh
./execute-validation.sh
```

### Manual Execution (Individual Tests)

```bash
# Test 1: List slots only
node dist/cli/deploy.js list

# Test 2: Deploy slot 0 (canonical YAML only)
node dist/cli/deploy.js deploy --slot 0

# Test 3: Deploy with Ardour target
node dist/cli/deploy.js deploy --slot 0 --daw ardour

# Test 4: Deploy with custom output directory
node dist/cli/deploy.js deploy --slot 0 --daw ardour --output ./custom-output
```

## Prerequisites

- [x] Launch Control XL3 connected via USB
- [x] Node.js installed (v18+)
- [x] Project built (`npm run build` or dist/cli/deploy.js exists)
- [x] No other applications using the MIDI device
- [x] Test scripts created (verify-setup.sh confirms this)

## Troubleshooting

### "No supported controller detected"
- Ensure Launch Control XL3 is connected via USB
- Check that no other application is using the device
- Try disconnecting and reconnecting the device

### "Cannot find module"
- Run `npm run build` to compile TypeScript
- Verify `dist/cli/deploy.js` exists

### "Permission denied"
- Make scripts executable: `chmod +x *.sh`

### "Failed to read slot"
- Verify the slot number is between 0-15
- Some slots may be empty (this is expected)
- Error handling should gracefully report empty slots

## Test Coverage

The test suite validates:

1. **Hardware Communication**
   - USB MIDI device connection
   - SysEx message exchange
   - Device detection and identification

2. **Protocol Implementation**
   - Slot listing commands
   - Configuration read operations
   - Multi-page read handling
   - Error recovery

3. **Data Conversion**
   - Device configuration → Canonical format
   - Label preservation
   - Control type mapping
   - MIDI channel handling

4. **DAW Deployment**
   - Canonical → Ardour conversion
   - XML generation
   - File writing
   - Output validation

## Next Steps After Testing

1. Review `hardware-test-results.txt` for complete test output
2. Examine generated YAML files for data accuracy
3. Verify Ardour .map files can be imported
4. Document any discovered issues
5. Update Feature 360 status based on results

## Related Documentation

- **Feature Status**: `docs/1.21/360/status.md`
- **Protocol Spec**: `modules/launch-control-xl3/docs/PROTOCOL.md`
- **Workplan**: Check for implementation workplan in docs/
- **CLI Help**: `node dist/cli/deploy.js --help`
