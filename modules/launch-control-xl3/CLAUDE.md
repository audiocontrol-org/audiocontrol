# Launch Control XL3 Module - AI Agent Guidelines

## 🚨 CRITICAL: Documentation Requirements

**BEFORE making ANY protocol-related changes, you MUST:**

1. **Read [`docs/MAINTENANCE.md`](./docs/MAINTENANCE.md)** - Documentation maintenance requirements
2. **Follow the documentation update checklist** strictly
3. **Update ALL affected documentation files** before committing

**Documentation is not optional. It is mandatory.**

Outdated documentation causes more problems than it solves. If you change protocol understanding, you MUST update docs immediately.

---

## Quick Start

**New to this module?**

1. **Start here:** [`docs/README.md`](./docs/README.md) - Documentation index
2. **Architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) - How code works
3. **Protocol:** [`docs/PROTOCOL.md`](./docs/PROTOCOL.md) - How device protocol works
4. **Maintenance:** [`docs/MAINTENANCE.md`](./docs/MAINTENANCE.md) - **REQUIRED READING**

---

## Module Purpose

TypeScript library for controlling the Novation Launch Control XL3 MIDI controller. Handles:
- Device connection & handshake
- Custom mode fetch/write operations
- DAW port slot selection protocol
- SysEx message parsing
- Real-time control mapping

---

## Development Constraints

### Documentation Synchronization (MANDATORY)

**These files must stay synchronized:**

1. **`formats/launch_control_xl3.ksy`** - Single source of truth for byte layouts
2. **`docs/PROTOCOL.md`** - Protocol specification with examples
3. **`src/core/SysExParser.ts`** - Parser implementation
4. **`docs/ARCHITECTURE.md`** - Architecture and data flow

**Rule:** If byte format changes, update ALL four files.

### Protocol Changes Require:

- [ ] Update `.ksy` specification FIRST
- [ ] Update `PROTOCOL.md` with discovery methodology
- [ ] Update parser code to match
- [ ] Add version history entry
- [ ] Create test fixture from real device
- [ ] Verify all docs are synchronized

### Code Quality Standards

- **TypeScript strict mode** - Already enabled
- **No mock data** - Throw errors with descriptive messages instead
- **Interface-first design** - Use dependency injection
- **File size limit** - Maximum 300-500 lines per file
- **Empirical validation** - Test against real hardware

---

## Protocol Discovery Workflow

When investigating protocol behavior:

1. **Use MIDI spy** - `../../modules/coremidi/midi-snoop`
2. **Use web editor** - Playwright automation to control Components web editor
3. **Capture traffic** - Save MIDI bytes during operations
4. **Compare patterns** - Diff captures to find encoding schemes
5. **Test empirically** - Validate with real device
6. **Document methodology** - Explain HOW you discovered it

**DO NOT speculate.** Only document verified behavior.

---

## Common Tasks

### Modifying Protocol Parser

**Required steps:**

1. Read `docs/MAINTENANCE.md` for requirements
2. Update `formats/launch_control_xl3.ksy` FIRST
3. Validate .ksy compiles: `kaitai-struct-compiler --help formats/launch_control_xl3.ksy`
4. Update `src/core/SysExParser.ts` to match
5. Update `docs/PROTOCOL.md` with examples
6. Add version history entries
7. Test with real device
8. Create backup fixture

### Adding New Message Types

**Required files:**

- `formats/launch_control_xl3.ksy` - Add type definition
- `docs/PROTOCOL.md` - Document format and examples
- `src/core/SysExParser.ts` - Add parsing logic
- `docs/ARCHITECTURE.md` - Update data flow if needed
- `backup/` - Add test fixture

### Debugging Protocol Issues

**Tools available:**

- MIDI spy: `cd ../../modules/coremidi/midi-snoop && make run`
- Backup utility: `npm run backup` - Fetch current mode
- Playwright: Test with web editor automation
- Test utilities: `utils/test-*.ts`

**Debug process:**

1. Enable debug logging (already in parser)
2. Capture MIDI traffic
3. Compare with expected format in .ksy
4. Identify discrepancy
5. Update docs AND code

---

## Anti-Patterns (DO NOT DO THIS)

❌ **DON'T** change parser without updating docs
❌ **DON'T** document speculative behavior
❌ **DON'T** leave investigation notes in module (use audio-control workspace `tmp/`)
❌ **DON'T** create workplans in module (use audio-control workspace `docs/<version>/`)
❌ **DON'T** commit without version history update
❌ **DON'T** add LED configuration code (not in protocol)
❌ **DON'T** assume SysEx slot byte controls target (uses DAW port)

---

## Testing Requirements

### Before Committing Protocol Changes

**Manual tests:**

```bash
# 1. Fetch mode from device
npm run backup

# 2. Verify parsing
npx tsx utils/test-fetch-custom-mode-node.ts

# 3. Check test fixtures
ls backup/*.json | tail -1
cat backup/*.json | jq '.mode.name'  # Should match device
```

### Validation Checklist

- [ ] Parser extracts mode name correctly (8 chars max)
- [ ] All 48 controls parsed
- [ ] Control labels parsed (95%+ accuracy)
- [ ] Control ID mapping correct (25-28 → 26-29 exception)
- [ ] DAW port slot selection works
- [ ] Backup utility succeeds

---

## File Organization

**Key directories:**

```
launch-control-xl3/
├── docs/               ← ALL documentation here
│   ├── MAINTENANCE.md  ← **READ THIS FIRST**
│   ├── README.md       ← Documentation index
│   ├── ARCHITECTURE.md ← How code works
│   └── PROTOCOL.md     ← How protocol works
├── formats/
│   └── launch_control_xl3.ksy  ← Protocol source of truth
├── src/
│   ├── core/
│   │   └── SysExParser.ts      ← Protocol parser
│   ├── device/
│   │   └── DeviceManager.ts    ← Connection/handshake
│   └── modes/
│       └── CustomModeManager.ts ← Mode operations
├── backup/             ← Real device captures (test fixtures)
└── utils/              ← Testing utilities
```

**Don't create in this module:**
- `investigation/` directories (use audio-control workspace `tmp/` instead)
- `notes/` directories (use audio-control workspace `tmp/` instead)
- Workplan files (they belong in audio-control workspace `docs/<version>/`)
- Temporary scripts (use audio-control workspace `tmp/` instead)

**Module-specific permanent documentation:**
- Protocol details → This module's `docs/PROTOCOL.md`
- Architecture patterns → This module's `docs/ARCHITECTURE.md`
- API documentation → This module's `docs/API.md`

**Audio-control workspace documentation:**
- Implementation workplans → `modules/audio-control/docs/<version>/<feature>/implementation/workplan.md`
- Temporary files → `modules/audio-control/tmp/`
- Permanent scripts → `modules/audio-control/scripts/`

**See audio-control workspace `modules/audio-control/.claude/CLAUDE.md` for complete workplan convention and file organization guidelines.**

---

## Performance Targets

- Handshake: ~500ms
- Slot selection: ~300ms (DAW port)
- Mode fetch: ~1.5-2.0s (3 pages)
- Parsing: <10ms (in-memory)

---

## Known Gotchas

### Control ID Mapping Exception

**Label IDs 25-28 map to control IDs 26-29 (+1 offset)**

This is hardware-specific, not a bug. Always use `mapLabelControlId()` when parsing labels.

### DAW Port Required for Slot Selection

**SysEx slot byte does NOT control target slot.**

Must use 2-phase DAW port protocol (see `docs/PROTOCOL.md` → "DAW Port Protocol").

### Length-Encoded Labels

**Marker byte encodes string length: `0x60 + length`**

Don't try to detect patterns. Calculate length, read exact bytes.

### No LED Configuration in Custom Modes

**LED states are NOT stored in custom modes.**

LEDs are real-time only (message type 0x78). Don't waste time looking for LED data in mode fetch.

---

## Success Criteria

Your change is complete when:

- ✅ All affected documentation updated
- ✅ Version histories updated
- ✅ `.ksy` file is source of truth
- ✅ Parser code matches docs
- ✅ Tests pass with real device
- ✅ Backup utility works
- ✅ Discovery methodology documented
- ✅ Git commit references doc changes

---

## For Questions

**If you're an AI agent:**
- Follow this guide strictly
- Read `docs/MAINTENANCE.md` for details
- When in doubt, ask the user
- Never commit without updating docs

**If you're a human:**
- Same rules apply
- Improve this guide if you find issues
- Keep documentation synchronized

---

**Module Owner:** See git history
**Last Updated:** 2025-10-11
**Documentation:** [`docs/README.md`](./docs/README.md)
