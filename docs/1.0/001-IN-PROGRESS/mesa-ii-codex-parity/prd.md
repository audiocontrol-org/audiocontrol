# PRD: MESA II Codex Parity

## Summary

Create a Codex-driven reverse-engineering effort for Akai's MESA II sampler editor that runs in parallel with the existing Claude-driven effort. The goal is not redundant work for its own sake. The goal is independent analysis, explicit comparison, and evidence-backed convergence so downstream Akai and bridge work does not depend on a single agent's assumptions.

## Problem Statement

There is already an in-development effort to reverse engineer Akai's MESA II sampler editor, but it is being driven by Claude. We want a parallel Codex-driven effort pursuing the same overall goal so the two efforts can run independently, compare findings, challenge each other's assumptions, and converge on better evidence-backed conclusions.

Without a parallel analysis track:

- one reverse-engineering path can become canonical without sufficient challenge
- mistaken conclusions can spread into bridge or editor work
- disagreements may stay implicit instead of being documented and resolved with evidence

## Users

- Developers working on Akai sampler support
- Developers working on the SCSI MIDI bridge and transport behavior
- Future agents or maintainers who need auditable protocol findings rather than conversational memory

## Goals

- Create a dedicated Codex-side feature with its own docs and workplan
- Re-run MESA II analysis independently instead of only summarizing the Claude effort
- Compare the two efforts explicitly and classify findings as matched, disputed, unresolved, or deferred
- Feed validated conclusions into downstream Akai and bridge work only after cross-checking

## Success Criteria

- A dedicated Codex-driven feature exists for MESA II reverse engineering with its own feature docs and workplan.
- The workplan explicitly requires comparison against the existing Claude-driven MESA II effort rather than operating in isolation.
- Findings are recorded with evidence, including binary-analysis references, protocol notes, or hardware verification where applicable.
- Disagreements between the Codex and Claude analysis tracks are documented explicitly and resolved or narrowed with concrete evidence.
- Shared conclusions are fed back into the relevant Akai, transport, or bridge work only after cross-checking rather than assumption.
- The feature leaves behind an auditable record of matched findings, disputed findings, unresolved questions, and recommended next experiments.

## In Scope

- Reverse engineering Akai MESA II behavior relevant to sampler editing and transport behavior
- Binary analysis, disassembly review, protocol inference, and evidence-backed documentation
- Cross-checking Codex findings against the existing Claude-driven MESA II analysis
- Creating comparison artifacts that show where the two efforts agree or disagree
- Proposing follow-up experiments or validation work to resolve conflicting conclusions
- Feeding validated findings into related Akai or bridge feature planning

## Out of Scope

- Replacing or deleting the existing Claude-driven effort
- Treating one agent's conclusions as authoritative without evidence
- Making speculative protocol claims without binary, source, or hardware support
- Shipping production code changes solely because one analysis track suggests them
- Broad Akai UX or bridge implementation work that is not directly tied to the MESA II reverse-engineering effort

## Constraints

- Hardware and protocol claims must be backed by primary evidence
- The parallel Codex effort must remain comparable to the existing Claude effort rather than diverging into unrelated Akai work
- Comparison outcomes must be written down explicitly; silent convergence is not enough

## Open Questions

- Should the Codex-driven effort remain a standalone feature long-term or eventually fold into the existing Akai/MESA analysis tree?
- How often should the two efforts compare findings: continuously, at phase boundaries, or at explicit review checkpoints?
- Which MESA II surface should be cross-checked first: sample upload, transport behavior, request framing, or UI/editor workflows?
