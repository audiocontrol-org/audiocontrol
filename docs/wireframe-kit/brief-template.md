---
proposal: <short title>
status: DRAFT
date: YYYY-MM-DD
feature: docs/1.0/<status>/<feature-slug>/
visual: self-contained: ./mockup.html
derived_from: <which current as-built page/state this sketch starts from>
design_language: docs/design-language/<editor>.md
---

# <title>

> **This is a lo-fi, hand-drawn wireframe.** It specifies **UX only** —
> layout, flow, information hierarchy. It carries **no visual style**.
> Visual/component fidelity is decided in the real components and the
> per-editor design language, never in a mockup. The sketch links only
> `docs/wireframe-kit/sketch-kit.css` (the `check-mockup-lofi` gate
> enforces this).

## What UX does this sketch explore
<The layout / flow / hierarchy change. Describe the structure and the
interaction, not the look.>

## Derived from (current as-built)
<Name the current page/state this wireframe departs from — e.g. "Roland
TonesPage FILTER tab at `/roland/s330/editor/tones`". This is the
structural anchor: it lets a reviewer tell an INTENDED UX change from an
accidental omission. Low-stakes, because a hand-drawn sketch can't be
mistaken for visual direction.>

## Visual vocabulary
This sketch has no style of its own. The realized look comes from the
design language: [`docs/design-language/<editor>.md`](../../design-language/<editor>.md).
Anything that looks "styled" here is incidental to the hand-drawn kit, not
a spec.

## Why / decision
<Rationale. After operator review, record the decision (ACCEPTED / REJECTED)
in the frontmatter `status` and summarize the deciding factors here.>

## Feature reference
<Link to the feature dir.>
