# Claude Configuration Harmonization

This document explains how the `.claude/CLAUDE.md` configurations are harmonized between the `audio-tools` and `audio-control` projects.

## Common Principles

Both projects share these core principles:

### 1. File Operation Verification Protocol
**Both projects mandate strict verification of all file operations**

- After writing files: Use `ls` or `cat` to verify
- After editing files: Use `cat` or `head`/`tail` to confirm
- Before reporting completion: Provide evidence that files exist
- Never assume file operations succeeded

### 2. No Duplicate Files During Refactoring
**Both projects enforce:**
- Always refactor existing files in place
- Never create duplicate files (file-new.ts, file-v2.ts, etc.)
- Break backward compatibility by default unless told otherwise

### 3. TypeScript Best Practices
**Both projects require:**
- Strict TypeScript mode with all safety flags
- Interface-first design patterns for modular architecture
- Always use interfaces and factories, never concrete class dependencies
- Avoid `any` - use `unknown` with proper guards

### 4. Quality Gates
**Both projects enforce:**
- TypeScript compilation must succeed
- All tests must pass
- Documentation must be updated
- All file operations must be verified with evidence

### 5. Agent Universal Requirements
**All agents in both projects must:**
1. Verify file operations with bash commands and provide evidence
2. Never create duplicate files during refactoring
3. Always refactor existing files in place
4. Break backward compatibility by default unless explicitly told otherwise

## Key Differences

### Domain Focus

#### audio-tools
- **Domain**: Sampler backup, disk image extraction, format conversion
- **Key Technologies**: mtools, akaitools, rsnapshot, DOS/FAT filesystems
- **File Operations**: Large disk images, binary format parsing, cross-platform binaries
- **Performance**: Disk format detection < 100ms, sample conversion < 5s

#### audio-control
- **Domain**: MIDI mapping, audio device control, DAW integration
- **Key Technologies**: MIDI protocol, Ardour, Zod validation, YAML/JSON/XML
- **File Operations**: MIDI mapping files, configuration serialization
- **Performance**: MIDI parsing < 10ms, real-time operations < 1ms

### Specialized Knowledge

#### audio-tools Agents Should Know:
- Akai sampler formats (S1000, S3000, S5000/S6000)
- DOS/FAT filesystem structures
- Boot sector detection and MBR partition tables
- Cross-platform binary bundling and execution
- rsnapshot backup strategies
- Large file handling (avoid loading entire disk images)

#### audio-control Agents Should Know:
- MIDI protocol (CC, Note, Pitch Bend, NRPN/RPN)
- Audio DAW implementations (Ardour, etc.)
- Control surface behaviors (absolute, relative, toggle)
- Real-time audio constraints
- VST/AU parameter control

### Performance Targets

#### audio-tools
- Disk format detection: < 100ms
- Sample conversion: < 5s per sample
- Batch extraction: ~1 disk per 30s
- Memory usage: < 500MB for typical extraction

#### audio-control
- MIDI map parsing: < 10ms
- Validation: < 5ms
- Serialization: < 20ms
- Real-time operations: < 1ms latency
- Memory: < 50MB for 1000 mappings

## Harmonized Elements

### 1. Verification Requirements
Both projects use identical file verification protocols and requirements.

### 2. TypeScript Patterns
Both projects enforce the same strict TypeScript patterns and interface-first design.

### 3. Code Review Standards
Both projects have code-reviewer agents with the same extra responsibility to verify other agents' file operations.

### 4. Monorepo Management
Both projects use:
- pnpm workspaces
- Consistent module boundaries
- Shared type packages
- Workspace protocol for internal dependencies

### 5. Documentation Standards
Both projects require:
- JSDoc comments on all public APIs
- Usage examples in comments
- Comprehensive README files
- Documentation of domain-specific behaviors

## Agent Coverage

### Common Agents (Both Projects)
- `typescript-pro` - TypeScript expertise
- `code-reviewer` - Code quality and verification
- `api-designer` - Clean API design
- `test-automator` / `qa-expert` - Testing
- `architect-reviewer` - Architecture validation
- `documentation-engineer` - Documentation

### audio-tools Specific
- `cli-developer` - Command-line interface design
- `build-engineer` - Binary bundling and cross-platform builds
- `backend-developer` - File processing and batch operations
- `embedded-systems` - Binary format parsing

### audio-control Specific
- `embedded-systems` - MIDI protocol and real-time constraints (different focus)

## Migration Path

When moving between projects or applying learnings:

1. **Keep verification protocol identical** - This is universal
2. **Adapt performance targets** - Each project has different constraints
3. **Preserve domain expertise** - Don't dilute specialized knowledge
4. **Maintain TypeScript standards** - These are consistent across both
5. **Respect project-specific agents** - Each project has unique needs

## Future Harmonization

As both projects evolve, maintain:
- Identical file verification protocols
- Consistent TypeScript standards
- Aligned code review processes
- Shared monorepo patterns
- Common documentation standards

But allow divergence in:
- Domain-specific knowledge
- Performance targets
- Specialized agent selection
- Technology-specific practices
