# Text Overlay Generator - Workplan

**GitHub Milestone:** [Week of Feb 3-7](https://github.com/audiocontrol-org/videocontrol/milestone/1)
**GitHub Issues:**

- [Parent: Integrate oletizi/video-control (#10)](https://github.com/audiocontrol-org/videocontrol/issues/10)
- [Copy source files from oletizi/video-control (#11)](https://github.com/audiocontrol-org/videocontrol/issues/11)
- [Integrate text-overlay into pnpm workspace (#12)](https://github.com/audiocontrol-org/videocontrol/issues/12)
- [Verify all text-overlay CLI commands work (#13)](https://github.com/audiocontrol-org/videocontrol/issues/13)
- [Verify Remotion Studio works for text-overlay (#14)](https://github.com/audiocontrol-org/videocontrol/issues/14)
- [Update text-overlay documentation for monorepo (#15)](https://github.com/audiocontrol-org/videocontrol/issues/15)

## Technical Approach

Migrate the existing oletizi/video-control repository into the videocontrol monorepo as `modules/text-overlay`. Preserve all functionality while adapting to the monorepo conventions.

### Source Repository

- **Repo:** [oletizi/video-control](https://github.com/oletizi/video-control)
- **Tech stack:** Remotion, React, TypeScript, Zod, js-yaml, Commander

### Target Structure

```
modules/text-overlay/
├── package.json           # @videocontrol/text-overlay
├── tsconfig.json
├── tsconfig.cli.json      # CLI-specific config
├── remotion.config.ts
├── eslint.config.mjs
├── src/
│   ├── cli/               # CLI commands
│   ├── parser/            # YAML/Zod schemas
│   ├── templates/         # Overlay components
│   ├── transitions/       # Animation utilities
│   ├── composition/       # Remotion composition
│   └── utils/             # Timing utilities
├── docs/                   # Sample YAML files
└── scripts/               # Test scripts
```

## Implementation Phases

### Phase 1: Repository Migration

- Copy source files from oletizi/video-control to modules/text-overlay
- Update package.json:
  - Rename to `@videocontrol/text-overlay`
  - Preserve all dependencies and scripts
  - Add workspace-compatible configuration
- Update imports if any absolute paths need adjustment
- Verify tsconfig.json compatibility with monorepo base config

### Phase 2: Workspace Integration

- Add text-overlay to pnpm-workspace.yaml
- Run `pnpm install` to resolve dependencies
- Verify Remotion bundling works independently
- Test that other modules aren't affected

### Phase 3: Functionality Verification

- Test CLI commands:
  - `pnpm --filter @videocontrol/text-overlay cli -- init`
  - `pnpm --filter @videocontrol/text-overlay cli -- validate sample.yaml`
  - `pnpm --filter @videocontrol/text-overlay cli -- templates`
  - `pnpm --filter @videocontrol/text-overlay cli -- render sample.yaml -o test.mov`
- Test Remotion Studio: `pnpm --filter @videocontrol/text-overlay dev`
- Verify ProRes output has correct alpha channel
- Test all overlay templates render correctly

### Phase 4: Documentation Update

- Update module README.md with monorepo-specific instructions
- Add module to root README.md visualizers list
- Update any hardcoded paths in docs

## Success Criteria Per Phase

| Phase | Criteria |
|-------|----------|
| Phase 1 | Files copied, package.json updated |
| Phase 2 | `pnpm install` succeeds, no conflicts |
| Phase 3 | All CLI commands work, Remotion Studio runs |
| Phase 4 | Documentation accurate for monorepo context |

## Notes

This is primarily a migration task, not new development. The code is already functional in oletizi/video-control. The work is adapting it to the monorepo structure while preserving functionality.
