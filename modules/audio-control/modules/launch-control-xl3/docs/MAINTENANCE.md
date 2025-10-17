# Documentation Maintenance Guide

**For AI Agents & Human Maintainers**

## Core Principle

**When protocol understanding changes, documentation MUST be updated immediately.**

This is not optional. Outdated documentation is worse than no documentation.

---

## Documentation Update Protocol

### When Protocol Changes Are Discovered

**Trigger events:**
- New MIDI message patterns observed
- Device behavior differs from documented
- Parsing errors occur
- Web editor traffic reveals new patterns
- Firmware updates change behavior

**Required actions (in order):**

1. **Update `.ksy` specification FIRST**
   - File: `formats/launch_control_xl3.ksy`
   - This is the single source of truth
   - Add comments explaining the discovery
   - Update version history in file header

2. **Update PROTOCOL.md**
   - Add/modify relevant section
   - Document discovery methodology
   - Provide byte-level examples
   - Update version history table

3. **Update ARCHITECTURE.md if needed**
   - If code structure changed
   - If new components added
   - If data flow changed

4. **Update API.md if user-visible**
   - New methods or parameters
   - Changed behavior
   - New examples needed

5. **Create test fixture**
   - Capture real device data
   - Save to `backup/` directory
   - Document what makes it special

### Documentation Synchronization Rules

**These files MUST stay synchronized:**

| Change Type | Files to Update |
|-------------|-----------------|
| Byte format changed | `.ksy` → `PROTOCOL.md` → Parser code |
| New message type | `.ksy` → `PROTOCOL.md` → `ARCHITECTURE.md` |
| Control ID mapping changed | `.ksy` → `PROTOCOL.md` → Parser code → Tests |
| New component added | `ARCHITECTURE.md` → `API.md` (if public) |
| DAW port protocol changed | `PROTOCOL.md` → `ARCHITECTURE.md` → DawPortController |

**Rule of thumb:** If you read it from the .ksy file in code, it MUST match the .ksy file.

---

## Version History Requirements

### Every Protocol Change Must Document:

1. **Date** - When discovered (YYYY-MM-DD)
2. **What** - Concise description of change
3. **Why** - Reason for change (new discovery, bug fix, firmware update)
4. **How** - Discovery method (MIDI spy, device testing, etc.)
5. **Impact** - What code/behavior changed

### Location of Version Histories

- **`.ksy` file** - Top-level comments section
- **`PROTOCOL.md`** - Bottom of file, "Version History" table
- **Git commit message** - Must reference documentation changes

### Version History Format

**In PROTOCOL.md:**
```markdown
| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2025-10-15 | Discovered control ID 0x40 has special behavior |
| 1.0 | 2025-09-30 | Initial documented protocol after empirical discovery |
```

**In .ksy file:**
```yaml
meta:
  id: launch_control_xl3_custom_mode
  title: Novation Launch Control XL3 Custom Mode Format
  ks-version: 0.11

doc: |
  Custom mode configuration format for Novation Launch Control XL3.

  Version History:
  - v1.1 (2025-10-15): Added special handling for control 0x40
  - v1.0 (2025-09-30): Initial specification from empirical discovery
```

---

## Recent Protocol Discoveries

### Write Acknowledgement Status Byte (2025-10-16) - VERIFIED

**Discovery:** The "status" byte in write acknowledgement messages is NOT a success/failure indicator - it's the **SLOT IDENTIFIER** using CC 30 slot encoding.

**Evidence:**
- Writing to slot 0 → response status: 0x06
- Writing to slot 1 → response status: 0x07
- Writing to slot 3 → response status: 0x09
- Writing to slot 5 → response status: 0x13

**Pattern:**
- Slots 0-3: 0x06 + slot
- Slots 4-14: 0x0E + slot

**Impact:**
- Fixed Issue #36 (DeviceManager.ts line 448-451 bug)
- Changed from `if (ack.status === 0x06)` to accepting any acknowledgement as success
- Acknowledgement arrival = success; timeout = failure
- Status byte can be used to verify correct slot was written

**Method:** Raw MIDI testing with `utils/test-round-trip-validation.ts`

**Verification (2025-10-16):**

Test run with `utils/test-valid-mode-changes.ts` successfully confirmed the fix:
- ✅ **Write to slot 3 succeeded** - No firmware rejection (Issue #36 was library bug)
- ✅ **Control CC numbers persisted correctly** - All 5 test controls changed from (13,14,15,16,17) to (23,24,25,26,27)
- ✅ **Control channels persisted correctly** - All channel values verified
- ✅ **10/11 changes verified successfully**

**Status:** VERIFIED - Issue #36 RESOLVED

**Documentation:**
- Updated PROTOCOL.md v2.0 with verification results
- Added "Known Issue: Mode Name Truncation" section
- Updated version history with verification evidence
- Confirmed fix works on real hardware

### Mode Name Truncation (2025-10-16) - UNDER INVESTIGATION

**Discovery:** Mode names written to the device may be truncated on read-back.

**Evidence:**
- Written name: "TESTMOD" (7 characters)
- Read-back name: "M" (1 character!)

**Hypothesis:**
1. The mode name field may have an undocumented length limit
2. There may be a serialization bug in the name field
3. The device firmware may truncate/modify mode names in specific ways

**Impact:**
- Mode name verification in round-trip tests cannot reliably confirm name persistence
- Does NOT affect control data persistence (verified to work correctly)

**Status:** Under investigation - needs further testing with different name patterns

**Next Steps:**
- Test various name lengths (1-8 characters)
- Test different character patterns (alphanumeric, spaces, special chars)
- Compare with web editor behavior
- Capture MIDI traffic during name write/read

---

## Discovery Methodology Documentation

**Every non-obvious protocol detail MUST explain how it was discovered.**

### Template for Discovery Documentation

```markdown
### [Protocol Feature Name]

**Format:** [byte sequence or structure]

**Discovery Method:**
1. Tool used (MIDI spy, web editor, etc.)
2. Steps taken to observe behavior
3. Data captured
4. Analysis that led to understanding

**Example:**
[Real byte sequence with annotations]

**Validation:**
- Tested with firmware version: X.X.X
- Date tested: YYYY-MM-DD
- Device serial: [if relevant]
```

### Why Discovery Methods Matter

Future agents/maintainers need to:
- Reproduce findings if device behavior changes
- Validate against different firmware versions
- Understand confidence level of documented behavior
- Know which tools to use for similar investigations

---

## Common Documentation Anti-Patterns

### ❌ DON'T: Make Assumptions

```markdown
// BAD
The control ID is probably in the second byte.
```

```markdown
// GOOD
The control ID is in the second byte (offset 1).
Confirmed by MIDI spy capture on 2025-09-30.
See backup/slot-1-2025-09-30T18-44-15-549Z.json for example.
```

### ❌ DON'T: Document Speculation

```markdown
// BAD
LEDs might be stored after the control definitions.
```

```markdown
// GOOD
LED states are NOT stored in custom mode configurations.
Verified by examining all 3 pages of mode data.
LEDs are controlled via separate real-time messages (0x78).
```

### ❌ DON'T: Leave Implementation Notes in Code

```typescript
// BAD - This will be lost/forgotten
// TODO: Not sure why we add 1 here, but it works
const actualId = labelId + 1;
```

```typescript
// GOOD - Document in PROTOCOL.md, reference from code
// Control IDs 25-28 map to 26-29 (+1 offset)
// See PROTOCOL.md section "Control Label Encoding" for details
const actualId = mapLabelControlId(labelId);
```

### ❌ DON'T: Create Separate Investigation Files

Investigation notes should be incorporated into the main docs or deleted. Never commit:
- `investigation/`
- `notes/`
- `findings.md`
- `todo.md`
- `WORKPLAN-*.md`

If findings are worth keeping, they belong in PROTOCOL.md or ARCHITECTURE.md.

---

## Documentation Update Checklist

Use this when making protocol-related changes:

```markdown
Protocol Change: [brief description]

Documentation Updates:
- [ ] Updated formats/launch_control_xl3.ksy
- [ ] Updated docs/PROTOCOL.md
- [ ] Updated docs/ARCHITECTURE.md (if architecture changed)
- [ ] Updated docs/API.md (if user-visible)
- [ ] Added version history entry
- [ ] Documented discovery methodology
- [ ] Created test fixture (if new behavior)
- [ ] Updated parser code to match
- [ ] Verified synchronization between docs and code
- [ ] Git commit message references doc changes
```

---

## Documentation Review Process

### Before Committing Protocol Changes

1. **Self-review checklist:**
   - Can a future agent understand this without context?
   - Is the .ksy file the source of truth?
   - Did I document HOW I discovered this?
   - Are all affected docs updated?
   - Is the version history current?

2. **Test with fresh eyes:**
   - Read docs as if you knew nothing
   - Verify examples match real data
   - Check that code matches docs

3. **Validate against hardware:**
   - Test parser with real device
   - Capture new test fixtures
   - Verify byte sequences in examples

### Red Flags (Fix Before Committing)

- ⚠️ Documentation contradicts code
- ⚠️ No discovery method explained for non-obvious details
- ⚠️ Version history not updated
- ⚠️ Code comments say "see other file" but other file wasn't updated
- ⚠️ New test files added but not documented
- ⚠️ Investigation notes left in commit

---

## Special Cases

### Firmware Version Differences

If device behavior differs by firmware version:

```markdown
### Control Behavior (Firmware-Dependent)

**Firmware 1.0.10.x:**
- Control IDs 25-28 map to 26-29 (+1 offset)

**Firmware 1.1.x (if different):**
- Different behavior here
- Document discovery date and method
```

### Undocumented Device Quirks

If device does something unexpected:

```markdown
### Known Quirks

**Slot Selection Timing:**
The device requires 50ms delay after slot selection before
accepting SysEx commands. Less than 50ms results in writes
to wrong slot.

**Discovered:** 2025-09-29
**Method:** Trial and error with increasing delays
**Impact:** All write operations must include delay
```

### Contradictions with Official Docs

If Novation's official documentation conflicts:

```markdown
**Official documentation states:** [quote]
**Actual behavior observed:** [description]
**Verified by:** MIDI spy capture [date]
**Implementation uses:** Actual behavior (empirical)
```

### Status Byte Misinterpretation Example

**Original (incorrect) interpretation:**
```markdown
### Write Acknowledgement

Format: F0 00 20 29 02 15 05 00 15 [page] [status] F7
Status byte: 0x06 = success, other values = failure
```

**Corrected interpretation (2025-10-16):**
```markdown
### Write Acknowledgement

Format: F0 00 20 29 02 15 05 00 15 [page] [slot_identifier] F7

The byte at position 10 is NOT a success/failure indicator.
It's the SLOT IDENTIFIER using CC 30 encoding:
- Slots 0-3: 0x06 + slot
- Slots 4-14: 0x0E + slot

Success is indicated by acknowledgement arrival.
Failure is indicated by timeout (no acknowledgement).
```

**Verified (2025-10-16):**
- Test with slot 3 write succeeded
- Control data persisted correctly
- Issue #36 resolved - bug was in library, not firmware

**Key lesson:** Test with multiple slots, not just slot 0!

---

## Test Data Requirements

### Unit Test Fixtures

**MANDATORY**: All parser and protocol tests MUST use real device fixtures.

#### Capturing Test Fixtures

```bash
# Capture from all 16 slots
for slot in {0..15}; do
  SLOT=$slot npm run backup
  sleep 2
done
```

Fixtures are stored in `backup/` directory with timestamps.

#### Using Fixtures in Tests

```typescript
// Load real device fixture
const backupDir = join(__dirname, '../../backup');
const files = await fs.readdir(backupDir);
const latestFixture = files.filter(f => f.endsWith('.json')).sort().reverse()[0];
const fixtureData = JSON.parse(await fs.readFile(join(backupDir, latestFixture), 'utf-8'));
```

### Test Data Validation

**All mock data MUST**:
1. Match actual device response format (array OR object for controls)
2. Include source documentation (real device vs synthetic)
3. Follow protocol specifications:
   - Mode name: max 8 characters
   - Control IDs: 0x10-0x3F (main), 0x68-0x6F (side buttons)
   - Channel: 0-15
   - CC: 0-127
   - Max 48 controls

### Test Coverage Requirements

**Before merging parser changes**:
- [ ] Test both array and object control formats
- [ ] Validate against protocol specification (PROTOCOL.md)
- [ ] At least one test uses real device fixture from `backup/`
- [ ] Run `npm run backup` to capture fresh fixture
- [ ] Protocol compliance tests passing

### Integration Test Requirements

**Manual validation before release**:
1. Connect real Launch Control XL3 device
2. Run: `npm run backup` for all 16 slots
3. Verify parser handles all captured data
4. Compare with web editor behavior (if changes affect mapping)

### Raw MIDI Testing for Protocol Discovery

**When investigating device behavior:**

Use `utils/test-round-trip-validation.ts` or similar raw MIDI scripts to:
1. Send specific SysEx messages directly
2. Capture exact device responses with byte-level precision
3. Test systematic patterns (e.g., all slots 0-14, not just slot 0)
4. Verify assumptions against real hardware

**Example from Issue #36 discovery:**
```bash
# Test write acknowledgements across multiple slots
npx tsx utils/test-round-trip-validation.ts

# Observed pattern:
# Slot 0 → ACK status 0x06
# Slot 1 → ACK status 0x07
# Slot 5 → ACK status 0x13
# Conclusion: Status byte is slot identifier, not success flag
```

**Example from Issue #36 verification:**
```bash
# Test valid mode changes to non-zero slot
npx tsx utils/test-valid-mode-changes.ts

# Results:
# ✅ Write to slot 3 succeeded
# ✅ Control CC numbers changed correctly (13→23, 14→24, etc.)
# ✅ Control channels persisted
# ✅ 10/11 changes verified
# ❌ Mode name truncated ("TESTMOD" → "M")
# Conclusion: Issue #36 resolved, new issue discovered
```

### Anti-Patterns to Avoid

❌ **DON'T** create hand-crafted mock data without validation
❌ **DON'T** assume array format - device may return objects
❌ **DON'T** commit changes without real device testing
❌ **DON'T** skip fixture capture before protocol changes
❌ **DON'T** test only slot 0 - patterns may emerge with other slots

✅ **DO** use real fixtures from `backup/` directory
✅ **DO** test both array and object formats
✅ **DO** validate against protocol specifications
✅ **DO** document data source (real vs synthetic)
✅ **DO** test across all slots when discovering slot-related behavior

---

## For New AI Agents

**First time working on this codebase?**

1. Read this file completely
2. Read docs/README.md for navigation
3. Read docs/ARCHITECTURE.md for overview
4. Read docs/PROTOCOL.md for protocol details
5. Check formats/launch_control_xl3.ksy for byte-level truth

**Before making ANY protocol-related changes:**
- Re-read this maintenance guide
- Follow the documentation update checklist
- Test against real hardware
- Document discovery methodology

**Remember:** Future you (or future agents) will thank you for good documentation.

---

## Contact & Questions

**If you're an AI agent:**
- Follow these guidelines strictly
- When in doubt, over-document rather than under-document
- Ask the user if something is unclear
- Never commit without updating related docs

**If you're a human:**
- These guidelines apply to you too
- Feel free to improve this maintenance guide
- Update this file if you discover better practices

---

**Last Updated:** 2025-10-16
**Maintained By:** See git history for contributors
