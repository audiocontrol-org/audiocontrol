# Build Optimization — Implementation Summary

**Status:** Complete

## Completed

### Phase 1: Decoupled tests from build scripts
Removed `pnpm test &&` / `npm test &&` from the `build` script in 5 modules:
- `sampler-lib`
- `sampler-devices`
- `sampler-library`
- `sample-chopper`
- `loop-editor`

Tests are now only run via `pnpm test`.

### Phase 2: Enabled TypeScript incremental compilation
Removed `"incremental": false` from `tsconfig.json` in 9 modules, allowing them to inherit `incremental: true` and `composite: true` from `tsconfig.base.json`:
- `audiotools-cli`, `audiotools-config`, `lib-device-uuid`, `lib-runtime`
- `sample-chopper`, `sampler-devices`, `sampler-export`, `sampler-lib`, `sampler-library`

**Exception:** `live-max-cc-router` retains `incremental: false` and `composite: false` because `@rollup/plugin-typescript` does not support composite mode with `declaration: false`. This is documented with a deviation comment in its `tsconfig.json`.

### Phase 3: Added source file dependencies to Makefile
Every module's stamp rule now depends on its `src/**/*.ts` and `src/**/*.tsx` files via `$(shell find ...)`, so Make can detect actual source changes and skip unnecessary rebuilds.

**Exception:** `live-max-cc-router` was removed from the Makefile build. Its build script generates `canonical-plugin-maps.ts` into `src/` during every build, which creates an infinite rebuild loop with Make's source dependency tracking. It must be built manually: `cd modules/live-max-cc-router && pnpm build`. This is documented with a warning comment in the Makefile.

Also added `rm -f $(MODULES_DIR)/*/*.tsbuildinfo` to the `clean` target.

### Phase 4: Verification and benchmarks

| Scenario | Time |
|---|---|
| No-op build (no changes) | **0.2s** |
| Single leaf file change (`sampler-lib`) | **35.6s** (rebuilds 14 dependent modules) |

## Architecture Decisions

- **`$(shell find)` for source tracking:** Evaluated at Makefile parse time. Performant for 23 modules. If the repo grows significantly, a file-list cache could be added.
- **`live-max-cc-router` excluded:** Modules that generate source files during build are incompatible with Make's source dependency tracking without additional infrastructure (e.g., moving generated files out of `src/`).
- **`.tsbuildinfo` files remain gitignored:** They are local build cache artifacts and should not be committed.

## Key Files

- `Makefile` — source dependency rules for all modules
- `modules/*/package.json` — build scripts (5 modules changed)
- `modules/*/tsconfig.json` — incremental compilation (10 modules changed)
