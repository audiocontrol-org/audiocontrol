/**
 * tools/scope-discovery/synthesis.ts — T3.2 synthesis pass.
 *
 * Consumes the discriminated-union DiscoveryAgentFinding[] from the
 * T3.1 fleet, deduplicates + ranks the signal, and emits a strawman
 * scope-manifest.yaml validated against the T2.1 schema before write.
 *
 * Kind detection branches on the `agent` tag: ui-only → 'ui';
 * ast/clone-only → 'code'; both → 'hybrid'; neither → throw.
 * Per-section derivation lives in synthesis-derive.ts; validation via
 * schema/manifest-validator.ts (DRY with validate.ts).
 *
 * CLI: tsx tools/scope-discovery/synthesis.ts --feature <slug>
 *      --prd-path <path> --findings <p1> <p2> ... [--out <path>]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type {
  AstGrepMatrixFindings,
  CloneDetectorFindings,
  DiscoveryAgentFinding,
  DiscoveryAgentName,
  PrdThemedFindings,
  UiRouteFindings,
} from './discovery-agents/types.js';
import { isDiscoveryAgentFinding } from './discovery-agents/types.js';
import type {
  ManifestKind,
  ScopeManifest,
  SynthesisInput,
  SynthesisOutput,
} from './synthesis-types.js';
import {
  defaultScenarioId,
  deriveModules,
  deriveReferenceDocs,
  deriveRoutes,
  deriveScenarios,
  deriveThemes,
} from './synthesis-derive.js';
import {
  compileManifestValidator,
  validateManifest,
} from './schema/manifest-validator.js';
import { errorMessage } from './util/typeguards.js';

interface PartitionedFindings {
  readonly ui: ReadonlyArray<UiRouteFindings>;
  readonly ast: ReadonlyArray<AstGrepMatrixFindings>;
  readonly clones: ReadonlyArray<CloneDetectorFindings>;
  readonly themes: ReadonlyArray<PrdThemedFindings>;
  readonly agentsConsumed: ReadonlyArray<DiscoveryAgentName>;
  readonly rawCount: number;
}

function partition(
  findings: ReadonlyArray<DiscoveryAgentFinding>,
): PartitionedFindings {
  const ui: UiRouteFindings[] = [];
  const ast: AstGrepMatrixFindings[] = [];
  const clones: CloneDetectorFindings[] = [];
  const themes: PrdThemedFindings[] = [];
  const seenAgents = new Set<DiscoveryAgentName>();
  let rawCount = 0;
  for (const f of findings) {
    seenAgents.add(f.agent);
    switch (f.agent) {
      case 'ui-route-enumerator':
        ui.push(f);
        rawCount += f.routes.length;
        break;
      case 'ast-grep-matrix':
        ast.push(f);
        rawCount += f.patterns.length;
        break;
      case 'clone-detector-reader':
        clones.push(f);
        rawCount += f.clones.length;
        break;
      case 'prd-themed-pattern-hunter':
        themes.push(f);
        rawCount += f.themes.length;
        break;
    }
  }
  return { ui, ast, clones, themes, rawCount, agentsConsumed: Array.from(seenAgents).sort() };
}

function determineKind(p: PartitionedFindings): ManifestKind {
  const hasUi = p.ui.length > 0;
  const hasCode = p.ast.length > 0 || p.clones.length > 0;
  if (hasUi && hasCode) return 'hybrid';
  if (hasUi) return 'ui';
  if (hasCode) return 'code';
  throw new Error(
    'synthesis: no UI/AST/clone findings present — cannot determine manifest kind. ' +
      'At least one of ui-route-enumerator / ast-grep-matrix / clone-detector-reader must ' +
      'contribute findings (themes-only input is insufficient).',
  );
}

/** Public synthesis entrypoint. Throws on derivation/validation failure (no silent fallback). */
export async function synthesize(input: SynthesisInput): Promise<SynthesisOutput> {
  if (input.findings.length === 0) {
    throw new Error('synthesize: input.findings is empty');
  }
  const partitioned = partition(input.findings);
  const kind = determineKind(partitioned);

  const scenarios = deriveScenarios();
  const scenarioId = defaultScenarioId();
  const routes =
    kind === 'ui' || kind === 'hybrid'
      ? deriveRoutes(partitioned.ui, scenarioId)
      : undefined;
  const modules =
    kind === 'code' || kind === 'hybrid'
      ? deriveModules({ astFindings: partitioned.ast, cloneFindings: partitioned.clones })
      : undefined;
  const themesList = deriveThemes(partitioned.themes);
  const referenceDocs = await deriveReferenceDocs({
    prdPath: input.prdPath,
    prdRelPath: input.prdRelPath,
  });

  const generatedAt = new Date().toISOString();
  const finalCount = (routes?.length ?? 0) + (modules?.length ?? 0) + themesList.length;
  const dedupCount = Math.max(0, partitioned.rawCount - finalCount);

  const manifest: ScopeManifest = {
    kind,
    feature_slug: input.featureSlug,
    generated_by: 'strawman',
    generated_at: generatedAt,
    scenarios,
    reference_docs: referenceDocs,
    discovery_themes:
      themesList.length > 0
        ? themesList
        : ['scope-discovery (strawman placeholder; operator curates)'],
    ...(routes !== undefined ? { routes } : {}),
    ...(modules !== undefined ? { modules } : {}),
    notes:
      `Strawman synthesized from ${partitioned.agentsConsumed.length} discovery agent(s) ` +
      `(${partitioned.agentsConsumed.join(', ')}). Operator curates devices/scenarios/primitives.`,
  };

  const validator = await compileManifestValidator();
  const result = validateManifest(manifest, validator);
  if (!result.ok) {
    throw new Error(
      `synthesis produced a manifest that fails the T2.1 schema:\n  - ${result.errors.join('\n  - ')}`,
    );
  }

  return {
    manifest,
    metadata: {
      generatedAt,
      agentsConsumed: partitioned.agentsConsumed,
      dedupCount,
      findingsCount: input.findings.length,
    },
  };
}

// ---- CLI ----

interface CliOptions {
  readonly featureSlug: string;
  readonly prdPath: string;
  readonly findingsPaths: ReadonlyArray<string>;
  readonly outPath: string | null;
  readonly repoRoot: string;
}

function parseCli(argv: ReadonlyArray<string>): CliOptions {
  const scalars = new Map<string, string>();
  const findingsPaths: string[] = [];
  let mode: 'scalar' | 'findings' = 'scalar';
  const SCALAR_FLAGS = new Set(['--feature', '--prd-path', '--out', '--repo-root']);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') throw new Error('HELP');
    if (a === '--findings') {
      mode = 'findings';
      continue;
    }
    if (a !== undefined && SCALAR_FLAGS.has(a)) {
      mode = 'scalar';
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} requires a value`);
      scalars.set(a, v);
      continue;
    }
    if (mode === 'findings' && a !== undefined && !a.startsWith('--')) {
      findingsPaths.push(a);
      continue;
    }
    throw new Error(`unknown or misplaced arg: ${a}`);
  }
  const featureSlug = scalars.get('--feature');
  const prdPath = scalars.get('--prd-path');
  if (featureSlug === undefined) throw new Error('--feature is required');
  if (prdPath === undefined) throw new Error('--prd-path is required');
  if (findingsPaths.length === 0) throw new Error('--findings requires at least one path');
  const root = resolve(scalars.get('--repo-root') ?? process.cwd());
  return {
    featureSlug,
    prdPath: isAbsolute(prdPath) ? prdPath : resolve(root, prdPath),
    findingsPaths,
    outPath: scalars.get('--out') ?? null,
    repoRoot: root,
  };
}

async function loadFinding(path: string): Promise<DiscoveryAgentFinding> {
  const text = await readFile(path, 'utf8');
  const parsed: unknown = JSON.parse(text);
  if (!isDiscoveryAgentFinding(parsed)) {
    throw new Error(`${path}: not a DiscoveryAgentFinding (missing/unknown agent tag)`);
  }
  return parsed;
}

const USAGE =
  'Usage: tsx tools/scope-discovery/synthesis.ts \\\n' +
  '    --feature <slug> --prd-path <path-to-prd.md> \\\n' +
  '    --findings <path1> <path2> ... [--out <path>] [--repo-root <path>]\n';

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch (err) {
    const msg = errorMessage(err);
    if (msg === 'HELP') {
      process.stderr.write(USAGE);
      return 0;
    }
    process.stderr.write(`synthesis: ${msg}\n${USAGE}`);
    return 2;
  }
  const findings: DiscoveryAgentFinding[] = [];
  for (const p of opts.findingsPaths) {
    try {
      findings.push(await loadFinding(p));
    } catch (err) {
      process.stderr.write(`synthesis: ${errorMessage(err)}\n`);
      return 1;
    }
  }
  let output: SynthesisOutput;
  try {
    output = await synthesize({
      featureSlug: opts.featureSlug,
      findings,
      prdPath: opts.prdPath,
      prdRelPath: relative(opts.repoRoot, opts.prdPath),
    });
  } catch (err) {
    process.stderr.write(`synthesis: ${errorMessage(err)}\n`);
    return 1;
  }
  const yamlText = stringifyYaml(output.manifest);
  if (opts.outPath === null) {
    process.stdout.write(yamlText);
    return 0;
  }
  const abs = isAbsolute(opts.outPath) ? opts.outPath : resolve(opts.repoRoot, opts.outPath);
  try {
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, yamlText, 'utf8');
  } catch (err) {
    process.stderr.write(`synthesis: write failed: ${errorMessage(err)}\n`);
    return 2;
  }
  process.stderr.write(
    `synthesis: wrote ${abs} (kind=${output.manifest.kind}, ` +
      `agents=${output.metadata.agentsConsumed.join('+')}, ` +
      `findings=${output.metadata.findingsCount}, ` +
      `dedup-savings=${output.metadata.dedupCount})\n`,
  );
  return 0;
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('synthesis.ts')) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`synthesis: unexpected failure: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
