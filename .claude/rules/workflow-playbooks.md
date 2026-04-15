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
10. Commit with GitHub issue reference
