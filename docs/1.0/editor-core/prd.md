# Editor-Core Shared Library - Product Requirements Document

**Created:** 2026-02-16
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol monorepo has three Roland web editors (S-330, D-110, JV-1080) with significant code duplication. A cross-editor review identified ~1,100 lines of duplicated code:

| Category | Duplicated Lines | Impact |
|----------|------------------|--------|
| MIDI stores | ~450 lines | 80%+ identical across all editors |
| MidiPortSelector | ~200 lines | Nearly identical in S-330/D-110 |
| HomePage/Connection | ~400 lines | Config-only differences |
| Utility functions | ~60 lines | cn(), formatters duplicated |
| **Total** | **~1,100 lines** | |

### Current State

- **S-330**: Most mature, uses EditorLayout from editor-tools, Tailwind CSS, comprehensive features
- **D-110**: Mature, uses EditorLayout, Tailwind CSS, full tone/partial editor
- **JV-1080**: Early scaffold, vanilla CSS, does not use EditorLayout, minimal features

### Key Issues

1. **High Code Duplication**: MIDI stores are 80%+ identical across all editors
2. **Inconsistent UI Components**: Each editor has its own MidiPortSelector, HomePage, and ParameterSlider
3. **Missed Shared Library Opportunities**: EditorLayout exists but JV-1080 does not use it
4. **Styling Fragmentation**: Three different CSS/theming approaches

## User Stories

- As a developer, I want shared infrastructure so I can build new editors faster without duplicating code.
- As a maintainer, I want consistent patterns across editors so bug fixes propagate to all devices.
- As a user, I want consistent UX across editors so I don't have to relearn each device's interface.

## Solution

Create a shared `@audiocontrol/editor-core` module containing:

1. **createMidiStore factory** - Shared MIDI connection logic with device-specific configuration
2. **MidiConnectionPage component** - Config-driven connection UI with warnings and device ID selection
3. **MidiPortSelector component** - Radix-based port selector with consistent styling
4. **ParameterSlider with formatters** - Slider component with common format utilities
5. **CollapsibleSection component** - Reusable collapsible panel
6. **Design system tokens** - CSS variables for theming with device-specific overrides

## Success Criteria

- [ ] 80% reduction in duplicated code across editors
- [ ] JV-1080 migrated to use EditorLayout from editor-tools
- [ ] JV-1080 migrated to Tailwind CSS
- [ ] All three editors use shared MidiConnectionPage component
- [ ] All three editors use shared createMidiStore factory
- [ ] Consistent theming via CSS variables across all editors
- [ ] Unit tests for shared components and utilities

## Scope

### In Scope

- Create `modules/editor-core` package structure
- Implement createMidiStore factory function
- Implement MidiConnectionPage config-driven component
- Add shared MidiPortSelector (Radix-based)
- Add shared ParameterSlider with formatters
- Add shared CollapsibleSection component
- Create CSS variable design tokens
- Migrate JV-1080 to EditorLayout
- Migrate JV-1080 to Tailwind CSS
- Standardize BrowserRouter placement in D-110

### Out of Scope

- Shared envelope visualization (P3 priority, requires more design)
- Device data store patterns (P3 priority, more complex)
- Migration of device-specific business logic
- New features for any individual editor

## Technical Approach

### createMidiStore Factory

```typescript
interface MidiStoreConfig<TClient> {
  deviceName: string;           // for storage keys and logging
  defaultDeviceId: number;
  deviceIdRange: { min: number; max: number };
  createClient?: (adapter: MidiIO, deviceId: number) => TClient;
  hasLegacyDeviceIdDisplay?: boolean;  // S-330 displays +1
}

export function createMidiStore<TClient>(config: MidiStoreConfig<TClient>) {
  return create<MidiStore>((set, get) => ({
    // Common implementation with config-driven variations
  }));
}
```

### MidiConnectionPage Component

```typescript
interface MidiConnectionPageConfig {
  deviceName: string;
  deviceIdConfig: {
    min: number;
    max: number;
    default: number;
    displayOffset?: number;
    helpText: string;
  };
  helpItems: HelpItem[];
  continueRoute: string;
  continueLabel: string;
}

export function MidiConnectionPage({ config, midiStore }) { ... }
```

### Proposed Package Structure

```
modules/editor-core/
  src/
    stores/
      createMidiStore.ts         # Factory for MIDI stores
    components/
      MidiConnectionPage.tsx     # Config-driven connection page
      MidiPortSelector.tsx       # Shared port selector
      ParameterSlider.tsx        # With formatters
      CollapsibleSection.tsx
    utils/
      formatters.ts              # MIDI value formatters
      cn.ts                      # Tailwind merge
    design/
      tokens.css                 # CSS variables
    index.ts                     # Public exports
```

## Dependencies

- `@audiocontrol/shared-midi` - MIDI types and interfaces
- `@audiocontrol/editor-tools` - EditorLayout and existing shared components
- `@radix-ui/react-select` - Port selector dropdown
- `@radix-ui/react-slider` - Parameter slider
- `zustand` - State management
- `tailwindcss` - Styling
- `clsx` and `tailwind-merge` - CSS utilities

## Constraints

- Must maintain backward compatibility during migration
- Must preserve device-specific behavior through configuration
- Must not introduce circular dependencies in monorepo
- Must follow existing TypeScript strict mode conventions
- Must maintain test coverage for shared code

## Open Questions

- [ ] Should design tokens be in a separate `@audiocontrol/design-system` package?
- [ ] Should we use CSS-in-JS or CSS variables for theming?
- [ ] What is the migration order for existing editors?

## Reference

- [Cross-Editor Review](../../../cross-editor-review.md) - Full analysis and recommendations
