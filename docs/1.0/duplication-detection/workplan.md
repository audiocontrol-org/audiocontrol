# Code Duplication Detection - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline Measurement | Complete | 4.65% duplication across 454 TS/TSX files |
| Phase 2: Configuration & Scripts | Complete | .jscpd.json, package.json scripts, .gitignore |
| Phase 3: Threshold Calibration | Complete | Threshold set to 6% |
| Phase 4: Documentation | Complete | Workplan and implementation summary updated |

---

## Phase 1: Baseline Measurement

### Goal

Measure current duplication level across the monorepo before setting any threshold.

### Tasks

1. **Install jscpd as root dev dependency**
   ```bash
   pnpm add -Dw jscpd
   ```

2. **Run initial scan without threshold**
   ```bash
   npx jscpd modules/ --format typescript,tsx --min-lines 5 --min-tokens 50 \
     --ignore "**/node_modules/**,**/dist/**,**/*.test.ts,**/*.spec.ts,**/test/**" \
     --reporters console,json,html --output reports/duplication
   ```

3. **Record baseline metrics**
   - Total duplication percentage
   - Top duplicated files
   - Cross-module vs within-module breakdown
   - Largest clone clusters

4. **Run cross-module scan**
   ```bash
   npx jscpd modules/ --format typescript,tsx --min-lines 5 --min-tokens 50 \
     --ignore "**/node_modules/**,**/dist/**,**/*.test.ts,**/*.spec.ts,**/test/**" \
     --reporters console --skipLocal
   ```

### Acceptance Criteria

- [ ] Baseline duplication percentage recorded
- [ ] Top clone locations identified
- [ ] Cross-module duplication hotspots identified

### Deliverables

- Baseline measurement recorded in this workplan (Phase 3)

---

## Phase 2: Configuration & Scripts

### Goal

Set up jscpd configuration and npm scripts so duplication checking is a single command.

### Tasks

1. **Create `.jscpd.json` at repo root**
   ```json
   {
     "threshold": 0,
     "minLines": 5,
     "minTokens": 50,
     "reporters": ["console", "json", "html"],
     "output": "reports/duplication",
     "ignore": [
       "**/node_modules/**",
       "**/dist/**",
       "**/*.test.ts",
       "**/*.spec.ts",
       "**/test/**",
       "pnpm-lock.yaml"
     ],
     "path": ["modules/"],
     "format": ["typescript", "tsx"]
   }
   ```
   (Threshold set to 0 initially — calibrated in Phase 3)

2. **Add scripts to root `package.json`**
   ```json
   {
     "duplication:check": "jscpd --config .jscpd.json",
     "duplication:cross": "jscpd --config .jscpd.json --skipLocal",
     "duplication:report": "jscpd --config .jscpd.json --reporters console,html && echo 'Report: reports/duplication/html/index.html'"
   }
   ```

3. **Add reports directory to `.gitignore`**
   ```
   reports/
   ```

4. **Verify scripts work**
   - `pnpm duplication:check` produces console output and JSON
   - `pnpm duplication:report` generates browsable HTML report
   - `pnpm duplication:cross` shows only cross-module clones

### Acceptance Criteria

- [ ] `.jscpd.json` created with correct configuration
- [ ] All three scripts work and produce expected output
- [ ] `reports/` directory gitignored
- [ ] jscpd installed as root dev dependency

---

## Phase 3: Threshold Calibration

### Goal

Set the duplication threshold based on baseline measurement so that the check is useful without being noisy.

### Tasks

1. **Review baseline from Phase 1**
   - Current duplication: TBD%
   - Cross-module duplication: TBD%

2. **Set threshold**
   - Rule: set threshold to `ceil(baseline) + 1` to create headroom
   - If baseline is 3.2%, set threshold to 5%
   - If baseline is 8.7%, set threshold to 10% (with a note to ratchet down)

3. **Update `.jscpd.json`** with calibrated threshold

4. **Verify CI behavior**
   - Confirm `pnpm duplication:check` passes at current state
   - Confirm it would fail if threshold were 1% lower than current duplication

5. **Document ratchet plan**
   - Record current threshold and date
   - Target: reduce by 1% per milestone until reaching 5% or lower

### Acceptance Criteria

- [ ] Threshold set based on measured baseline
- [ ] `pnpm duplication:check` passes on current codebase
- [ ] Ratchet plan documented

### Baseline Results

```
Date: 2026-03-18
Total lines scanned: 74,322
Duplicated lines: 3,453
Duplication percentage: 4.65%
Threshold set to: 6%
Top clones:
  1. 92 lines: sampler-library/src/browser.ts <-> sampler-library/src/index.ts
  2. 67 lines: sampler-devices/src/devices/s330/s330-tone-factory.ts (within file)
  3. 54 lines: s330-editor LibraryTreeNode.tsx <-> MoveItemDialog.tsx
  4. 46 lines: sampler-lib/backup-paths.ts <-> sampler-backup/cli/migrate.ts
  5. 44 lines: d110-editor D110EnvelopeEditor.tsx <-> s330-editor EnvelopeEditor.tsx
```

---

## Phase 4: Documentation

### Goal

Document how to use duplication detection so the team knows it exists and how to interpret results.

### Tasks

1. **Add section to CONTRIBUTING or README**
   ```markdown
   ## Code Duplication

   Run duplication detection:
   - `pnpm duplication:check` — fail if duplication exceeds threshold
   - `pnpm duplication:cross` — show cross-module duplication only
   - `pnpm duplication:report` — generate HTML report

   Reports are written to `reports/duplication/`.
   Current threshold: N% (see .jscpd.json).
   ```

2. **Document configuration options** for future maintainers
   - How to adjust threshold
   - How to add ignore patterns
   - How to interpret the HTML report

### Acceptance Criteria

- [ ] Usage documented in repo
- [ ] Configuration explained for future modification

---

## Dependencies

```
Phase 1 (Baseline) → Phase 2 (Config) → Phase 3 (Threshold) → Phase 4 (Docs)
```

All phases are sequential — each depends on the previous.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| jscpd false positives on similar-but-intentional code (e.g., device configs) | Medium | Low | Tune `minLines`/`minTokens`, add file-level ignores |
| Baseline duplication very high (>15%) | Medium | Low | Set a realistic threshold and ratchet down gradually |
| jscpd slow on large monorepo | Low | Low | Only scans `.ts`/`.tsx` in `modules/`; test files excluded |
| Cross-module detection noisy | Low | Low | `--skipLocal` is a separate command, not the default check |
