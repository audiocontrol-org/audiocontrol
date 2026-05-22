# Chevron sizing — one component, one CSS rule, one source of truth

Every disclosure / collapse / expand chevron in the editor MUST be
rendered via the `AcChevron` React component. There is exactly one
chevron CSS rule in the entire codebase (`.ac-chevron` in
`modules/editor-core/src/design/chevron-primitives.css`), and the
component is the only thing that emits it.

## The rule

**Do not write chevron CSS. Render the component.**

```tsx
import { AcChevron } from '@audiocontrol/editor-core';

<AcChevron expanded={isExpanded} />
```

The component owns the glyph (▾ / ▸), the 1.1rem square box, the
accent color, and the transition. None of those are exposed as
props — the abstraction is fully closed.

If your disclosure-toggle button needs a wrapper class (for cursor /
padding / hit-area chrome), name it after the wrapper's ROLE — e.g.,
`.ac-tree-disclosure-btn`, `.ac-list-bank-toggle`,
`.ac-device-memory-section-eyebrow` — and put the AcChevron inside.
**Never name a class after the glyph it wraps.** A class containing
the substring "chevron" anywhere outside the canonical file fails
the pre-commit gate.

## Why the rule has this exact shape

It was violated four+ times across sessions despite being documented
in memory (`feedback_chevron_size.md`) and in inline CSS comments.
Each violation reached the operator's browser because the prior
architecture had FOUR hand-coded chevron CSS classes
(`.ac-list-bank-chevron`, `.ac-tree-chevron`, `.ac-tree-chevron-btn`,
`.ac-device-memory-section-eyebrow-chevron`) that "agreed by
convention." The fourth violation (May 2026) was a 1rem drift on the
device-memory section eyebrow that the prior allow-list gate didn't
catch — the gate checked class NAMES, not VALUES, so an allow-listed
class could quietly drift without tripping anything.

The new architecture closes the pathology structurally:

1. **One CSS class** (`.ac-chevron`) in **one file** (chevron-primitives.css)
2. **One React component** (`AcChevron`) that emits that class
3. **A pre-commit gate** (`tools/check-chevron-sizing.sh`) that fails
   the build if any other CSS file declares a class containing the
   substring "chevron"

Agents physically cannot author a divergent chevron without removing
the gate or editing the canonical file — and either of those needs
explicit operator approval because the diff is obvious.

## What this gate does NOT catch

- **Misuse of the component** — e.g., shrinking the rendered glyph
  via a parent-container `font-size:` override that cascades into
  `.ac-chevron`. If you encounter this pattern in the wild, add a
  unit test that asserts `getComputedStyle(chevron).fontSize ===
  '17.6px'` (1.1rem at the default 16px root).
- **Visual regressions where the chevron is the right size but the
  contrast is wrong** (e.g., accent-on-accent background). Verify
  visually with a Playwright screenshot when shipping changes that
  touch chevron-bearing surfaces.
- **The home-page `.marker` glyph** inside native `<details>` /
  `<summary>` elements. That glyph stays a separate name + rule
  because the native `<details>` element can't mount a React
  component as its marker without converting the disclosure to a
  controlled component. The exception is documented at its
  declaration site in `_shared.css`. **Do not pattern off it for
  editor surfaces.**

## Process discipline when working on a disclosure UI

1. Need a disclosure chevron in JSX? Import AcChevron:
   ```tsx
   import { AcChevron } from '@audiocontrol/editor-core';
   ```
2. Need a wrapping toggle? Name it after its role
   (`.ac-foo-toggle`, `.ac-bar-disclosure-btn`). The class may NOT
   contain the substring "chevron". The gate enforces this.
3. After any change touching a disclosure surface, run
   `make check-chevron-sizing` (the gate runs in pre-commit anyway,
   but local verification saves a round-trip).
4. After any change that changes which class wraps the chevron,
   re-screenshot the affected pages per the CSS refactor protocol
   (`.claude/rules/css-refactor.md`).

## Files involved

- `modules/editor-core/src/components/AcChevron.tsx` — the component
- `modules/editor-core/src/design/chevron-primitives.css` — the lone CSS rule
- `tools/check-chevron-sizing.sh` — the pre-commit gate
- `Makefile` — `check-chevron-sizing` target wired into the build
