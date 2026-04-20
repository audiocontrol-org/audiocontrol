# Decision Record — 2026-04-19

**Decision:** Commit to Option 2 (harness end-to-end) via "terrain as necessary" approach. Extend `mesa-plug-harness` to load and execute `sampler-editor-rsrc.bin` alongside the already-loaded SCSI Plug binary, stubbing Mac OS 9 toolbox incrementally as each of Codex's priority tests requires.

**Supersedes:** implicitly builds on `decision-record-2026-04-18.md`. The prior record committed to "continue MESA II RE until we have a testable, data-backed hypothesis" without picking between static-only and harness-end-to-end approaches. This record makes the specific commitment.

**Status:** active; direction for all Phase 3 work.

---

## What changed

After task #30 (SRAW decode) reached Outcome B — static decode of the SCSI Plug binary exhausted at two runtime boundaries — and Codex's independent parity analysis confirmed no ordinary install edge remains inside the Sampler Editor binary either, the remaining question (how MESA's live sender is installed/redirected at runtime) can only be answered by:

1. Running MESA's real code and observing what it installs, OR
2. Proving the install edge is external to both binaries we have (at which point the question is "unanswerable from these artifacts alone")

Codex recommended an asymmetric split — Claude takes dynamic/runtime work, Codex stays sideways as a narrow static boundary prover. The user endorsed Option 2 with two additional motivations:

- **Curiosity/craft:** worth attempting just to see if we can get the mesa-plug-harness to run the full Sampler Editor binary
- **Community value:** this is a significant vintage-computing reverse-engineering project; our findings and tooling should be documented for other vintage sampler / vintage computing enthusiasts

## The "terrain as necessary" framing (critical)

Don't build full Option 2 infrastructure up front then run tests. Build the minimum terrain needed for each priority test, stop between each, assess before the next.

| Codex priority test | Minimum harness terrain needed |
|---|---|
| **P1:** Snapshot plug-slot state pre-init / post-InitModule / at-transfer-start. Compare $106e effective call target across phases. | Load Sampler Editor binary; execute init sequence; snapshot state at phase boundaries. Does NOT require full send-path execution. |
| **P2:** Wire capture around ActivateThisSocket, plug selection, pre/post-BULK. | P1 terrain + enough send-path execution to reach those boundaries. Each boundary adds more toolbox stubs incrementally. |
| **P3:** Compare normal vs interrupted post-transfer flow. | P1 + P2 + an interruption mechanism. |
| **P4:** Throughput comparison for any runtime-discovered alternative path. | Only if P1-P3 surface an alternative worth measuring. |

Stop after each priority. Assess whether the next is still the right investment based on what the prior revealed.

## Path A (task #31) reframed as step 0

The statically-decoding-the-install-edge task that was in_progress (task #31) becomes a **prequel to the harness work**, not a competitor:

- If Path A finds the install edge in the Sampler Editor binary, we know exactly what function pointer gets installed at $106e. Option 2's bootstrap becomes much easier — we can call or verify that function directly.
- If Path A terminates at the binary boundary (Codex's predicted outcome), we have independent confirmation of the external-patching hypothesis. Option 2's bootstrap has to discover the install through execution.

Either outcome improves Option 2's foundation. Low cost (2-4 hours of agent work), high information value relative to the multi-week Option 2 commitment.

## Effort estimate and risk profile

Per the analysis in `#315` issue body's Option 2 section and the review conversation:

- **Total effort range:** 3-6 weeks of focused harness work to produce a definitive wire-byte trace of MESA's sample upload
- **Effort shape:** binary loading + resource fork parsing (~3-5 days), Memory Manager / File Manager / Resource Manager stubs (1-2 weeks), Apple Event stubs (another week since `UExtractFromAEDesc` is confirmed in the upload path), open-ended debugging of unexpected traps
- **Major known risks:** Mac toolbox is vast; a stub that diverges from real Mac OS behavior could produce a subtly wrong trace; Sampler Editor may invoke PPC code via Mixed Mode (Musashi is pure 68k)
- **Terrain-as-necessary mitigates this:** we only need stubs for the code paths each priority test exercises, not all of Mac OS. If P1 only needs init-time stubs, we don't build file-path stubs we'd never use.

## What success looks like

At any point during the Option 2 work, a stopping condition can make it worth it:

- **P1 alone succeeds:** we see the $106e install event in the trace. That identifies the sender function. Even if we don't complete P2-P4, we know what MESA installs.
- **P2 succeeds:** complete wire capture of SendAudioBufferToSampler. Definitive answer to "what bytes does MESA emit." From that, the bridge can be rewritten to match.
- **Path A terminates at boundary + P1 fails to find in-binary install:** we've definitively proved the install edge is external to both binaries we have. That forecloses Option 2 and tells us the question is unanswerable from these artifacts alone. Useful even as a negative result.

## What we will NOT do

- Not handcraft speculative SRAW/SYSX payloads as if they were MESA's (Codex's explicit "what not to do")
- Not re-decode ordinary `CSCSIPlug::SendData` helpers (static surface is exhausted per parity verification)
- Not treat static guesses about low-address call targets as hardware hypotheses
- Not abandon the guard rails from decision-record-2026-04-18.md: primary evidence only, measured > inferred, no throughput extrapolation, mark unknowns as unknowns
- Not commit to Path A's answer changing Option 2's commitment — Path A is a prequel that informs Option 2 startup, not a gate on the project

## Community writeup as a planned deliverable

This is a significant vintage-computing RE project. Plan a comprehensive writeup when Option 2 reaches a natural terminal point (success OR definitive negative result). Candidate content:

- The arc: SCSI bridge → SDS ceiling → device-is-the-bottleneck finding → reframe to understand MESA's approach → Option 2
- The tools: `mesa-plug-harness` with Musashi, primary-evidence decode discipline, Codex/Claude parity cross-check pattern
- The findings: full static decode of MESA's sample-upload chain (SendAudioBufferToSampler → BuildCommand → Nibbleize → etc.), with the corrections made over the course of the work
- The process lessons: verify external claims, grep across docs after sync, don't trust code comments about throughput
- The Option 2 results: whatever the harness extension reveals or forecloses

Format: TBD — could be a long-form writeup in the feature docs, or extracted as an external blog/gist after we ship. Defer packaging until we have terminal results.

## Related issues and artifacts

- #304 (parent feature), #306 (Phase 2), #307 (Phase 3), #315 (decision tracking)
- Codex parity wave closed: #309-#314
- Codex parity feature branch: `feature/mesa-ii-codex-parity` (cross-reference only; not merged into this branch)
- Supersedes decision in `decision-record-2026-04-18.md` (still valid for its own scope; this record narrows to Option 2 specifically)
- Task tracking: #31 (Path A / step 0), #28 (hardware verify after Option 2 produces a path), #11 (cross-reference doc — becomes part of community writeup)
