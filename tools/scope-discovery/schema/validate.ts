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
 *   0   all example manifests validate
 *   1   one or more failed validation
 *   2   process / filesystem / parse error (schema not loadable etc.)
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(SCRIPT_DIR, 'scope-manifest.schema.json');
const EXAMPLES_DIR = resolve(SCRIPT_DIR, 'examples');

interface ValidationOutcome {
  readonly file: string;
  readonly passed: boolean;
  readonly errors: string[];
}

async function loadSchema(): Promise<Record<string, unknown>> {
  const raw = await readFile(SCHEMA_PATH, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      `scope-manifest.schema.json did not parse to an object — got ${typeof parsed}. ` +
        `The schema file at ${SCHEMA_PATH} is malformed.`,
    );
  }
  return parsed as Record<string, unknown>;
}

async function listExampleFiles(): Promise<string[]> {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true });
  const yamlFiles = entries
    .filter((e) => e.isFile() && /\.(ya?ml)$/i.test(e.name))
    .map((e) => join(EXAMPLES_DIR, e.name))
    .sort();
  if (yamlFiles.length === 0) {
    throw new Error(
      `No example manifests found under ${EXAMPLES_DIR}. ` +
        `T2.1 requires at least one example per kind (ui, code, hybrid).`,
    );
  }
  return yamlFiles;
}

async function loadYamlManifest(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf8');
  return parseYaml(raw);
}

function formatAjvErrors(errors: unknown): string[] {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((err) => {
    if (typeof err !== 'object' || err === null) {
      return String(err);
    }
    const e = err as {
      instancePath?: unknown;
      schemaPath?: unknown;
      message?: unknown;
      params?: unknown;
    };
    const path = typeof e.instancePath === 'string' && e.instancePath.length > 0
      ? e.instancePath
      : '<root>';
    const msg = typeof e.message === 'string' ? e.message : 'unknown error';
    const params = e.params !== undefined ? ` (${JSON.stringify(e.params)})` : '';
    return `${path}: ${msg}${params}`;
  });
}

async function main(): Promise<number> {
  let schema: Record<string, unknown>;
  try {
    schema = await loadSchema();
  } catch (err) {
    console.error(`schema load failed: ${(err as Error).message}`);
    return 2;
  }

  // strictRequired disabled: the manifest schema's per-kind required
  // fields (routes / modules) are conditionally required via allOf/if/then.
  // Ajv's strict mode wants every `required` token to be paired with a
  // sibling `properties` declaration at the same level — fine for flat
  // schemas, but the property declarations for `routes` and `modules`
  // live at the root, not inside each conditional branch. The runtime
  // semantics are correct; only the lint is unhappy. Keep the rest of
  // strict mode on.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);

  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (err) {
    console.error(`schema compile failed: ${(err as Error).message}`);
    return 2;
  }

  let files: string[];
  try {
    files = await listExampleFiles();
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }

  const outcomes: ValidationOutcome[] = [];
  for (const file of files) {
    let manifest: unknown;
    try {
      manifest = await loadYamlManifest(file);
    } catch (err) {
      outcomes.push({
        file,
        passed: false,
        errors: [`YAML parse failure: ${(err as Error).message}`],
      });
      continue;
    }
    const ok = validate(manifest);
    outcomes.push({
      file,
      passed: ok === true,
      errors: ok === true ? [] : formatAjvErrors(validate.errors),
    });
  }

  let anyFailed = false;
  for (const o of outcomes) {
    const label = o.passed ? 'PASS' : 'FAIL';
    const rel = o.file.replace(`${process.cwd()}/`, '');
    console.log(`${label}  ${rel}`);
    if (!o.passed) {
      anyFailed = true;
      for (const e of o.errors) {
        console.log(`        - ${e}`);
      }
    }
  }

  return anyFailed ? 1 : 0;
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err) => {
    console.error(`unexpected failure: ${(err as Error).message}`);
    process.exit(2);
  },
);
