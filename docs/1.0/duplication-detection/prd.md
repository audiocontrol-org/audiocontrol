# Code Duplication Detection - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** audiocontrol-org

---

## Problem Statement

The audiocontrol monorepo has grown to 23+ modules with significant code shared across device families (Roland S-330, S-550, JV-1080, D-110). The S-550 feature demonstrated the value of extracting shared code — but the duplication that justified that extraction was discovered manually. There is no automated way to detect code duplication, track it over time, or gate PRs on a duplication threshold.

Code coverage has an established workflow: `pnpm coverage:check` runs vitest with V8 coverage and fails if coverage drops below 80%. No equivalent exists for duplication. Developers have no visibility into how much duplicated code exists or whether a change introduces new duplication.

## User Stories

- As a developer, I want to run `pnpm duplication:check` and get a pass/fail result so that I know whether my changes introduce excessive duplication
- As a maintainer, I want a duplication percentage metric so that I can track duplication trends across releases
- As a code reviewer, I want an HTML report showing exact clone locations so that I can assess whether duplication should be extracted
- As a CI pipeline, I want a non-zero exit code when duplication exceeds a threshold so that PRs with excessive duplication are flagged automatically
- As a developer working across modules, I want cross-module duplication detection so that shared code candidates are surfaced before they become tech debt

## Success Criteria

- [ ] `pnpm duplication:check` runs jscpd across all modules and exits non-zero if duplication exceeds threshold
- [ ] HTML report generated showing clone locations, duplication percentage, and per-file breakdown
- [ ] JSON report generated for programmatic consumption
- [ ] Cross-module detection mode available via `pnpm duplication:cross`
- [ ] Threshold set to a value just above current baseline, with a plan to ratchet down
- [ ] Reports directory gitignored
- [ ] Works with existing pnpm workspace structure

## Scope

### In Scope

- jscpd installation and configuration at monorepo root
- `.jscpd.json` configuration file with appropriate defaults
- Root `package.json` scripts for duplication checking
- `.gitignore` entry for reports directory
- Baseline measurement and initial threshold setting
- Documentation of configuration and usage

### Out of Scope

- CI workflow integration (future — depends on expanding CI beyond version-check)
- SonarQube/SonarCloud setup (heavier infrastructure, potential future addition)
- Automated refactoring of detected duplicates
- Per-module thresholds (start with a single monorepo-wide threshold)

## Technical Context

### Tool Selection: jscpd

After evaluating the field (PMD CPD, SonarQube, Semgrep, jsinspect, duplo), jscpd is the best fit:

| Criterion | jscpd | Alternatives |
|-----------|-------|-------------|
| TypeScript/TSX | Native (written in TS) | PMD: partial TS. SonarQube: full but requires server |
| npm-native | Yes (`pnpm add -Dw jscpd`) | PMD: Java. SonarQube: external service |
| % metric | Yes (duplicated lines %) | PMD: no. SonarQube: yes but requires infrastructure |
| CI threshold gate | `--threshold N` exits non-zero | PMD: manual. SonarQube: Quality Gate action |
| Output formats | Console, JSON, HTML, SARIF | PMD: XML/CSV. SonarQube: web dashboard |
| Monorepo support | Multiple paths, `--skipLocal` for cross-module | PMD: multiple `--dir`. SonarQube: multi-module config |
| Maintenance | Active (v4.0.8, ~345K weekly npm downloads) | PMD: active. jsinspect: abandoned |

### How jscpd Works

jscpd uses the Rabin-Karp algorithm on tokenized source code:

1. **Tokenize** — Source files are lexed into language-specific tokens (keywords, identifiers, literals, operators). Comments and whitespace are stripped.
2. **Hash** — Sliding window of N tokens is hashed using Rabin-Karp rolling hash.
3. **Match** — Identical hash sequences across files (or within a file) are identified as clones.
4. **Report** — Clone locations, sizes, and duplication percentage are computed and output.

This is more robust than text-based comparison (ignores formatting differences) but less sophisticated than AST-based tools (won't detect renamed-variable clones). For a CI gate, this is the right tradeoff — low false positives, fast execution.

### Configuration Design

```json
{
  "threshold": 5,
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

| Setting | Value | Rationale |
|---------|-------|-----------|
| `threshold` | 5 | SonarQube "A" rating is < 3%; start at 5% to avoid noise while establishing baseline |
| `minLines` | 5 | Default. Blocks shorter than 5 lines are not meaningful duplication |
| `minTokens` | 50 | Default. ~2-3 lines of typical TypeScript |
| `reporters` | console, json, html | Console for CI output, JSON for tooling, HTML for human review |
| `ignore` | test files, dist, node_modules | Test code often has intentional repetition; built artifacts are irrelevant |
| `format` | typescript, tsx | Only scan TypeScript source |

### Analogy to Coverage

| Coverage | Duplication |
|----------|-------------|
| `pnpm coverage:check` | `pnpm duplication:check` |
| vitest + @vitest/coverage-v8 | jscpd |
| 80% minimum coverage | 5% maximum duplication |
| `reports/coverage/` (HTML) | `reports/duplication/` (HTML) |
| Exit code 1 if below threshold | Exit code 1 if above threshold |

### Cross-Module Detection

jscpd's `--skipLocal` flag ignores duplication within a single file and reports only cross-file (and cross-module) clones. This is the mode most useful for identifying shared code extraction candidates:

```bash
# All duplication (within and across modules)
pnpm duplication:check

# Cross-module duplication only
pnpm duplication:cross
```

## Dependencies

- `jscpd` npm package (MIT license, ~345K weekly downloads)
- No runtime dependencies — dev dependency only

## Open Questions

- [ ] What is the current duplication baseline? (Run jscpd without threshold first to measure)
- [ ] Should test files be excluded or have a separate, more lenient threshold?
- [ ] Should SARIF output be enabled for future GitHub Code Scanning integration?
