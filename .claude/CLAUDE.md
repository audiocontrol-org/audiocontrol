# audiocontrol

TypeScript monorepo for audio device control, MIDI communication, and web-based editors for vintage samplers and synthesizers. Uses pnpm workspaces with Vitest for testing.

## Project Structure

```text
audiocontrol/
├── modules/
│   ├── s330-editor/          # Web editor for Roland S-330 sampler (React)
│   ├── sampler-devices/      # Device communication layer
│   ├── sampler-midi/         # MIDI SysEx protocol implementations
│   ├── sampler-lib/          # Shared sampler data structures
│   ├── sampler-backup/       # Sampler backup/restore utilities
│   ├── sampler-export/       # Audio export from sampler data
│   ├── sampler-translate/    # Cross-format translation
│   ├── ardour-midi-maps/     # Ardour DAW MIDI map generation
│   ├── canonical-midi-maps/  # DAW-agnostic MIDI mapping format
│   ├── launch-control-xl3/   # Novation Launch Control XL3 support
│   ├── audiotools-cli/       # CLI tooling
│   ├── audiotools-config/    # Shared configuration
│   ├── controller-workflow/  # Controller workflow management
│   ├── lib-device-uuid/      # Device UUID generation
│   ├── lib-runtime/          # Runtime utilities
│   ├── live-max-cc-router/   # Ableton Live Max CC routing
│   └── sampler-attic/        # Archived/deprecated sampler code
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Core Requirements

### Import Pattern

Always use the `@/` import pattern for internal modules:

```typescript
import { SomeType } from '@/types/some-type';
import { someUtil } from '@/utils/some-util';
```

### Error Handling

Never implement fallbacks or use mock data outside of test code. Throw errors with descriptive messages instead. Errors let us know something isn't implemented. Fallbacks and mock data are bug factories.

```typescript
// Good
if (!midiPort) {
  throw new Error('MIDI port is required but not available');
}

// Bad — never do this
const port = midiPort || createMockPort();
```

### TypeScript

- Strict mode required
- Interface-first design — define contracts across boundaries
- Composition over inheritance — no class inheritance hierarchies
- Dependency injection — constructor injection with interface types
- Avoid `any` — use `unknown` with type guards
- Never stub modules — use dependency injection for testability

### Code Quality

- Files must be under 300-500 lines — refactor larger files
- Unit tests for all public functions (Vitest)
- High test coverage — aim for 80%+
- All code must be unit testable via dependency injection

### Repository Hygiene

- Build artifacts only in `dist/`
- Never bypass pre-commit or pre-push hooks — fix issues instead
- Never commit temporary files, logs, or generated artifacts
- Use `pnpm` for all package operations
- Use `tsx` for running TypeScript (not `ts-node`)

## Monorepo Conventions

- Each module is self-contained with clear boundaries
- Shared types go in dedicated packages
- Use `workspace:*` protocol for internal dependencies

## MIDI/Audio Guidelines

- Follow MIDI specification standards
- Support both 7-bit and 14-bit CC values
- Handle NRPN/RPN parameters correctly
- Real-time audio code must be allocation-free
- Respect MIDI clock and timing constraints
- Preserve proprietary sampler format specifications exactly
- Use the `midisnoop` binary (installed in PATH) to observe MIDI conversations

## URL Convention for Editors

Editors are served under audiocontrol.org:

```
https://audiocontrol.org/<manufacturer>/<device>/editor
```

Example: `https://audiocontrol.org/roland/s330/editor`

## Common Commands

```bash
pnpm install                         # Install dependencies
pnpm build                           # Build all modules
pnpm test                            # Run all tests
pnpm --filter <module> build         # Build specific module
pnpm --filter <module> test          # Test specific module
pnpm --filter <module>... build      # Build module and its dependencies
```

## Documentation Standards

- Don't call what you have built "production-ready"
- Never specify project management goals in temporal terms — use milestone, sprint, phase
- Never offer baseless projection statistics
- Use GitHub links (not file paths) in issue descriptions
- See [PROJECT-MANAGEMENT.md](./PROJECT-MANAGEMENT.md) for project management standards

## Critical Don'ts

- Never implement fallbacks or mock data outside test code
- Never stub modules — use dependency injection
- Never bypass pre-commit/pre-push hooks
- Never use relative imports — use `@/` pattern
- Never create files larger than 500 lines
- Never commit temporary files or build artifacts
- Never add Claude attribution to git commits
- Never use `ts-node` — use `tsx`
- Never call builds "production-ready"
