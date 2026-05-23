/**
 * tools/scope-discovery/check-deps.required.ts
 *
 * Single source of truth for the top-level deps that the
 * `/scope-inventory` skill's discovery agents (and the in-tree
 * scope-discovery TS tooling) require at runtime. T7.2.
 *
 * The runtime guard (`check-deps.ts`) imports this list and tries a
 * dynamic `import()` of each name; the adversarial validator
 * (`check-deps.validate.ts`) imports the same list and asserts:
 *   - each name resolves under normal conditions; and
 *   - the list is a subset of the workspace `package.json` devDeps so
 *     a silent drop from package.json doesn't leave a stale guard.
 *
 * Keep this file tiny on purpose: any "list of deps the agents need"
 * must come from here, never inline duplicated in the guard or the
 * validator. DRY is enforced by re-import; the package.json
 * cross-check is the coherence gate.
 */

/**
 * Names of the top-level dependencies the scope-discovery agents +
 * tooling load via static `import` from 'name'. If any of these can't
 * resolve, the discovery agents will crash with a raw
 * `ERR_MODULE_NOT_FOUND`; the guard upgrades that to an actionable
 * error message before the dispatch begins.
 */
export const REQUIRED_SCOPE_DISCOVERY_DEPS: ReadonlyArray<string> = [
  'yaml',
  'ajv',
  'ajv-formats',
] as const;

/** Invocation operators are told to run when a dep is missing. */
export const INSTALL_INVOCATION = 'pnpm install';
