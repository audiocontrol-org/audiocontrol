# Editor-Core Shared Library - Workplan

**GitHub Milestone:** [Week of Feb 17-21](https://github.com/audiocontrol-org/audiocontrol/milestone/3)
**GitHub Issues:**

- [Parent: [editor-core] Shared editor infrastructure (#27)](https://github.com/audiocontrol-org/audiocontrol/issues/27)
- [Create editor-core module scaffold (#28)](https://github.com/audiocontrol-org/audiocontrol/issues/28)
- [Implement createMidiStore factory (#29)](https://github.com/audiocontrol-org/audiocontrol/issues/29)
- [Create MidiConnectionPage component (#30)](https://github.com/audiocontrol-org/audiocontrol/issues/30)
- [Add shared MidiPortSelector (#31)](https://github.com/audiocontrol-org/audiocontrol/issues/31)
- [Add shared ParameterSlider with formatters (#32)](https://github.com/audiocontrol-org/audiocontrol/issues/32)
- [Add shared CollapsibleSection (#33)](https://github.com/audiocontrol-org/audiocontrol/issues/33)
- [Create design system tokens (#34)](https://github.com/audiocontrol-org/audiocontrol/issues/34)
- [Migrate JV-1080 to EditorLayout (#35)](https://github.com/audiocontrol-org/audiocontrol/issues/35)
- [Migrate JV-1080 to Tailwind CSS (#36)](https://github.com/audiocontrol-org/audiocontrol/issues/36)
- [Standardize BrowserRouter placement (#37)](https://github.com/audiocontrol-org/audiocontrol/issues/37)
- [Parent: [editor-core] Harden shared design system across editors (#39)](https://github.com/audiocontrol-org/audiocontrol/issues/39)
- [Normalize shared control and state styling across editor pages (#40)](https://github.com/audiocontrol-org/audiocontrol/issues/40)
- [Document visual regression checklist for editor design system (#41)](https://github.com/audiocontrol-org/audiocontrol/issues/41)
- [Standardize full-height layout and scroll-region contracts (#42)](https://github.com/audiocontrol-org/audiocontrol/issues/42)
- [Implement shared page-shell primitives and migrate S-330 pages (#43)](https://github.com/audiocontrol-org/audiocontrol/issues/43)
- [Adopt hardened editor-core primitives in D-110 and JV-1080 (#44)](https://github.com/audiocontrol-org/audiocontrol/issues/44)
- [Define semantic color token map for editor-core (#45)](https://github.com/audiocontrol-org/audiocontrol/issues/45)

## Technical Approach

Extract common patterns from S-330 and D-110 editors into a shared `@audiocontrol/editor-core` package. Use S-330 as the reference implementation since it's the most mature. Apply shared components to JV-1080 first (greenfield), then migrate S-330 and D-110.

**Reference implementations:**
- MIDI store: `modules/s330-editor/src/stores/midiStore.ts`
- MidiPortSelector: `modules/s330-editor/src/components/connection/MidiPortSelector.tsx`
- HomePage: `modules/s330-editor/src/pages/HomePage.tsx`
- ParameterSlider: `modules/d110-editor/src/components/ui/ParameterSlider.tsx`
- CollapsibleSection: `modules/d110-editor/src/components/tone-editor/PartialEditor.tsx` (inline)

## Implementation Phases

### Phase 1: Immediate Fixes (P1)

Address quick wins identified in cross-editor review with minimal shared infrastructure.

**Issues:**
- [#35 Migrate JV-1080 to EditorLayout](https://github.com/audiocontrol-org/audiocontrol/issues/35)
- [#37 Standardize BrowserRouter placement](https://github.com/audiocontrol-org/audiocontrol/issues/37)

**Tasks:**
- Migrate JV-1080 to use EditorLayout from editor-tools
- Standardize BrowserRouter placement (move to main.tsx in D-110)
- Add sendPanic method to JV-1080 midiStore

**Success criteria:**
- JV-1080 has consistent header, navigation, and build info display
- All editors have BrowserRouter in main.tsx
- All editors have sendPanic method in MIDI store

### Phase 2: Module Scaffold and Shared Stores (P2)

Create the editor-core package and implement the createMidiStore factory.

**Issues:**
- [#28 Create editor-core module scaffold](https://github.com/audiocontrol-org/audiocontrol/issues/28)
- [#29 Implement createMidiStore factory](https://github.com/audiocontrol-org/audiocontrol/issues/29)

**Tasks:**
- Create `modules/editor-core` package structure
- Implement createMidiStore factory function
- Add unit tests for MIDI store factory
- Export from package index

**Success criteria:**
- `pnpm --filter @audiocontrol/editor-core build` succeeds
- createMidiStore accepts device configuration and returns typed store
- Tests verify store behavior for connection, disconnect, and device ID changes

### Phase 3: Shared Connection Components (P2)

Implement the config-driven connection page and port selector.

**Issues:**
- [#30 Create MidiConnectionPage component](https://github.com/audiocontrol-org/audiocontrol/issues/30)
- [#31 Add shared MidiPortSelector](https://github.com/audiocontrol-org/audiocontrol/issues/31)

**Tasks:**
- Create MidiConnectionPage component
- Create MidiPortSelector component (Radix-based)
- Add browser compatibility warnings
- Add SysEx and secure context warnings
- Add device ID selector with configurable range

**Success criteria:**
- MidiConnectionPage renders correctly with device-specific config
- Port selector shows available MIDI ports
- All warnings display appropriately based on browser state

### Phase 4: Shared UI Components (P2)

Add remaining shared components for parameter editing.

**Issues:**
- [#32 Add shared ParameterSlider with formatters](https://github.com/audiocontrol-org/audiocontrol/issues/32)
- [#33 Add shared CollapsibleSection](https://github.com/audiocontrol-org/audiocontrol/issues/33)

**Tasks:**
- Create ParameterSlider component
- Add formatter utilities (formatPercent, formatSigned, formatPan, formatKeyfollow, formatPitch)
- Create CollapsibleSection component
- Add cn() utility (Tailwind merge)

**Success criteria:**
- ParameterSlider supports min/max/step with custom formatters
- All formatters produce correct output for edge cases
- CollapsibleSection animates open/close correctly

### Phase 5: Design System Tokens (P3)

Establish CSS variable foundation for consistent theming.

**Issues:**
- [#34 Create design system tokens](https://github.com/audiocontrol-org/audiocontrol/issues/34)
- [#36 Migrate JV-1080 to Tailwind CSS](https://github.com/audiocontrol-org/audiocontrol/issues/36)

**Tasks:**
- Create base CSS variables for colors, spacing, typography
- Create device-specific theme overrides (S-330, D-110, JV-1080)
- Migrate JV-1080 to Tailwind CSS

**Success criteria:**
- CSS variables available in all editor builds
- Each editor has device-specific accent colors
- JV-1080 uses Tailwind classes instead of vanilla CSS

### Phase 6: Editor Migration

Migrate existing editors to use shared components.

**Tasks:**
- Update JV-1080 to use editor-core components
- Update S-330 to use editor-core components (optional, stretch)
- Update D-110 to use editor-core components (optional, stretch)

**Success criteria:**
- At least JV-1080 fully migrated to shared components
- No regression in existing editor functionality
- Reduced code duplication measurable via line count

### Phase 7: Design-System Hardening (New)

Convert current token + primitive baseline into an enforceable cross-editor design system.

**Issues:**
- [#39 Parent: Harden shared design system across editors](https://github.com/audiocontrol-org/audiocontrol/issues/39)
- [#45 Define semantic color token map for editor-core](https://github.com/audiocontrol-org/audiocontrol/issues/45)
- [#43 Implement shared page-shell primitives and migrate S-330 pages](https://github.com/audiocontrol-org/audiocontrol/issues/43)
- [#40 Normalize shared control and state styling across editor pages](https://github.com/audiocontrol-org/audiocontrol/issues/40)
- [#42 Standardize full-height layout and scroll-region contracts](https://github.com/audiocontrol-org/audiocontrol/issues/42)
- [#44 Adopt hardened editor-core primitives in D-110 and JV-1080](https://github.com/audiocontrol-org/audiocontrol/issues/44)
- [#41 Document visual regression checklist for editor design system](https://github.com/audiocontrol-org/audiocontrol/issues/41)

**Tasks:**
- Promote color tokens to semantic roles and remove page-level hardcoded status/action colors.
- Standardize page-shell primitives and default spacing rules across all S-330 pages.
- Normalize reusable controls (button/chip/input/select) and section typography hierarchy.
- Define explicit rules for full-height layout and nested scrolling regions.
- Migrate D-110 and JV-1080 page shells to the same primitives after S-330 baseline is stable.
- Migrate `s330` and `d110` Tailwind color definitions to shared CSS variable-backed tokens.
- De-duplicate local `.btn/.btn-primary/.btn-secondary/.input/.label` definitions where shared primitives exist.
- Add missing token contracts for motion and typography rhythm (line-height/weight scale).
- Add lightweight visual regression checklist for representative pages (`Connect`, `Play`, `Patches`, `Tones`).

**Success criteria:**
- Page spacing and container rhythm are consistent by default across all S-330 pages.
- Shared semantic colors map consistently to `active/selected/connected/warn/danger` states.
- Equivalent controls render consistently across S-330, D-110, and JV-1080.
- `s330` and `d110` Tailwind theme colors read from shared CSS variable tokens.
- Local editor CSS primarily defines theme identity, not duplicated structure.

### Phase 8: Component Abstraction Follow-up (Post-Phase 7)

Defer higher-order React abstraction work until visual/token consistency is complete.

**Issue:**
- [#46 Add shared SelectableList abstraction for editor list UIs](https://github.com/audiocontrol-org/audiocontrol/issues/46)

**Tasks:**
- Evaluate common list interaction behavior across S-330 and D-110.
- Extract shared `SelectableList` abstraction in `editor-core` if convergence is stable.
- Migrate list callsites with no behavior regression.

**Success criteria:**
- Shared list behaviors are consistent (selection, loading, empty states, keyboard affordances).
- List UIs reduce local duplicated rendering logic.

## Issue Decomposition

Child issues created under parent #27:

1. [#28 Create editor-core module scaffold](https://github.com/audiocontrol-org/audiocontrol/issues/28)
2. [#29 Implement createMidiStore factory](https://github.com/audiocontrol-org/audiocontrol/issues/29)
3. [#30 Create MidiConnectionPage component](https://github.com/audiocontrol-org/audiocontrol/issues/30)
4. [#31 Add shared MidiPortSelector](https://github.com/audiocontrol-org/audiocontrol/issues/31)
5. [#32 Add shared ParameterSlider with formatters](https://github.com/audiocontrol-org/audiocontrol/issues/32)
6. [#33 Add shared CollapsibleSection](https://github.com/audiocontrol-org/audiocontrol/issues/33)
7. [#34 Create design system tokens](https://github.com/audiocontrol-org/audiocontrol/issues/34)
8. [#35 Migrate JV-1080 to EditorLayout](https://github.com/audiocontrol-org/audiocontrol/issues/35)
9. [#36 Migrate JV-1080 to Tailwind CSS](https://github.com/audiocontrol-org/audiocontrol/issues/36)
10. [#37 Standardize BrowserRouter placement](https://github.com/audiocontrol-org/audiocontrol/issues/37)
11. [#39 Parent: Harden shared design system across editors](https://github.com/audiocontrol-org/audiocontrol/issues/39)
12. [#40 Normalize shared control and state styling across editor pages](https://github.com/audiocontrol-org/audiocontrol/issues/40)
13. [#41 Document visual regression checklist for editor design system](https://github.com/audiocontrol-org/audiocontrol/issues/41)
14. [#42 Standardize full-height layout and scroll-region contracts](https://github.com/audiocontrol-org/audiocontrol/issues/42)
15. [#43 Implement shared page-shell primitives and migrate S-330 pages](https://github.com/audiocontrol-org/audiocontrol/issues/43)
16. [#44 Adopt hardened editor-core primitives in D-110 and JV-1080](https://github.com/audiocontrol-org/audiocontrol/issues/44)
17. [#45 Define semantic color token map for editor-core](https://github.com/audiocontrol-org/audiocontrol/issues/45)
18. [#46 Add shared SelectableList abstraction for editor list UIs](https://github.com/audiocontrol-org/audiocontrol/issues/46)

## Verification Checklist

- [x] `pnpm --filter @audiocontrol/editor-core build`
- [x] `pnpm --filter @audiocontrol/editor-core test`
- [x] JV-1080 uses EditorLayout with consistent header
- [x] JV-1080 uses Tailwind CSS
- [x] D-110 has BrowserRouter in main.tsx
- [x] All editors have sendPanic method
- [x] Feature docs updated with implementation notes
- [x] Semantic color token map applied to shared status/action elements in editor-core primitives
- [x] Shared page-shell primitives adopted by all S-330 editor pages
- [x] `s330` and `d110` Tailwind configs use shared CSS variable token mappings
- [x] Local control utility duplication reduced where shared primitives cover usage
- [x] Motion and typography rhythm tokens added to editor-core token contract
- [ ] Cross-editor visual consistency pass completed for representative pages
