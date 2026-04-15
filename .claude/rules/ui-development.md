---
paths:
  - "modules/*/src/**/*.tsx"
  - "modules/*/src/**/*.css"
  - "modules/editor-core/**"
  - "modules/s330-editor/**"
  - "modules/roland-sxx0-editor/**"
  - "modules/akai-s3k-editor/**"
---

# Design System

**Read [DESIGN-SYSTEM.md](/DESIGN-SYSTEM.md) before building or modifying any UI component, dialog, layout, or shared interface.** It is the single source of truth for:

- **Typed capability contracts** — ErrorReporter, RefreshNotifier, ProgressReporter, StrategyResult. No bare `onError?` callbacks; use the typed interfaces.
- **Dialog components** — which component to use for confirmations, progress, forms, renames. Never use `window.confirm`, `window.alert`, or `window.prompt`.
- **Tree capability interfaces** — TreeSelectionCapability, TreeEditCapability, TreeContextMenuCapability, TreeDragCapability, TreeRenderCapability. No bare callback bags on tree components.
- **Layout conventions** — flex ratios and design tokens only, no hardcoded pixel widths.
- **Contract enforcement rules** — compiler-enforced contracts, no optional callback bags, no duplicated types, loud failure over silent no-ops.

# Progress Indicators

All long-running operations must show consistent, rich progress indicators. Progress UI must include:

1. **Progress bar** — visual percentage of total bytes transferred
2. **Data transferred** — bytes sent / total bytes (e.g., "2.4 MB / 5.1 MB")
3. **Elapsed time** — time since operation started
4. **Estimated time remaining** — based on current transfer rate
5. **Current item name** — what's being processed right now
6. **Item count** (secondary) — items completed / total items (e.g., "3 / 10 samples") is useful context but must not be the primary progress metric since items vary wildly in size

Byte-based progress is the only meaningful primary measure.

**Consistency:** All progress indicators across the application must use the same layout, formatting, and fields. Define a shared progress component or type rather than ad-hoc progress UI per dialog.
