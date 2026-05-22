/**
 * tools/scope-discovery/schema/validate.ts
 *
 * CLI surface for the scope-manifest schema validator. Loads
 * tools/scope-discovery/schema/scope-manifest.schema.json (via the
 * shared manifest-validator module) and validates either:
 *
 *   - every example manifest under tools/scope-discovery/schema/examples/
 *     (default mode — the T2.1 acceptance gate)
 *   - a single manifest file passed via `--manifest <path>` (used by
 *     the synthesis pass T3.2 smoke-test and by ad-hoc operator runs
 *     against a curated/strawman manifest in a feature directory)
 *
 * Prints one line per file with PASS / FAIL; exits non-zero if any
 * fail.
 *
 * Run via:
 *   tsx tools/scope-discovery/schema/validate.ts
 *   tsx tools/scope-discovery/schema/validate.ts --manifest <path>
 *
 * Exit codes:
 *   0   all positive example manifests validate AND all negative-test
 *       manifests fail validation as expected (default mode)
 *       OR the single supplied --manifest validates (single-file mode)
 *   1   one or more positive examples failed, or one or more negative
 *       examples unexpectedly passed, or the supplied --manifest failed
 *   2   process / filesystem / parse error (schema not loadable etc.)
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ValidateFunction } from 'ajv';
import { parse as parseYaml } from 'yaml';
import { errorMessage, isEnoent } from '../util/typeguards.js';
import {
  compileManifestValidator,
  validateManifest,
  type ManifestValidationResult,
} from './manifest-validator.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(SCRIPT_DIR, 'examples');
const NEGATIVE_DIR = resolve(EXAMPLES_DIR, '_negative-tests');

interface ValidationOutcome {
  readonly file: string;
  readonly passed: boolean;
  readonly errors: ReadonlyArray<string>;
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
  const result: ManifestValidationResult = validateManifest(manifest, validate);
  return { file, passed: result.ok, errors: result.errors };
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

interface CliOptions {
  readonly manifestPath: string | null;
}

function parseCli(argv: ReadonlyArray<string>): CliOptions {
  let manifestPath: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--manifest') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--manifest requires a value');
      manifestPath = next;
      i += 1;
    } else if (a === '--help' || a === '-h') {
      throw new Error('HELP');
    } else {
      throw new Error(`unknown arg: ${a}`);
    }
  }
  return { manifestPath };
}

function printUsage(): void {
  process.stderr.write(
    [
      'Usage:',
      '  tsx tools/scope-discovery/schema/validate.ts                  # validate all examples',
      '  tsx tools/scope-discovery/schema/validate.ts --manifest <path> # validate a single manifest',
      '',
    ].join('\n'),
  );
}

async function runSingleFile(
  manifestPath: string,
  validate: ValidateFunction,
): Promise<number> {
  const abs = resolve(process.cwd(), manifestPath);
  const outcome = await runOneValidation(abs, validate);
  const ok = reportOutcome(outcome, true);
  return ok ? 0 : 1;
}

async function runExamplesSuite(validate: ValidateFunction): Promise<number> {
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
    if (!reportOutcome(outcome, true)) anyFailed = true;
  }
  for (const file of negativeFiles) {
    const outcome = await runOneValidation(file, validate);
    if (!reportOutcome(outcome, false)) anyFailed = true;
  }
  return anyFailed ? 1 : 0;
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch (err) {
    const msg = errorMessage(err);
    if (msg === 'HELP') {
      printUsage();
      return 0;
    }
    process.stderr.write(`${msg}\n`);
    printUsage();
    return 2;
  }

  let validate: ValidateFunction;
  try {
    validate = await compileManifestValidator();
  } catch (err) {
    console.error(`schema load/compile failed: ${errorMessage(err)}`);
    return 2;
  }

  return opts.manifestPath !== null
    ? runSingleFile(opts.manifestPath, validate)
    : runExamplesSuite(validate);
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
