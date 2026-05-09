---
paths:
  - "services/scsi-midi-bridge/**"
  - "modules/e2e-infra/**"
  - "modules/*/src/**/*.tsx"
---

# Workflow Playbooks

## Investigate a hardware protocol question
1. Identify the transport: serial MIDI, HTTP MIDI, SCSI MIDI, SDS, or device-specific (e.g., Akai ASPACK)
2. Write a test script appropriate to the transport:
   - Serial/HTTP MIDI: browser e2e test or Node.js via midi-server
   - SCSI MIDI: Node.js script in `modules/e2e-infra/src/node/lib/` via bridge HTTP API
   - SDS: Node.js via bridge WebSocket `/sds/stream`
3. Run against real hardware, capture results with timing
4. Document findings in the relevant protocol/findings doc (create one if it doesn't exist)
5. Update the device's notes file (e.g., `SCSI-NOTES.md`) with a dated entry
6. Commit test script + docs before moving on

## Ship a bridge change
1. Edit Rust source in `services/scsi-midi-bridge/src/`
2. Deploy: `make deploy-scsi-bridge`
3. Verify: `curl http://s3k.local:7033/status`
4. Test from Node.js first, then web app if applicable
5. Check logs: `ssh orion@s3k.local 'tail -20 /tmp/e2e-bridge.log'`
6. Commit only after hardware verification

## Add a UI feature
1. Read feature workplan for current phase and next task
2. Read `TESTING-UI.md` — check if a test harness exists for the feature; create one if not
3. Implement with loading states and progress indicators from the start
4. Use proportional flex layouts, not pixel values
5. Build: `make`
6. Verify visually using the test harness (screenshot with Playwright, inspect the result)
7. **Write a Playwright test spec for every interaction you verified manually** — specs live in `test/ui/<feature>.spec.ts`. Ad-hoc screenshots without corresponding specs are throwaway work.
8. Iterate: fix issues found visually, update specs, screenshot again
9. Update workplan acceptance criteria
10. **Run a duplication audit before declaring the phase / task complete** (see playbook below).
11. Commit with GitHub issue reference

## Phase-completion duplication audit

**Required step. No phase or task is complete until this audit passes.**

Past failure mode: when building the second device editor (S-550 alongside S-330), and again when building the second device's library (Akai S3000XL alongside Roland), code was duplicated instead of refactored to share. The drift accumulated across phases until the cost of unifying was high enough to defer indefinitely. This audit catches it at the boundary, when the cost is low.

**Run BEFORE marking any implementation phase or task complete:**

1. **List every new file you authored or substantially modified during the phase.**
2. **For every new function / hook / component, grep the codebase** for identifiers, file names, or substring patterns that suggest a sibling implementation already exists:
   - Hooks: `grep -rn "use<NewHookName>" src/ hooks/` and search for the verbs/nouns in adjacent paths (`useExport*`, `useImport*`, `useWaveData*`, `useDevice*`, etc.).
   - Components: `grep -rn "<NewComponent>" src/components/` and search for similar names.
   - Utilities: search by the operation, not the name (e.g., "exportToneToDirectory", "requestWaveData", "12BitTo16Bit") to find adjacent implementations even when names differ.
3. **For every device-specific module added, identify a shared base candidate.** When adding `s550/x.ts`, ask: should this be in `roland-s-series/x.ts` instead? When adding `akai-library/x.ts`, ask: is there a `library-core/x.ts` it should live in?
4. **For every new state/handler bag in a page**, ask: does a sibling page already manage similar state (e.g., another list-detail page with the same import / export / load / refresh handlers)? If yes, the state should live in a shared hook, not in a page-local one.
5. **Document the audit explicitly in the workplan or DEVELOPMENT-NOTES entry**: "Duplication audit: <N> candidates checked, <M> overlaps unified, <K> kept separate because <reason>." Just writing "no duplication" is not enough — the auditor needs to show their work.
6. If duplication is found, **either unify it now or open a tracked issue**. Do not commit "we'll consolidate later" without the issue link, because past evidence shows "later" doesn't happen.

**Common false negatives (things that look like duplication but aren't):**
- Functions with similar names but different domains (e.g., `formatPatchSlot` vs `formatToneSlot` — same shape, different semantics, OK to keep separate).
- Tests that exercise different layers (unit / integration / e2e) — duplication in test coverage is desirable.

**Common false positives (things that look distinct but ARE duplicating):**
- Two pages with `handleExportX` and `handleExportY` doing the same multi-step export against different object types — promote to a generic hook with a discriminator.
- Two pages with `useState<Map<number, T>>` for caching device data — promote to a shared cache hook keyed by item index.
- Two hooks fetching wave data with progress callbacks — promote a shared `useWaveData(toneIndex)` hook that internalizes the cache + cancellation.
