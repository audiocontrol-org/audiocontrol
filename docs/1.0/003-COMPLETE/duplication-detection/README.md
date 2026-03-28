# Code Duplication Detection

**Status:** Complete
**Feature Branch:** `feature/duplication-detection`
**GitHub Milestone:** TBD

## Overview

Add automated code duplication detection to the audiocontrol monorepo using jscpd, run like code coverage with a percentage threshold and CI-gatable exit code.

## Documentation

- [PRD](./prd.md) - Requirements, tool selection rationale, configuration design
- [Workplan](./workplan.md) - Implementation phases and threshold calibration plan
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm duplication:check` | Fail if duplication exceeds threshold |
| `pnpm duplication:cross` | Show cross-module duplication only |
| `pnpm duplication:report` | Generate browsable HTML report |

## Analogy to Coverage

| Coverage | Duplication |
|----------|-------------|
| `pnpm coverage:check` | `pnpm duplication:check` |
| vitest + V8 | jscpd (Rabin-Karp) |
| 80% minimum | 6% maximum (calibrated from 4.65% baseline) |
| `reports/coverage/` | `reports/duplication/` |
