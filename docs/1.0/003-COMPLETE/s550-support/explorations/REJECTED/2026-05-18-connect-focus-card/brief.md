---
proposal: Connect page · Single focus card
status: REJECTED
date: 2026-05-18
feature: docs/1.0/001-IN-PROGRESS/s550-support/
visual: self-contained: ./mockup.html
---

# Connect page · Single focus card

## What

Brutally minimal Connect page: one centered card with a status header ("Disconnected · Roland S-330"), a short blurb ("Pair the editor with your device"), three form fields (MIDI Input, MIDI Output, Device ID), and one full-width primary CTA. Everything else — refresh ports, advanced transport, troubleshooting — demoted to small footer links and a single help disclosure. Quietest, most direct of the three directions.

## Why rejected

The focus-card direction succeeded at *removing chrome* but lost too much of what makes the editor's design language identifiable:

- **No spatial / device metaphor.** The card is just "a form on a page." It doesn't tie into the hardware-instrument vocabulary that the rest of the editor (VFD-tinted envelopes, page-title LED dot, rec-rule accents) uses. The Connect page would feel like it came from a different app.
- **State is implicit.** The header line "Disconnected · Roland S-330" carries the state, but without the LED + glow chrome of direction A, the page reads as a static form even when an action is happening (scanning, connecting). Direction A's pulsing LED + colored status text make state changes unmissable.
- **Footer-link disclosures are easy to miss.** Transport switching is hidden behind a small footer text link. For the rare power user who needs to switch transports, that's harder to find than direction A's `change` link in the VFD or the Connection details disclosure.
- **The minimalism doesn't carry information.** Stripping chrome is only a virtue if what remains is doing more work. Direction A's VFD is heavier visually but every pixel of it is conveying connection state. The focus card's white space wasn't paying for any signal.

Operator framing during review: "the VFD direction is the one that feels like part of the editor."

## When

Rejected 2026-05-18 in favor of direction A (vfd-status). The original three-mockup commit is `420dda38`.

## Feature reference

[docs/1.0/001-IN-PROGRESS/s550-support/](../../../)
