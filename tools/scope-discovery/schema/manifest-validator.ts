/**
 * tools/scope-discovery/schema/manifest-validator.ts
 *
 * Reusable validator core for scope-manifest.schema.json. Extracted from
 * validate.ts (T2.1) so the synthesis pass (T3.2) and any future
 * consumers do not duplicate the schema-load + ajv-compile +
 * scenario-reference cross-check logic.
 *
 * Per .claude/CLAUDE.md DRY mandate: every consumer (validate.ts CLI,
 * synthesize() in synthesis.ts, future skill code) calls into this
 * module rather than re-implementing the same compile path.
 *
 * What this module does NOT do:
 *   - Load YAML or JSON from disk. Callers parse first (the file shape
 *     varies — the synthesizer builds an in-memory object; the CLI
 *     reads YAML from examples). Keeping this layer parser-agnostic
 *     prevents the synthesis pass from depending on the YAML parser
 *     transitively through validate.
 *   - Emit progress / report formatting. validate.ts owns the CLI
 *     reporting; the synthesizer turns errors into thrown exceptions.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { isPlainObject, errorMessage } from '../util/typeguards.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(SCRIPT_DIR, 'scope-manifest.schema.json');

/** Combined validation outcome for a single manifest. */
export interface ManifestValidationResult {
  readonly ok: boolean;
  readonly errors: ReadonlyArray<string>;
}

async function loadSchema(): Promise<Record<string, unknown>> {
  const raw = await readFile(SCHEMA_PATH, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainObject(parsed)) {
    throw new Error(
      `scope-manifest.schema.json did not parse to an object — got ${typeof parsed}. ` +
        `The schema file at ${SCHEMA_PATH} is malformed.`,
    );
  }
  return parsed;
}

/**
 * Compile the manifest schema once and return a reusable validator
 * function. Callers cache this if they will validate many manifests;
 * the CLI compiles once and runs across all examples in a single
 * process, the synthesizer compiles once per invocation.
 *
 * strictRequired disabled: see $comment in scope-manifest.schema.json
 * adjacent to the allOf block — the manifest's conditionally-required
 * routes/modules fields are declared at the root and referenced inside
 * allOf/if/then branches; strict mode mis-lints this even though the
 * runtime semantics are correct.
 */
export async function compileManifestValidator(): Promise<ValidateFunction> {
  const schema = await loadSchema();
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

/**
 * Format ajv's errors[] into a flat list of strings. Mirrors the
 * formatting that validate.ts used inline; extracted so the
 * synthesizer surfaces identical messages.
 */
export function formatAjvErrors(errors: unknown): string[] {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((err: unknown) => {
    if (!isPlainObject(err)) {
      return String(err);
    }
    const instancePath = err['instancePath'];
    const message = err['message'];
    const params = err['params'];
    const path =
      typeof instancePath === 'string' && instancePath.length > 0
        ? instancePath
        : '<root>';
    const msg = typeof message === 'string' ? message : 'unknown error';
    const paramsStr = params !== undefined ? ` (${JSON.stringify(params)})` : '';
    return `${path}: ${msg}${paramsStr}`;
  });
}

/**
 * Imperative referential-integrity check: every id referenced in
 * route.scenarios[] must appear in the top-level scenarios[].id list.
 * JSON Schema lacks the cross-property primitives to express this, so
 * we check it here. Applies to kind: ui and kind: hybrid only.
 */
export function validateScenarioReferences(manifest: unknown): string[] {
  if (!isPlainObject(manifest)) {
    return [];
  }
  const kind = manifest['kind'];
  if (kind !== 'ui' && kind !== 'hybrid') {
    return [];
  }
  const scenarios = manifest['scenarios'];
  if (!Array.isArray(scenarios)) {
    return [];
  }
  const knownIds = new Set<string>();
  for (const s of scenarios) {
    if (isPlainObject(s) && typeof s['id'] === 'string') {
      knownIds.add(s['id']);
    }
  }
  const routes = manifest['routes'];
  if (!Array.isArray(routes)) {
    return [];
  }
  const errors: string[] = [];
  routes.forEach((route: unknown, routeIndex: number) => {
    if (!isPlainObject(route)) {
      return;
    }
    const routeScenarios = route['scenarios'];
    const routePath =
      typeof route['path'] === 'string' ? route['path'] : `<route #${routeIndex}>`;
    if (!Array.isArray(routeScenarios)) {
      return;
    }
    for (const id of routeScenarios) {
      if (typeof id !== 'string') {
        continue;
      }
      if (!knownIds.has(id)) {
        errors.push(
          `/routes/${routeIndex}/scenarios: route '${routePath}' references ` +
            `scenario id '${id}' that is not declared at the top-level scenarios[].id list`,
        );
      }
    }
  });
  return errors;
}

/**
 * Validate an in-memory manifest object against the schema PLUS the
 * scenario-reference cross-check. Returns a combined outcome — the
 * caller decides whether to throw, log, or report.
 *
 * The validator argument is the output of `compileManifestValidator()`;
 * accepting it (rather than compiling internally) lets the caller
 * compile once and validate many.
 */
export function validateManifest(
  manifest: unknown,
  validate: ValidateFunction,
): ManifestValidationResult {
  const schemaOk = validate(manifest);
  const schemaErrors = schemaOk === true ? [] : formatAjvErrors(validate.errors);
  const refErrors = validateScenarioReferences(manifest);
  const errors = [...schemaErrors, ...refErrors];
  return { ok: errors.length === 0, errors };
}

/**
 * Convenience wrapper for one-shot callers — compiles a validator and
 * runs it against a single manifest. Synthesizer uses this directly;
 * the CLI keeps its own compile-once-validate-many loop.
 */
export async function validateManifestOnce(
  manifest: unknown,
): Promise<ManifestValidationResult> {
  try {
    const validate = await compileManifestValidator();
    return validateManifest(manifest, validate);
  } catch (err) {
    return { ok: false, errors: [`validator setup failed: ${errorMessage(err)}`] };
  }
}
