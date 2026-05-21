/**
 * tools/scope-discovery/schema/validate.ts
 *
 * Loads tools/scope-discovery/schema/scope-manifest.schema.json with
 * ajv (draft 2020-12) and validates every example manifest under
 * tools/scope-discovery/schema/examples/ against it. Prints one line
 * per example with PASS / FAIL; exits non-zero if any fail.
 *
 * This is the "validates via ajv validate" proof for T2.1's
 * acceptance gate. It also runs as part of the foundation-tooling
 * sanity sweep — any change to the schema or to an example manifest
 * must re-pass this script.
 *
 * Run via:
 *   tsx tools/scope-discovery/schema/validate.ts
 *
 * Exit codes:
 *   0   all positive example manifests validate AND all negative-test
 *       manifests fail validation as expected
 *   1   one or more positive examples failed, or one or more negative
 *       examples unexpectedly passed
 *   2   process / filesystem / parse error (schema not loadable etc.)
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(SCRIPT_DIR, 'scope-manifest.schema.json');
const EXAMPLES_DIR = resolve(SCRIPT_DIR, 'examples');
const NEGATIVE_DIR = resolve(EXAMPLES_DIR, '_negative-tests');

interface ValidationOutcome {
  readonly file: string;
  readonly passed: boolean;
  readonly errors: string[];
}

/** Type-guard: narrows `unknown` to `Record<string, unknown>` without an `as Type` cast. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Extract a string message from an `unknown` thrown value without an `as Error` cast. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

async function listYamlFilesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.(ya?ml)$/i.test(e.name))
    .map((e) => join(dir, e.name))
    .sort();
}

async function listPositiveExamples(): Promise<string[]> {
  const yamlFiles = await listYamlFilesIn(EXAMPLES_DIR);
  if (yamlFiles.length === 0) {
    throw new Error(
      `No example manifests found under ${EXAMPLES_DIR}. ` +
        `T2.1 requires at least one example per kind (ui, code, hybrid).`,
    );
  }
  return yamlFiles;
}

/** Detect Node's ENOENT error code; `'code' in err` is a real TS narrowing operator. */
function isEnoent(err: unknown): boolean {
  if (!(err instanceof Error) || !('code' in err)) {
    return false;
  }
  return err.code === 'ENOENT';
}

async function listNegativeExamples(): Promise<string[]> {
  try {
    return await listYamlFilesIn(NEGATIVE_DIR);
  } catch (err) {
    // Negative-test directory is optional; absence is not an error.
    if (isEnoent(err)) {
      return [];
    }
    throw err;
  }
}

async function loadYamlManifest(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf8');
  return parseYaml(raw);
}

function formatAjvErrors(errors: unknown): string[] {
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
    const path = typeof instancePath === 'string' && instancePath.length > 0
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
function validateScenarioReferences(manifest: unknown): string[] {
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
    const routePath = typeof route['path'] === 'string' ? route['path'] : `<route #${routeIndex}>`;
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

async function runOneValidation(
  file: string,
  validate: ValidateFunction,
): Promise<ValidationOutcome> {
  let manifest: unknown;
  try {
    manifest = await loadYamlManifest(file);
  } catch (err) {
    return {
      file,
      passed: false,
      errors: [`YAML parse failure: ${errorMessage(err)}`],
    };
  }
  const schemaOk = validate(manifest);
  const schemaErrors = schemaOk === true ? [] : formatAjvErrors(validate.errors);
  const refErrors = validateScenarioReferences(manifest);
  const errors = [...schemaErrors, ...refErrors];
  return {
    file,
    passed: errors.length === 0,
    errors,
  };
}

function reportOutcome(o: ValidationOutcome, expectedPass: boolean): boolean {
  const actualPass = o.passed;
  const ok = actualPass === expectedPass;
  const relPath = relative(process.cwd(), o.file);
  const label = ok ? 'PASS' : 'FAIL';
  const expectation = expectedPass ? '' : ' (expected to fail)';
  console.log(`${label}  ${relPath}${expectation}`);
  if (!ok) {
    if (!expectedPass && actualPass) {
      console.log(`        - negative-test manifest unexpectedly validated`);
    }
    for (const e of o.errors) {
      console.log(`        - ${e}`);
    }
  }
  return ok;
}

async function main(): Promise<number> {
  let schema: Record<string, unknown>;
  try {
    schema = await loadSchema();
  } catch (err) {
    console.error(`schema load failed: ${errorMessage(err)}`);
    return 2;
  }

  // strictRequired disabled: see $comment in scope-manifest.schema.json
  // adjacent to the allOf block — the manifest's conditionally-required
  // routes/modules fields are declared at the root and referenced inside
  // allOf/if/then branches; strict mode mis-lints this even though the
  // runtime semantics are correct.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);

  let validate: ValidateFunction;
  try {
    validate = ajv.compile(schema);
  } catch (err) {
    console.error(`schema compile failed: ${errorMessage(err)}`);
    return 2;
  }

  let positiveFiles: string[];
  let negativeFiles: string[];
  try {
    positiveFiles = await listPositiveExamples();
    negativeFiles = await listNegativeExamples();
  } catch (err) {
    console.error(errorMessage(err));
    return 2;
  }

  let anyFailed = false;

  for (const file of positiveFiles) {
    const outcome = await runOneValidation(file, validate);
    const ok = reportOutcome(outcome, true);
    if (!ok) {
      anyFailed = true;
    }
  }

  for (const file of negativeFiles) {
    const outcome = await runOneValidation(file, validate);
    const ok = reportOutcome(outcome, false);
    if (!ok) {
      anyFailed = true;
    }
  }

  return anyFailed ? 1 : 0;
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err) => {
    console.error(`unexpected failure: ${errorMessage(err)}`);
    process.exit(2);
  },
);
