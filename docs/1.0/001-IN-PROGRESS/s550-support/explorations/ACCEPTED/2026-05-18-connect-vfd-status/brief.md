---
proposal: Connect page · VFD status display
status: ACCEPTED
date: 2026-05-18
feature: docs/1.0/001-IN-PROGRESS/s550-support/
visual: self-contained: ./mockup.html
---

# Connect page · VFD status display

## What

A redesigned Connect page for the Roland S-330 / S-550 editors that anchors the page on a **VFD-style status display** — a glowing accent-blue phosphor block that shows the connection state, transport, and detected port. The rest of the page is reduced to:

1. The VFD readout.
2. A single primary CTA whose label tracks the next action — `Scan for device` pre-probe, `Connect` once a device is detected or the form is filled by hand, `Disconnect` once connected.
3. Three collapsed disclosures sharing one group: **Connection details** (transport toggle + manual ports/ID), **Setup guide** (procedural walkthrough + embedded tutorial video), **Troubleshooting** (common fixes).

The probe is operator-initiated, never automatic — sending SysEx Identity Requests to every visible MIDI port is invasive and can have side effects on connected hardware.

Three transport variants (Web MIDI / HTTP / Mock) share identical row-height chrome inside Connection details so swapping doesn't reflow the page. Transport selection lives inside Connection details (the single "expert mode" surface), not as a peer disclosure.

Device name is templated (`{{deviceName}}`) so the same page works for both S-330 and S-550 — no string hardcoded to a specific device.

## Why accepted

Operator review of three mockups (vfd-status / signal-flow / focus-card) picked this one. The deciding factors:

- **State is the visual anchor.** The VFD block puts connection state at the top in a way the operator can't miss — the LED color, status line, and detected readout all live in one coherent surface. The other two directions buried state inside form chrome.
- **One-button mental model.** The single CTA whose label tracks the next action eliminates "where do I click?" — there's always exactly one obvious next step. Pre-probe it's *Scan*, post-probe it's *Connect*, connected it's *Disconnect*.
- **Probe is express-triggered.** Iteration during review surfaced that auto-probing on page load was wrong — SysEx Identity Requests touch every MIDI port and can perturb live hardware. The single CTA doubles as the explicit consent gate for the probe.
- **Hardware-instrument metaphor matches the rest of the editor.** The VFD aesthetic (phosphor color, scanline texture, dashed-underline inline links) ties the Connect page into the same chrome family as the envelope graph, the page-title LED dot, and the active-nav indicator.
- **Disclosure stack handles the long tail.** Setup guide + Troubleshooting + Connection details collapse out of the way for the 99% case. They're one click from the surface when needed.

Refinements applied during review (see commit history): typography unified with the rest of the editor's chrome, scrollbar treatment matched the other panels, transport selector moved inside Connection details, green per-row status dots removed as noise, the "SysEx · Allowed" jargon line dropped in favor of conditional warning chrome that disambiguates browser permission from device EXC config.

## When

Picked 2026-05-18 during the post-v3-redesign iteration session. Implementation will follow on the live `HomePage` + `MidiConnectionPage` (editor-core). The chosen-direction commit is `2a20ecdd` on `feature/s550-support`.

## Feature reference

[docs/1.0/001-IN-PROGRESS/s550-support/](../../../)
