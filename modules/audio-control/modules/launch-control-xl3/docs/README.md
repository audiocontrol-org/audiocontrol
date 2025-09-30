# Documentation Index

## For Users

**[API.md](./API.md)** - Complete API reference for using the library
- Installation instructions
- Quick start guide
- API methods and examples
- Type reference

## For Maintainers & AI Assistants

Start here when working on the codebase:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture overview
   - Component responsibilities
   - Data flow
   - Common pitfalls & solutions
   - Development workflow

2. **[PROTOCOL.md](./PROTOCOL.md)** - Protocol specification
   - Custom mode fetch/write protocol
   - DAW port protocol (slot selection)
   - Data structure formats
   - Discovery methodology

3. **[../formats/launch_control_xl3.ksy](../formats/launch_control_xl3.ksy)** - Formal binary format specification
   - Kaitai Struct format (machine + human readable)
   - Exact byte layouts
   - Used as formal documentation (not code generation)

## Quick Navigation

**I want to...**

- **Use the library** → Read [API.md](./API.md)
- **Understand the code** → Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Modify the protocol parser** → Read [PROTOCOL.md](./PROTOCOL.md) then check [SysExParser.ts](../src/core/SysExParser.ts)
- **See exact byte formats** → Check [launch_control_xl3.ksy](../formats/launch_control_xl3.ksy)
- **Test with real device** → Use [backup utility](../utils/backup-current-mode.ts), check [backup directory](../backup/)

## Documentation Principles

1. **Single Source of Truth**: `.ksy` file defines exact protocol
2. **No Duplication**: Each concept documented once, referenced elsewhere
3. **Empirical Validation**: All protocol details verified with real hardware
4. **Version Controlled**: Protocol changes tracked with date and rationale

---

**Last Updated:** 2025-09-30
