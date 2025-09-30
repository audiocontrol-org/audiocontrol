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

**Last Updated:** 2025-09-30
**Maintained By:** See git history for contributors
