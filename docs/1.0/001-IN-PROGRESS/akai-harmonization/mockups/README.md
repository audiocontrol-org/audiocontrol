# Akai Harmonization — Mockups

HTML mockups for the akai-harmonization Phase 1 design audit. Each file is a standalone HTML document — open in a browser directly, no build step.

| File | Page | Spec section |
|---|---|---|
| [`programs.html`](./programs.html) | ProgramsPage | [§ 4.1](../harmonization-spec.md#41-programspage--mockupsprogramshtml) |
| [`keygroups.html`](./keygroups.html) | KeygroupsPage | [§ 4.2](../harmonization-spec.md#42-keygroupspage--mockupskeygroupshtml) |
| [`samples.html`](./samples.html) | SamplesPage | [§ 4.3](../harmonization-spec.md#43-samplespage--mockupssampleshtml) |
| [`library.html`](./library.html) | LibraryPage | [§ 4.4](../harmonization-spec.md#44-librarypage--mockupslibraryhtml) |

Shared stylesheet: [`akai-dialect.css`](./akai-dialect.css) — token overrides (palette / typography / front-panel chassis) plus the dialect-shared primitive styles.

## What these mockups prove

- The akai surface CAN be expressed as a token-only difference from the roland surface for everything except the virtual front panel grid layout.
- The chrome (PageTitleRow, AcRadioTabs, AcEnvelope, AcRangeBar, live-edit footer, chunky-button front panel) is structurally identical between editors.
- The amber LCD glow, cream silkscreen, warm-black chassis, and `Major Mono Display / Sora / Share Tech Mono` typography together read as the S3000XL aesthetic without forking any structural primitive.

## What they don't claim

These are **mockups**, not screenshots of the live app. The akai editor's current state is NOT this yet — Phase 2 implementation lands the actual migration. The mockups are the proof-of-design Phase 2 implementers cite for each `canonical_side` decision.

The screenshots required by workplan task 1.3 (baseline captures of the CURRENT akai pages) still need to be taken against the live dev server — they're the BEFORE side of the post-Phase-2 visual regression diff.

## Validation

Open each file in a browser. Confirm:

1. The page title row sits at the top with an amber accent rule beneath it (left-aligned 4 rem segment).
2. The list column on the left and the detail column on the right both scroll independently (the document does not scroll as one tall page).
3. The detail column shows a tab row above the body, with one tab highlighted.
4. The detail body's last row is a live-edit footer with a pulsing amber LED dot.
5. The virtual front panel at the bottom shows an amber LCD readout + 8 soft-function keys + 4 mode buttons + a 4×3 numeric keypad. The active mode button has an amber LED dot at its top-left corner.
6. The amber LCD readouts have a soft text-shadow glow.

If any of those fail, the dialect contract isn't holding — file a defect with a screenshot.
