/**
 * tools/scope-discovery/batch-dispose.fixtures.ts
 *
 * Shared fixture + IO helpers for `batch-dispose.validate.ts`. Extracted
 * so the validator file stays under the 300-500 line cap and so future
 * scenarios reuse the same fixture-builder / IO-capture surface.
 *
 * The helpers here intentionally know about:
 *   - `.tmp/`-scoped fixture directories (per-scenario, per-run id).
 *   - The `CloneGroup` shape from `clones-yaml.ts` (we mint synthetic
 *     groups without going through `makeCloneGroup` — content-hashed ids
 *     don't matter for these scenarios; we set the id directly).
 *   - The `BatchDisposeIO` injection surface (capture stdout/stderr in-
 *     process; substitute the writer to simulate forged + gutted writes).
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BatchDisposeIO } from './batch-dispose.js';
import { type CloneGroup, serializeClonesYaml } from './clones-yaml.js';

export const TMP_ROOT = '.tmp';
export const ROLAND_SRC = 'modules/roland-sxx0-editor/src/';

/** Roman-numeral synthetic disposition: only the three applyable values. */
type SyntheticDisposition =
  | 'pending'
  | 'keep-with-reason'
  | 'ignore-with-justification';

/**
 * Mint a synthetic CloneGroup with a caller-supplied id. We bypass
 * `makeCloneGroup` because the validator doesn't care about id
 * stability — the count + disposition + reason math is what's under
 * test.
 */
export function syntheticGroup(args: {
  id: string;
  members: readonly string[];
  disposition: SyntheticDisposition;
  reason?: string | null;
}): CloneGroup {
  return {
    id: args.id,
    lines: 8,
    members: [...args.members].sort(),
    disposition: args.disposition,
    reason: args.reason ?? null,
  };
}

export interface Fixture {
  readonly dir: string;
  readonly path: string;
}

/** Create a per-scenario fixture directory under `.tmp/batch-dispose-validator-*`. */
export async function makeFixture(label: string): Promise<Fixture> {
  const runId = Math.random().toString(36).slice(2, 8);
  const dir = join(TMP_ROOT, `batch-dispose-validator-${label}-${runId}`);
  await mkdir(dir, { recursive: true });
  return { dir, path: join(dir, 'clones.yaml') };
}

/**
 * Helper: open a fixture, run the body, always remove the dir even on
 * throw. Collapses every scenario's try/finally boilerplate; without
 * this the validator overruns the 300-500 line file cap.
 */
export async function withFixture<T>(
  label: string,
  body: (fixture: Fixture) => Promise<T>,
): Promise<T> {
  const fixture = await makeFixture(label);
  try {
    return await body(fixture);
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
}

/** Serialize + write a clones.yaml at `path` via the canonical writer. */
export async function writeClonesYaml(
  path: string,
  clones: readonly CloneGroup[],
): Promise<void> {
  const text = serializeClonesYaml({
    generated_at: '2026-05-22T00:00:00.000Z',
    clones: [...clones],
  });
  await writeFile(path, text, 'utf8');
}

export interface CapturedIO {
  readonly io: BatchDisposeIO;
  readonly stdout: () => string;
  readonly stderr: () => string;
}

/**
 * Capture stdout/stderr in-process. The IO surface forwards readFile +
 * writeFile straight to the real fs so the validator can assert on the
 * file's post-state.
 */
export function makeCapturedIO(): CapturedIO {
  let stdoutBuf = '';
  let stderrBuf = '';
  return {
    io: {
      readFile: (path) => readFile(path, 'utf8'),
      writeFile: (path, contents) => writeFile(path, contents, 'utf8'),
      stdout: (line) => {
        stdoutBuf += line;
      },
      stderr: (line) => {
        stderrBuf += line;
      },
    },
    stdout: () => stdoutBuf,
    stderr: () => stderrBuf,
  };
}

/**
 * Build an IO that writes correctly THEN forges a mutation. Used by the
 * verify-after-write scenario to confirm the verify step actually
 * catches a post-write mutation (the failure mode T7.4 exists to
 * prevent).
 */
export function makeForgedWriteIO(args: {
  readonly findReason: string;
  readonly replaceReason: string;
}): CapturedIO {
  let stdoutBuf = '';
  let stderrBuf = '';
  return {
    io: {
      readFile: (path) => readFile(path, 'utf8'),
      writeFile: async (path, contents) => {
        await writeFile(path, contents, 'utf8');
        const forged = contents.replace(
          `reason: ${args.findReason}`,
          `reason: ${args.replaceReason}`,
        );
        await writeFile(path, forged, 'utf8');
      },
      stdout: (line) => {
        stdoutBuf += line;
      },
      stderr: (line) => {
        stderrBuf += line;
      },
    },
    stdout: () => stdoutBuf,
    stderr: () => stderrBuf,
  };
}

/**
 * Build an IO whose writer is a no-op. Used by the gutted-stub
 * self-check: the validator must reject this stub because the
 * pre-existing on-disk disposition does NOT match the requested one,
 * so verify-after-write must fail.
 */
export function makeGuttedWriterIO(): CapturedIO {
  let stdoutBuf = '';
  let stderrBuf = '';
  return {
    io: {
      readFile: (path) => readFile(path, 'utf8'),
      writeFile: async () => {
        /* gutted-stub: never actually writes */
      },
      stdout: (line) => {
        stdoutBuf += line;
      },
      stderr: (line) => {
        stderrBuf += line;
      },
    },
    stdout: () => stdoutBuf,
    stderr: () => stderrBuf,
  };
}
