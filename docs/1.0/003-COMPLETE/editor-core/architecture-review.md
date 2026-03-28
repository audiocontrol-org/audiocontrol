# Design System Architecture Review

**Date:** 2026-02-17
**Scope:** Review of unified design system plan and implementation

## Executive Summary

The design system plan is **well-structured and pragmatic**. The phased approach, CSS-first foundation, and implementation progress (Phases 1-6 complete, Phase 7 in progress) demonstrate solid architectural thinking. This review identifies strengths and areas that warrant attention.

## Current State

| Layer | Status | Location |
|-------|--------|----------|
| Design Tokens | Implemented | `editor-core/src/design/tokens.css` |
| Layout Primitives | Implemented | `editor-core/src/design/primitives.css` |
| Shared Components | 4 components | `MidiConnectionPage`, `ParameterSlider`, `MidiPortSelector`, `CollapsibleSection` |
| Theme System | Working | `data-editor` attribute switches token values |
| Cross-Editor Adoption | Partial | All 3 editors import tokens; primitive adoption varies |

### Metrics

- ~73% reduction in duplicated code (from ~1,100 to ~300 lines)
- MIDI store: ~85% reduction per editor
- Connection page: ~61% reduction per editor

## Architectural Strengths

### 1. CSS-First Token System

The decision to use CSS custom properties rather than JS-based theming is correct:

- **Framework agnostic** - Works with Tailwind, Radix UI, and plain CSS
- **No runtime cost** - Browser-native variable resolution
- **Easy theme switching** - `data-editor` attribute is elegant
- **Gradual adoption** - Editors can adopt incrementally

### 2. Semantic Token Layering

The two-layer token architecture is sound:

```css
/* Base tokens */
--ac-color-success: #4ade80;

/* Semantic aliases */
--ac-status-connected: var(--ac-color-success);
```

This allows meaning to change independent of color values.

### 3. Primitive Composition Model

The CSS class primitives (`.ac-page`, `.ac-card`, `.ac-list-detail-grid`) are composable rather than monolithic. This avoids the "mega-component" anti-pattern common in design systems.

### 4. Config-First Component API

The `MidiConnectionPage` and `createMidiStore` APIs accept configuration rather than requiring inheritance. This aligns with the project's composition-over-inheritance guidelines.

### 5. Phased Rollout

The 4-phase plan (Foundation, Layout, Components, Adoption) follows a proven bottom-up pattern. You can't standardize components before standardizing the tokens they consume.

## Areas of Concern

### 1. Tailwind/Token Duplication (Medium Risk)

**Problem:** Editors define Tailwind color palettes (`s330-*`, `d110-*`) that duplicate token values:

```js
// S-330 tailwind.config.ts
s330: {
  bg: '#0f172a',        // duplicates --ac-color-surface-canvas
  panel: '#1e293b',     // duplicates --ac-color-surface-panel
}
```

**Risk:** Token updates in `tokens.css` won't propagate to Tailwind classes.

**Recommendation:** Migrate Tailwind configs to reference CSS variables:

```js
s330: {
  bg: 'var(--ac-color-surface-canvas)',
  panel: 'var(--ac-color-surface-panel)',
}
```

JV-1080 already does this correctly.

### 2. Button/Control Class Duplication (Medium Risk)

**Problem:** `.btn`, `.btn-primary`, `.input`, `.label` are defined in both `primitives.css` (as `.ac-btn`, `.ac-input`) AND in each editor's `index.css`.

**Risk:** Two sources of truth for button styling.

**Recommendation:** Remove local button/input definitions and alias or replace with shared classes:

```css
/* In editor index.css - alias to shared */
.btn { @apply ac-btn; }
/* Or: find/replace all .btn to .ac-btn */
```

### 3. No Component-Level Abstraction for Lists (Low-Medium Risk)

**Problem:** PatchList, ToneList, PartSelector share 90% structure but have no shared React component.

**Risk:** Behavior divergence (keyboard nav, empty states, loading states) as editors evolve.

**Recommendation:** Consider adding a shared component:

```tsx
export function SelectableList<T>({
  items, selectedId, onSelect, renderItem, emptyMessage
}: SelectableListProps<T>)
```

### 4. No Motion/Animation Tokens

**Problem:** The plan mentions motion tokens but `tokens.css` has none.

**Risk:** Inconsistent transitions (various durations and easings).

**Recommendation:** Add motion tokens:

```css
--ac-duration-fast: 150ms;
--ac-duration-normal: 250ms;
--ac-easing-default: cubic-bezier(0.4, 0, 0.2, 1);
```

### 5. Typography Tokens Incomplete

**Problem:** Font sizes exist but line-height, letter-spacing, and font weights are not tokenized.

**Recommendation:** Complete the typography scale:

```css
--ac-leading-tight: 1.25;
--ac-leading-normal: 1.5;
--ac-font-weight-normal: 400;
--ac-font-weight-semibold: 600;
--ac-font-weight-bold: 700;
```

## Phase 7 Status Assessment

| Issue | Severity | Status |
|-------|----------|--------|
| Page top margin inconsistency | Fixed | `.ac-page` wrapper deployed |
| Content width variance | Partial | `.ac-container-md` exists; adoption incomplete |
| Card treatment divergence | In progress | `.ac-card` exists; adoption incomplete |
| Typography hierarchy | Not started | Need `.ac-title-xl`, `.ac-subtitle` |
| Control styling inconsistency | Not started | Button/input duplication unresolved |
| Scroll behavior variance | In progress | `.ac-scroll-list` deployed |
| Color semantic inconsistency | Partial | Status colors tokenized; accent usage varies |

## Recommendations

### Immediate (Phase 7 Completion)

1. **Eliminate button/input duplication** - Remove local `.btn`/`.input` from editor `index.css` files
2. **Migrate S-330/D-110 Tailwind configs** - Use CSS variable references like JV-1080
3. **Add motion tokens** - Define standard transition durations and easings
4. **Apply `.ac-container-md`** to Connect pages for width consistency

### Short-term (Post-Phase 7)

1. **Add list component abstraction** - Extract `SelectableList` for Patches/Tones/Parts
2. **Complete typography tokens** - Line-height, letter-spacing, font-weight
3. **Document component patterns** - Create visual reference for correct primitive usage

### Long-term

1. **Consider Storybook** - Visual documentation as component count grows
2. **Visual regression automation** - Playwright or similar for screenshot comparison
3. **Lint rules** - ESLint/Stylelint rules to catch hardcoded colors

## Overall Assessment

**Grade: B+**

The design system plan is architecturally sound. The CSS-first approach, semantic token layering, and phased rollout are correct decisions. The identified gaps are adoption and completion issues, not fundamental architectural flaws. Phase 7 can address most concerns.

## References

- [Design System Plan](./design-system-plan.md)
- [Implementation Summary](./implementation-summary.md)
- [PRD](./prd.md)
- `modules/editor-core/src/design/tokens.css`
- `modules/editor-core/src/design/primitives.css`
