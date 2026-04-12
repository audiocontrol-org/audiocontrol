# Design System

Living documentation of the audiocontrol design system. Updated as contracts and patterns are established.

---

## Typed Capability Contracts

Shared hooks and components accept typed capability interfaces, not bare callbacks. The compiler enforces that consumers provide the required capabilities.

### ErrorReporter

**File:** `editor-core/src/hooks/useErrorReporter.ts`

Every error is logged to console AND displayed in the UI. Individual call sites cannot opt out of logging.

```typescript
import { useErrorReporter, type ErrorReporter } from '@audiocontrol/editor-core';

interface ErrorReporter {
  report(message: string): void;
}

// Usage: pass the ErrorReporter to any hook that can fail
const errorReporter = useErrorReporter(setError);
```

**Rule:** Every shared hook that can fail must accept `ErrorReporter` as a required parameter. No bare `onError?: (msg: string) => void` callbacks.

### RefreshNotifier

**File:** `editor-core/src/hooks/useRefreshNotifier.ts`

Typed capability for triggering data refresh after mutations.

```typescript
import { useRefreshNotifier, type RefreshNotifier } from '@audiocontrol/editor-core';

interface RefreshNotifier {
  notifyRefresh(): void;
}

const refreshNotifier = useRefreshNotifier(handleRefresh);
```

### ProgressReporter

**File:** `editor-core/src/hooks/useProgressReporter.ts`

Structured progress data flows through a single contract. Uses `OperationProgress` for byte-weighted progress tracking.

```typescript
import { useProgressReporter, type ProgressReporter } from '@audiocontrol/editor-core';
import type { OperationProgress } from '@audiocontrol/editor-core';

interface ProgressReporter {
  report(progress: OperationProgress): void;
}

const progressReporter = useProgressReporter(setProgress);
```

### StrategyResult

**File:** `editor-core/src/hooks/useLibraryOperations.ts`

Discriminated union replacing boolean returns. Distinguishes "I handled it" from "not my responsibility" without ambiguity.

```typescript
import type { StrategyResult } from '@audiocontrol/editor-core';

type StrategyResult = { handled: true } | { handled: false };

// In a LibraryOperationsStrategy implementation:
async deleteItem(categoryId: string, node: TreeNode): Promise<StrategyResult> {
  if (categoryId !== 'my-category') return { handled: false };
  await doDelete(node);
  return { handled: true };
}
```

**Rule:** Never use `boolean` as a strategy dispatch return. `true`/`false` conflates "not applicable" with "failed silently."

---

## Dialog Components

All dialogs live in `editor-core/src/components/library/`.

| Component | When to Use |
|-----------|-------------|
| **ConfirmDialog** | Destructive actions: delete, overwrite, discard changes |
| **SlideDrawer** | Complex forms, multi-field input, configuration panels |
| **SteppedProgressDrawer** | Multi-step operations: device transfers, batch imports/exports |
| **SaveDialog** | Save-to-library with directory picker and name input |
| **MoveDialog** | Relocate items within the library tree |

### Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `window.confirm()` | `ConfirmDialog` |
| `window.alert()` | Toast notification via `useNotifications` |
| `window.prompt()` | Inline editing or `SlideDrawer` |
| Custom modal for progress | `SteppedProgressDrawer` |

---

## Notifications

**File:** `editor-core/src/hooks/useNotifications.ts`

```typescript
import { useNotifications } from '@audiocontrol/editor-core';

const { notify, dismiss, clearAll, notifications } = useNotifications();

notify({ level: 'info', message: 'Sample uploaded' });    // auto-dismiss 5s
notify({ level: 'error', message: 'Transfer failed' });   // persists until dismissed
```

Render with `NotificationArea` component (`editor-core/src/components/NotificationArea.tsx`).

---

## Progress Indicators

**File:** `editor-core/src/types/operation-progress.ts`

All long-running operations use `OperationProgress` for byte-weighted progress:

```typescript
interface OperationProgress {
  currentStep: number;          // 1-based
  totalSteps: number;
  stepLabel: string;            // e.g., "Uploading KICK1"
  bytesSent: number;            // current step
  bytesTotal: number;           // current step
  bytesSentAllSteps: number;    // all prior steps
  bytesTotalAllSteps: number;   // entire operation
}
```

Helpers: `getOverallPercent(progress)`, `isOperationComplete(state)`, `formatBytes(bytes)`.

**Rule:** Byte-based progress is the primary measure. Item counts are secondary context.

---

## Layout Conventions

### CSS Design Tokens

All tokens use the `--ac-` prefix. Defined in `editor-core/src/design/tokens.css`.

- **Colors:** `--ac-color-surface-canvas`, `--ac-color-accent`, `--ac-color-danger`, `--ac-status-*`
- **Spacing:** `--ac-space-{1-8}`
- **Typography:** `--ac-text-{xs-lg}`, `--ac-font-weight-*`
- **Motion:** `--ac-duration-{fast-slow}`, `--ac-easing-default`

### Layout Rules

| Do | Don't |
|----|-------|
| Flex ratios (`flex: 1`, `flex: 2`) | Hardcoded pixel widths (`width: 300px`) |
| Grid fractions (`1fr 2fr`) | Fixed column widths |
| `rem` for minimum constraints | `px` for layout dimensions |
| CSS custom properties | Magic numbers |
| `--ac-space-*` tokens for spacing | Arbitrary pixel padding |

### Component CSS

All components use `.ac-` prefixed class names. Defined in `editor-core/src/design/`:
- `tokens.css` — design tokens
- `primitives.css` — page layouts, sticky headers, grid patterns
- `library.css` — tree view, modals, drawers, forms, buttons

---

## Contract Enforcement Rules

1. **Every shared interface change must break consumers at compile time.** If you add a required field and no editor breaks, the type isn't actually shared.

2. **No optional bags of callbacks.** Group related callbacks into capability interfaces. If a UI element appears, its handler must be required.

3. **Types exist once.** If the same type is defined in two files, one must go. Move to the lowest common ancestor.

4. **Loud failure over silent no-ops.** An action that silently does nothing is a bug. Either the action should not appear, or it should throw.

5. **Build all editors before committing.** `make` verifies that shared contract changes compile everywhere.
