# Editor-Core Design System Plan

**Status:** In Progress  
**Last Updated:** 2026-02-17

## Objective

Create a robust, reusable design system in `@audiocontrol/editor-core` that enforces consistent layout, spacing, typography, color semantics, and interaction states across:

- all pages within an editor
- all editor modules (S-330, D-110, JV-1080, and future editors)

## Findings Driving This Plan

Current inconsistency hotspots observed in S-330 and shared components:

- Page spacing and top margin behavior are not uniformly applied.
- Containers and content widths vary by page without clear rules.
- Card, border, and radius treatments diverge by local implementation.
- Typography hierarchy is inconsistent for page, section, and helper text levels.
- Color usage is inconsistent for the same semantic meanings (active, selected, warning, danger, connected).
- Scroll behavior and content panel sizing differ by page type.

## Target Architecture

Design system layers (owned by `editor-core`):

1. Foundations:
   - tokens for color, spacing, typography, radius, elevation, z-index, motion
   - semantic token mapping (`--ac-color-surface-1`, `--ac-color-accent`, `--ac-color-danger`, etc.)
2. Primitives:
   - layout primitives (`Page`, `Container`, `Stack`, `Grid`, `SplitPane`)
   - surface primitives (`Card`, `Panel`, `Inset`)
   - text primitives (`Title`, `SectionTitle`, `Body`, `Muted`)
3. Controls:
   - standardized buttons, chip/toggle groups, inputs/selects, sliders, badges, status indicators
4. Patterns:
   - connection screen scaffold
   - list-detail editor scaffold (patches/tones style)
   - control table scaffold (play/mixer style)

## Implementation Phases

### Phase A: Foundation Hardening

- Expand token set from base values to semantic roles.
- Define editor theme mappings from semantic roles to editor-specific palette.
- Publish token contract and naming rules in docs.

Success criteria:

- No page-level hardcoded color literals for standard UI semantics.
- Shared semantic tokens imported in every editor entrypoint.

### Phase B: Layout System Standardization

- Add shared page-shell primitives with default spacing and max-width rules.
- Add reusable section/panel spacing utilities with documented defaults.
- Define and enforce viewport and scroll rules for full-height editor shells.

Success criteria:

- `Connect`, `Play`, `Patches`, and `Tones` use the same top-offset and page-shell contract by default.
- Layout deviations require explicit local override with documented rationale.

### Phase C: Component Consistency

- Migrate key S-330 page-local components to shared primitives/controls.
- Normalize tab/chip/button states and sizes.
- Standardize field labels, helper text, and form spacing rhythm.

Success criteria:

- Equivalent UI elements render with same spacing, typography, and state styling across pages.
- Shared components cover at least 80% of repeated page-level patterns.

### Phase D: Cross-Editor Adoption

- Apply same primitives and semantic colors to D-110 and JV-1080 pages.
- Remove duplicated local CSS utilities superseded by shared primitives.
- Add regression checklist/screenshots for representative pages in each editor.

Success criteria:

- Visual consistency checks pass across S-330, D-110, and JV-1080 for shared interaction patterns.
- Local editor CSS is mostly theme overrides, not structural duplication.

## Governance

- `editor-core` is the single owner of shared visual primitives.
- New editor UI should consume primitives first and only then add editor-local extensions.
- Visual contract changes require:
  - update to this plan and implementation summary
  - screenshot validation in at least S-330 + one other editor

## Immediate Next Steps

1. Migrate `s330` and `d110` Tailwind color themes to CSS variable-backed token mappings.
2. Reduce local duplicated control utility classes (`.btn/.input/.label`) where shared primitives cover behavior.
3. Add motion and typography rhythm tokens to `tokens.css` and use them in shared primitives.
4. Execute and document the visual regression checklist for `Connect`, `Play`, `Patches`, and `Tones`.
