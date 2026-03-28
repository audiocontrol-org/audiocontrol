# Build Optimization — Workplan

**Feature:** Build Optimization
**PRD:** [prd.md](./prd.md)

## Technical Approach

Fix the Makefile to track actual source file changes, enable TypeScript incremental compilation across all modules, and decouple tests from build scripts. This is a configuration-level change — no application code is modified.

## Implementation Phases

### Phase 1: Separate tests from build scripts

Modules that run tests as part of `pnpm build` force a full test run on every build. Split these into separate `build` and `test` scripts.

**Affected modules:**
- `sampler-lib`: `npm test && tsup` -> `tsup`
- `sampler-devices`: `pnpm test && tsup` -> `tsup`
- `sampler-library`: `pnpm test && tsup` -> `tsup`
- `sample-chopper`: `pnpm test && tsup` -> `tsup`
- `loop-editor`: `pnpm test && tsup` -> `tsup`

### Phase 2: Enable TypeScript incremental compilation

Re-enable `incremental: true` in all module tsconfig.json files that currently override it to `false`. Ensure `composite: true` is inherited from `tsconfig.base.json`.

**Affected modules:**
- `audiotools-cli`
- `audiotools-config`
- `lib-device-uuid`
- `lib-runtime`
- `live-max-cc-router`
- `sample-chopper`
- `sampler-devices`
- `sampler-export`
- `sampler-lib`
- `sampler-library`

### Phase 3: Add source file dependencies to Makefile

Update each stamp file rule to depend on the module's source files, so Make can detect when a rebuild is actually needed.

Pattern:
```makefile
SAMPLER_LIB_SRC := $(shell find modules/sampler-lib/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)

$(SAMPLER_LIB): $(INSTALL_STAMP) $(SAMPLER_LIB_SRC)
	cd $(MODULES_DIR)/sampler-lib && pnpm build
	@touch $@
```

Apply this pattern to all 24 modules.

### Phase 4: Verification and benchmarking

- Run `make clean && make` — full build must succeed
- Run `make` again immediately — should complete in seconds (no-op)
- Touch one leaf module source file, run `make` — should rebuild only that module and dependents
- Run `pnpm test` — all tests pass
- Benchmark before/after for no-op and single-file-change cases

## Task Breakdown

1. Decouple tests from build scripts in 5 modules
2. Enable incremental TypeScript compilation in 10 modules
3. Add source file dependencies to Makefile for all modules
4. Verify full clean build correctness
5. Benchmark incremental build performance
