---
proposal: Connect page · Signal-flow diagram
status: REJECTED
date: 2026-05-18
feature: docs/1.0/001-IN-PROGRESS/s550-support/
visual: self-contained: ./mockup.html
---

# Connect page · Signal-flow diagram

## What

A three-node signal-flow diagram occupying the page: **This App → MIDI Bridge → Device**. Form fields render INSIDE the node they configure — MIDI port dropdowns inside the bridge node, Device ID inside the device node. Glowing accent bus lines connect the nodes; a status bar + Connect button sit below the diagram. Teaches the mental model of the connection by mapping the form to the physical signal path.

## Why rejected

The signal-flow metaphor was tempting because it grounds the abstract "connect to MIDI" task in a familiar mental model (cable goes from interface to device, app talks to interface). But on operator review the trade-offs lost to direction A:

- **Wider than the other directions** — the three-node diagram needs horizontal room; at narrower viewports the nodes have to restack vertically, which loses the spatial metaphor entirely.
- **Form-inside-node coupling.** Putting the MIDI port dropdowns inside the "bridge" node meant every interaction with the form happened inside what looked like a diagram element. Reads as ceremony, not affordance — the operator just wants to pick a port, not feel like they're configuring a node graph.
- **Doesn't survive the auto-probe / express-trigger pattern.** The signal-flow shape implies "set each node, then connect." It doesn't communicate "click scan, the editor figures out which ports are right" — which is the desired default behavior.
- **Direction A communicates state better.** A glowing VFD readout at the top of the page tells the operator the connection state at-a-glance. The signal-flow diagram would have to indicate state via per-node coloring or animated bus lines, which fights the form-inside-node layout for attention.

Some operators just want a form and a button; the diagram is heavier ceremony than the task warrants.

## When

Rejected 2026-05-18 in favor of direction A (vfd-status). The original three-mockup commit is `420dda38`.

## Feature reference

[docs/1.0/001-IN-PROGRESS/s550-support/](../../../)
