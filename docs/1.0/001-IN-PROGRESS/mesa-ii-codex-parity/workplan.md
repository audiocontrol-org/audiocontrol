# Workplan: MESA II Codex Parity

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-04-17

---

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315) |

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
- Installed Mac OS 9 disk image with MESA II:
  original path `/Users/orion/Downloads/Macintosh HD`,
  workspace copy `docs/1.0/001-IN-PROGRESS/mesa-ii-codex-parity/artifacts/macintosh-hd-2026-04-16.img`
- Installed Mac OS 7 disk image with MESA I:
  original path `/Users/orion/Downloads/macos-7-disk.hfv`,
  workspace copy `docs/1.0/001-IN-PROGRESS/mesa-ii-codex-parity/artifacts/macos-7-disk.hfv`
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

The session then moved past the task-21 dispute and into the remaining `UALL` ambiguity.
Codex now has a stronger structural split:

- the early pre-loop calls in `SendAudioBufferToSampler` at `0x030773`, `0x030793`,
  `0x0307f7`, `0x030841`, and `0x030891` all go through the `CAkaiSampler` object at
  `CSamplerModule+0xda4` via the `object+2 -> vtable` path
- the later post-loop `UALL` call at `0x030c93` is a different path entirely, using a
  shared secondary command-routing table installed at object offset `+4`
- both `CSamplerModule` and `CFXFilerView` constructors install that secondary A4-relative
  table at `+4`, and both classes route `SendCommandToSampler` through slot `0x28` of it

That means the active remaining question is not whether `UALL` is plug-side, but which
shared command processor sits behind the secondary `+4` table and how it relates to the
earlier sampler-side `+0xda4` calls.

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

### Current Assessment

Phase 3 is still active, but the frontier has changed materially again:

- issue `#315` remains the canonical Claude/Codex mailbox and emulator-facing charter
- the earlier low-address and wrapper-only story is now superseded by the corrected
  PLUG-relative load model: `scsi-plug-rsrc.bin` is a full resource fork and the
  executable `PLUG` body starts at file `0x59e`
- the `A055 StripAddress` bug and the old manual-relocation overlap question are now
  behind us; the plug’s own self-relocation carries the chained
  `ctor -> INIT -> CONS -> ASOK -> SEND` lifecycle without manual relocation
- the `INIT` callback-setter gate and the `CONS` registration seam are now both behind
  us:
  - `INIT` installs callback `0x1e5a` into `this+4` on the persistent object
  - outer rebased vtable `+0x10` defaults into embedded rebased `0x02fc`
  - embedded `0x02fc -> 0x089a` now visibly matches literal `CONS` at `(cmd)+0`
  - `CONS -> 0x090c -> vtable +0x30 -> ConnectToSocket` now really increments
    `this+0x38` and copies the 46-byte `SocketInfo` into `this+0x3c`
  - `ASOK -> 0x0924 -> vtable +0x34 -> ActivateSocket` is now also proven on that
    same object: it matches `SocketInfo+0x26 == slot+0x26`, copies
    `SocketInfo+0x24 -> slot+0x24`, copies `SocketInfo+0x2a -> slot+0x2a`, and the
    earlier “no visible mutation” result was just a zero-to-zero copy artifact
- the old local `0xc950` send gate is now explained and crossed:
  `vtable +0x14` consumes the per-socket word family rooted at `this+0x0d72`, copies
  `this+(0x0d72 + 4*n) -> this+0x0d6e`, and the bounded nonzero seed of slot-0
  `this+0x0d72` is now proven enough to move `SEND` deeper into the real transport path
- the productive `SRAW` phase is now captured end-to-end under evidence-backed chooser
  shortcuts:
  `SEND -> SRAW -> SMSendData -> 0x1620 -> $A089`
- the earlier empty-CDB story is closed:
  `SMSendData` builds the local 6-byte CDB itself and passes it intact to `0x1620`; the
  all-zero CDB previously seen at `$A089` came from the harness reading the wrong PB
  offsets instead of the 4.3-layout CDB region

The current cross-check therefore narrows to one bounded emulator seam:

- how far the now-captured productive transport path can proceed with the smallest set
  of evidence-backed shortcuts still in place
- and what the next real post-capture validation target should be:
  `BULK` opener family, `BOFF`, or bridge/device-side acceptance of the measured `SRAW`
  CDB

Current recommended work split:

- Claude:
  keep the productive `SRAW` path intact with the bounded chooser/selection shortcuts
  already justified by static evidence, and stop at the first new transport-facing
  blocker or validation seam beyond the captured `SRAW` CDB family
- Codex:
  keep the productive-path static model in sync, recover any remaining opener/closer
  phase shape that materially affects emulation, and cross-check that newer harness
  claims stay aligned with the direct `SMSendData` / `0x1620` decode

Current reminder:

- The Mac OS 9 install image is still a live artifact:
  `docs/1.0/001-IN-PROGRESS/mesa-ii-codex-parity/artifacts/macintosh-hd-2026-04-16.img`
- The Mac OS 7 MESA I corpus remains secondary historical context, not the primary
  frontier, unless it directly clarifies the emulator contract.

---

## Phase 4: Emulator Contract Guidance

**Goal:** Turn the validated reverse-engineering results into concrete guidance for what the emulator and harness must provide next.

### Tasks

- [x] Summarize which findings are safe to consume in emulator and harness work
- [x] Record unresolved questions and recommended next experiments
- [ ] Identify any follow-up feature or issue work needed for validated findings
- [x] Add maintenance guidance for keeping the two analysis tracks comparable over time

### Acceptance Criteria

- A maintainer can tell which findings are validated, disputed, or deferred
- Recommended next experiments are explicit
- Emulator and harness work can consume the validated findings without relying on conversational memory

### Next Experiments

- Keep the parity docs aligned with Claude’s live `#315` harness results rather than
  older wrapper-only or bridge-acceptance language.
- Treat the current state as an emulator-contract problem, not a product decision:
  - `MEASURED`: corrected PLUG-relative load model; plug self-relocation carries the
    real chained `ctor -> INIT -> CONS -> ASOK -> SEND` lifecycle; `INIT`, `CONS`,
    and `ASOK` are real on the persistent object; bounded chooser/selection shortcuts
    now carry the productive `SRAW -> SMSendData -> 0x1620` path; and the measured
    256-byte `SRAW` CDB is `0c 00 00 01 00 80`
  - `OPEN`: what minimum remaining production stages can replace the current shortcuts,
    and what the next trustworthy post-capture validation target is
- Use new static work only if it helps Musashi get farther.
- Reopen older callback/constructor/install surfaces only if new runtime evidence points
  back to them directly.
