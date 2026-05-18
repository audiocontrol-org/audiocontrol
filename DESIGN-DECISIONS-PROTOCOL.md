---
title: Audiocontrol Design Decisions — Protocol
status: load-bearing
last-updated: 2026-05-18
---

# Audiocontrol Design Decisions — Protocol

This document describes how design decisions are recorded in the audiocontrol repo. It exists because design decisions kept being relitigated. **If a direction has been ACCEPTED or REJECTED, the record below is the durable evidence.** Future sessions read the archive before drafting new mockups so we don't re-propose directions that have already had their fair hearing.

Ported from `deskwork/DESIGN-STANDARDS.md` § Proposal archive. The deskwork project carries an additional `DESIGN-STANDARDS.md` for *settled vocabulary* (tokens, typography, retired patterns); the audiocontrol equivalent isn't consolidated yet and isn't in scope for this document.

## Archive layout

Design archives live **per-feature**, alongside the feature's `explorations/` directory. Audiocontrol's `docs/` tree is organized by version + status + feature slug, so design decisions are scoped to the feature they support.

```
docs/<version>/<status>/<feature-slug>/explorations/
├── <misc explorations, single-direction sketches, screenshots>…
├── ACCEPTED/
│   └── <YYYY-MM-DD>-<slug>/
│       ├── brief.md                          # required
│       ├── mockup.html                       # canonical visual (or relative reference)
│       └── …                                 # any supporting assets
└── REJECTED/
    └── <YYYY-MM-DD>-<slug>/
        ├── brief.md                          # required
        ├── mockup.html
        └── …
```

`<YYYY-MM-DD>` is the date of the decision (acceptance or rejection), not the date the entry was filed retroactively. `<slug>` is short and describes the proposal, not the rationale.

Single-direction explorations (early sketches without a chosen-vs-discarded contrast) stay at the top of `explorations/` and don't need archive entries. Archive entries are for **decisions** — moments where one direction was picked over alternatives, or a direction was retired.

## What goes in `brief.md`

Every brief carries the same frontmatter + four sections:

```markdown
---
proposal: <short description>
status: ACCEPTED | REJECTED
date: YYYY-MM-DD
feature: <relative path to motivating feature dir, or N/A>
visual: <"self-contained: ./mockup.html", OR relative path to mockup elsewhere, OR "N/A — non-visual decision">
---

# <proposal>

## What

<one paragraph — what the proposal is. What pattern, what shape, what affordance.>

## Why <accepted | rejected>

<one to three paragraphs — the rationale. For ACCEPTED, what made this the right pick. For REJECTED, what made this the wrong direction or what made another direction better. Cite the operator's framing when it shaped the decision.>

## When

<commit SHA + date if known. The implementation commit for ACCEPTED; the decision-to-retire commit for REJECTED.>

## Feature reference

<link to the motivating feature dir, e.g. `docs/1.0/001-IN-PROGRESS/s550-support/`. The brief is a checkpoint; the feature dir is the working context.>
```

Frontmatter is the searchable index. The body is the explanation. Keep briefs short — a brief that runs to multiple pages is doing the standards doc's job by accident.

## Visual reference contract

Each entry MAY have a visual (HTML mockup, screenshot, diagram). Two valid shapes:

1. **Self-contained** — the visual file lives inside the entry directory (e.g. `mockup.html`). Default when the visual is unique to this proposal.
2. **Relative reference** — the brief's `visual:` frontmatter points at a path elsewhere in the repo (e.g. `../09-front-panel-s550-real.png`). Use this when the same visual file backs multiple archive entries.

**Never copy the file into the entry directory AND leave another copy elsewhere.** A copy creates two sources of truth that drift. The single source of truth lives at one path; the brief points at it.

Some decisions are non-visual (a removal, a vocabulary choice, a state-machine decision). For those, `visual: N/A — non-visual decision`. Keep the brief; skip the visual.

## When to file an entry

- **ACCEPTED:** every operator-approved design pick. File at the time of acceptance — same commit as the implementation commit, OR the mockup-pick commit if implementation comes later.
- **REJECTED:** every alternative the operator declined OR every direction retired during exploration. File at the time of rejection.

**Single-pass rejections matter.** Mockup variants the operator passed over in favor of one direction get an entry too. They're the durable record that prevents the next session's agent from re-proposing the same direction. The 2026-05-09 deskwork sessions repeatedly resurrected retired patterns because nothing was written down; that's the failure mode this archive prevents.

## What this archive is NOT

- **Not a settled-vocabulary spec.** A future `DESIGN-STANDARDS.md` would record *what is settled* (tokens, typography, retired patterns). The archive records *what was explored*. They are complementary, not duplicates.
- **Not a replacement for feature documentation.** Feature dirs (`docs/<version>/<status>/<slug>/`) are the working context for a feature; the archive is the design-decision checkpoint. A feature can ship multiple ACCEPTED entries (one per global-impact decision).
- **Not a code-change log.** Implementation commits are tracked in git history. The archive is for *design* decisions — the why, not the what.

## Change log

Append a one-line entry when this protocol is updated.

- 2026-05-18 — Initial draft. Ported from deskwork's `DESIGN-STANDARDS.md` § Proposal archive + `docs/studio-design/README.md`. Inaugurated by the s550-support connect-page redesign — three mockups (vfd-status / signal-flow / focus-card), one accepted, two rejected, all filed at `docs/1.0/001-IN-PROGRESS/s550-support/explorations/{ACCEPTED,REJECTED}/`.
