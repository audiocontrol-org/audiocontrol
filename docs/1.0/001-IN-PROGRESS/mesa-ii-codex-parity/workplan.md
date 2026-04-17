# Workplan: MESA II Codex Parity

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-04-17

---

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | TBD |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | TBD | Baseline the existing Claude-driven MESA II analysis and create comparison structure |
| Phase 2 | TBD | Run independent Codex-led analysis passes against the MESA II source artifacts |
| Phase 3 | TBD | Cross-check Codex and Claude findings, resolve or narrow disputes |
| Phase 4 | TBD | Summarize validated conclusions and downstream integration guidance |

---

## Technical Approach

### Affected Areas

- `docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/`
- `docs/1.0/001-IN-PROGRESS/mesa-ii-codex-parity/`
- `SCSI-NOTES.md` and related protocol notes when hardware findings are involved
- Any Akai, sampler, or bridge documentation that consumes validated MESA II conclusions

### Strategy

1. Rehydrate the current Claude-driven MESA II analysis state from the existing docs and artifacts.
2. Create a Codex-specific reverse-engineering track with its own findings log and comparison record.
3. Audit current Claude findings and classify them as independently reproduced, plausible but unverified, disputed, unresolved, or deferred.
4. Run Codex-led analysis passes against the same source material rather than only paraphrasing the existing work.
5. Record convergence and disagreement points explicitly.
6. Use evidence-based comparison to decide which conclusions are safe to influence downstream implementation work.

### Dependencies

- Existing MESA II analysis artifacts under
  `docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/mesa-ii-analysis/`
- Binary extraction and disassembly tooling already captured in the repo
- Hardware and transport notes where experimental confirmation is required
- Coordination points with the parallel Claude-driven effort so outputs can be compared

---

## Phase 1: Baseline and Comparison Setup

**Goal:** Establish the current Claude-side state and build a comparison structure for the Codex effort.

### Tasks

- [x] Inventory the current Claude-driven MESA II artifacts and analysis claims
- [x] Record the relevant source artifacts, binaries, disassembly outputs, and supporting notes
- [x] Define comparison categories: matched, disputed, unresolved, deferred
- [x] Create Codex-side docs for findings, disagreements, and validation tracking
- [x] Identify the first high-value MESA II area to re-analyze independently

### Phase 1 Output

- Claude baseline captured in `claude-baseline.md`
- Comparison structure captured in `comparison-record.md`
- Codex findings log created in `codex-findings.md`
- First independent target selected:
  `CAkaiSampler` / `CAkaiMIDIDispatcher` header-field encoding plus the socket-level
  call sequence that brackets BULK transfer

### Current Assessment

The active Claude-side baseline is the `feature/mesa-ii-reverse-engineering` branch, not
the older `main`-branch snapshot. That branch's `DEVELOPMENT-NOTES.md` materially changes
the current comparison target because it retracts or narrows earlier conclusions:

- the earlier "definitive" BULK trace is now treated as a synthetic harness path
- `BuildCommand` is currently believed to emit a 392-byte SDATA message, not 406 bytes
- the remaining blocker is the unresolved content encoding of the 200-byte Akai header
- SRAW and some vtable claims are explicitly downgraded from findings to unresolved
  inference

### Acceptance Criteria

- The existing Claude-side analysis surface is inventoried with source paths
- The Codex feature has a written comparison structure rather than ad hoc notes
- The first independent Codex analysis target is selected with rationale

---

## Phase 2: Independent Codex Analysis

**Goal:** Produce Codex-led conclusions from the underlying source artifacts without assuming the Claude conclusions are correct.

### Tasks

- [x] Re-run targeted binary or disassembly analysis against the chosen MESA II surface
- [x] Document each Codex conclusion with evidence references
- [x] Distinguish direct evidence from inference in the written findings
- [x] Record any areas where the current source artifacts are insufficient for confidence
- [x] Add follow-up experiments where binary evidence alone is not enough

### Acceptance Criteria

- Codex produces an independent written findings set for at least one high-value MESA II surface
- Every finding is labeled with evidence or clearly marked inference
- Missing evidence is documented explicitly instead of glossed over

### Current Assessment

Codex has now independently reproduced and refined several high-value points from the
Claude branch:

- matched `CAkaiMIDIDispatcher` slot `0x38` to `SwapLongWord` from raw binary bytes
- disputed and resolved the stale `CMESASocket::vtable[0x38]` class label via issue
  `#309`
- forced reconciliation of stale 406-byte / nibble-encode docs via issues `#310` and
  `#311`
- established from `SendAudioBufferToSampler` that the old direct `CSCSIPlug::SendData`
  BULK harness omitted real socket-level phase calls, escalated as issue `#312`

The highest-value remaining unknown is the identity and side effects of `CMESASocket`
slot `0x30`, which is called with SDS opcode `0x01` before BULK open and again after
the later `UALL` phase.

This is now narrower than when the phase started. Current Codex evidence supports:

- slot `0x30` as `ActivateThisSocket(Uc)` rather than an SDS-header send primitive
- `CSamplerModule+0xda0` as mutable active transport-selection state rather than a
  static startup flag
- `CSamplerModule+0xdaa` as likely MIDI-plug availability state
- `CSamplerModule+0xb1` as reusable cached activation state across multiple upload paths

The highest-value remaining unknown is now initialization provenance rather than identity:
where `CSamplerModule+0xb0/+0xb1` are first set, and where the default `+0xda0` value is
established before the runtime toggle path takes over. The latest constructor-boundary
pass also narrows the `CSamplerModule+0xda4` ownership gap to constructor-era helper
work: `CAkaiSampler::SetSocket` is independently confirmed, `CAkaiSampler`'s own
constructor is independently confirmed, and helper `0x317dc(this)` is now the strongest
current candidate for the remaining module-side collaborator installation.

---

## Phase 3: Cross-Check and Reconciliation

**Goal:** Compare the Codex and Claude efforts directly and resolve or narrow disagreements with evidence.

### Tasks

- [x] Compare Codex findings against the existing Claude findings line by line where practical
- [x] Mark agreements, disagreements, and ambiguous areas explicitly
- [ ] Propose or run validation experiments for the highest-impact disputes
- [x] Update the comparison record after each dispute is resolved or narrowed
- [x] Record any disagreements that remain open with a concrete next step

### Acceptance Criteria

- The feature contains an explicit agreement/disagreement record between the two efforts
- High-impact disputes have a documented validation plan or outcome
- Remaining unresolved areas are concrete and evidence-linked rather than vague

---

## Phase 4: Downstream Integration Guidance

**Goal:** Leave behind validated conclusions and clear guidance for downstream Akai and bridge work.

### Tasks

- [ ] Summarize which findings are safe to consume in downstream implementation work
- [ ] Record unresolved questions and recommended next experiments
- [ ] Identify any follow-up feature or issue work needed for validated findings
- [ ] Add maintenance guidance for keeping the two analysis tracks comparable over time

### Acceptance Criteria

- A maintainer can tell which findings are validated, disputed, or deferred
- Recommended next experiments are explicit
- Downstream work can consume the validated findings without relying on conversational memory

### Next Experiments

- Hand-decode the pre-`OpenModule` transport-toggle owner around `0x029105` further
  backward so the owning function and full state choreography are explicit
- Hand-decode constructor-era helper `0x317dc(this)` and adjacent owner-install paths to
  find where `CAkaiSampler` ultimately reaches `CSamplerModule+0xda4`
- Expand earlier creation/initialization paths or less-obvious callees to find the first
  concrete stores to `CSamplerModule+0xb0` and `+0xb1`
- Identify where the default `CSamplerModule+0xda0` value is established before the
  runtime toggle path observed in the current artifact set
