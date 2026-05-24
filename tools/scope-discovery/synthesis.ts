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
  RegimeHoldoutFindings,
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
  deriveRegimeHoldouts,
  deriveRoutes,
  deriveScenarios,
  deriveThemes,
} from './synthesis-derive.js';
import {
  compileManifestValidator,
  validateManifest,
} from './schema/manifest-validator.js';
import { errorMessage } from './util/typeguards.js';

/**
 * Schema-aligned slug shape, kept literally in sync with the regex on
 * `feature_slug` (and other slug-shaped ids) in
 * tools/scope-discovery/schema/scope-manifest.schema.json. Validating
 * here, at CLI parse time, surfaces a clear "bad input" error instead
 * of letting the failure leak out as a downstream ajv message that
 * sounds like the synthesizer misbehaved.
 */
const FEATURE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

interface PartitionedFindings {
  readonly ui: ReadonlyArray<UiRouteFindings>;
  readonly ast: ReadonlyArray<AstGrepMatrixFindings>;
  readonly clones: ReadonlyArray<CloneDetectorFindings>;
  readonly themes: ReadonlyArray<PrdThemedFindings>;
  readonly regime: ReadonlyArray<RegimeHoldoutFindings>;
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
  const regime: RegimeHoldoutFindings[] = [];
  const seenAgents = new Set<DiscoveryAgentName>();
  // rawCount counts the *signal* the agents handed us — individual
  // hits, clone members, route entries, theme matches — NOT just the
  // top-level pattern/clone-group counts. This way `dedupCount` =
  // rawCount - emittedUnique is a meaningful "input → output reduction"
  // number rather than something that needs to be clamped to non-negative.
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
        for (const pattern of f.patterns) {
          rawCount += pattern.hits.length;
        }
        break;
      case 'clone-detector-reader':
        clones.push(f);
        for (const group of f.clones) {
          rawCount += group.members.length;
        }
        break;
      case 'prd-themed-pattern-hunter':
        themes.push(f);
        for (const theme of f.themes) {
          rawCount += theme.occurrences.length;
        }
        break;
      case 'regime-holdout-detector':
        regime.push(f);
        rawCount += f.findings.length;
        break;
    }
  }
  return {
    ui,
    ast,
    clones,
    themes,
    regime,
    rawCount,
    agentsConsumed: Array.from(seenAgents).sort(),
  };
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
  // AUDIT-20260524-11 — `deriveModules` now consumes the PRD-themed
  // findings to honor the PRD's `## In Scope` / `## Out of Scope`
  // sections (dropping excluded modules + annotating low-relevance
  // ones). The returned `warnings` get folded into the synthesis-level
  // warning list so the operator sees which modules were pruned.
  const moduleResult =
    kind === 'code' || kind === 'hybrid'
      ? deriveModules({
          astFindings: partitioned.ast,
          cloneFindings: partitioned.clones,
          prdThemedFindings: partitioned.themes,
        })
      : undefined;
  const modules = moduleResult?.modules;
  const themesList = deriveThemes(partitioned.themes);
  // Empty themes is a real "no signal" outcome — either no PrdThemedFindings
  // was passed in, or the prd-themed-pattern-hunter agent ran but matched
  // nothing. Both cases warrant operator investigation (agent broke, PRD
  // has nothing themable, or tokenizer is wrong). Emitting a literal
  // "placeholder" string is the deferral-shape the project's
  // agent-discipline rules forbid; fail loudly instead.
  if (themesList.length === 0) {
    throw new Error(
      'synthesis: PRD-themed agent contributed no themes; cannot produce a ' +
        'manifest. Either no prd-themed-pattern-hunter findings were passed ' +
        'in (re-run with --findings including that agent\'s output) or the ' +
        'agent ran and matched zero terms (investigate the PRD content or ' +
        'the agent\'s tokenizer).',
    );
  }
  const warnings: string[] = [];
  if (moduleResult !== undefined) {
    for (const w of moduleResult.warnings) warnings.push(w);
  }
  const refDocsResult = await deriveReferenceDocs({
    prdPath: input.prdPath,
    prdRelPath: input.prdRelPath,
  });
  const referenceDocs = refDocsResult.refs;
  for (const w of refDocsResult.warnings) warnings.push(w);
  const regimeHoldouts = deriveRegimeHoldouts(partitioned.regime);
  // Notes the operator should see in synthesis.md beyond the
  // reference-docs fallback. Each entry is a single line; the skill
  // renders them as a bulleted list under `## Synthesizer notes`.
  if (regimeHoldouts === null) {
    warnings.push(
      'No regime-holdout-detector findings supplied; manifest omits `regime_holdouts:` section. ' +
        'Run the agent to surface anti-pattern / adopter-manifest / editor-symmetry / deprecation holdouts.',
    );
  }
  if (kind === 'ui' && partitioned.ui.length > 0) {
    const totalRoutes = partitioned.ui.reduce((n, f) => n + f.routes.length, 0);
    if (totalRoutes <= 1) {
      warnings.push(
        `ui-route-enumerator surfaced only ${totalRoutes} route(s); the UI surface may be ` +
          'under-walked. Re-run with a deeper crawl or supply additional UI findings.',
      );
    }
  }

  const generatedAt = new Date().toISOString();
  // rawCount sums *all* signal entries (hits, clone members, routes,
  // theme occurrences, regime-holdout findings). finalCount is the
  // count of unique emitted manifest entries. dedupCount is the
  // reduction — should always be non-negative under the new counting
  // because finalCount can never exceed the source signal it was
  // derived from. (If it does, the assertion below catches it; no
  // silent clamp.)
  const finalCount =
    (routes?.length ?? 0) +
    (modules?.length ?? 0) +
    themesList.length +
    (regimeHoldouts?.meta.total ?? 0);
  const dedupCount = partitioned.rawCount - finalCount;
  if (dedupCount < 0) {
    throw new Error(
      `synthesis: dedupCount went negative (raw=${partitioned.rawCount}, ` +
        `final=${finalCount}); raw-count metric is miscounting signal vs ` +
        'emitted entries. This is a bug in partition() or the derive helpers.',
    );
  }

  const manifest: ScopeManifest = {
    kind,
    feature_slug: input.featureSlug,
    generated_by: 'strawman',
    generated_at: generatedAt,
    scenarios,
    reference_docs: referenceDocs,
    // themesList.length > 0 is guaranteed by the early throw above.
    discovery_themes: themesList,
    ...(routes !== undefined ? { routes } : {}),
    ...(modules !== undefined ? { modules } : {}),
    ...(regimeHoldouts !== null ? { regime_holdouts: regimeHoldouts } : {}),
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
      warnings,
    },
  };
}

// ---- CLI ----

interface CliOptions {
  readonly featureSlug: string;
  readonly prdPath: string;
  readonly findingsPaths: ReadonlyArray<string>;
  readonly outPath: string | null;
  readonly notesOutPath: string | null;
  readonly repoRoot: string;
}

function parseCli(argv: ReadonlyArray<string>): CliOptions {
  const scalars = new Map<string, string>();
  const findingsPaths: string[] = [];
  let mode: 'scalar' | 'findings' = 'scalar';
  const SCALAR_FLAGS = new Set([
    '--feature',
    '--prd-path',
    '--out',
    '--notes-out',
    '--repo-root',
  ]);
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
  if (!FEATURE_SLUG_REGEX.test(featureSlug)) {
    throw new Error(
      `--feature '${featureSlug}' is not a valid feature slug ` +
        '(must match ^[a-z0-9][a-z0-9-]*[a-z0-9]$ — lowercase alphanumeric ' +
        '+ dashes, no leading/trailing dash, min 2 chars)',
    );
  }
  if (prdPath === undefined) throw new Error('--prd-path is required');
  if (findingsPaths.length === 0) throw new Error('--findings requires at least one path');
  const root = resolve(scalars.get('--repo-root') ?? process.cwd());
  return {
    featureSlug,
    prdPath: isAbsolute(prdPath) ? prdPath : resolve(root, prdPath),
    findingsPaths,
    outPath: scalars.get('--out') ?? null,
    notesOutPath: scalars.get('--notes-out') ?? null,
    repoRoot: root,
  };
}

/**
 * Render the synthesizer's warnings as a markdown fragment whose
 * top-level heading matches the section name the scope-inventory skill
 * (`SKILL.md` §8) splices into `synthesis.md`. When `warnings` is
 * empty, the fragment STILL emits the heading with a "clean — no notes"
 * single-line body so the section's presence is invariant.
 */
function renderSynthesizerNotes(warnings: ReadonlyArray<string>): string {
  const lines: string[] = ['## Synthesizer notes', ''];
  if (warnings.length === 0) {
    lines.push('clean — no notes from this run.');
  } else {
    // Multi-line warnings (e.g., the AUDIT-20260524-12 References
    // skeleton) need continuation-line indentation so the whole block
    // renders as a single markdown bullet rather than fragmenting into
    // a bullet + loose paragraphs. First line gets `- `; subsequent
    // lines get two-space indent; intentional blank lines inside the
    // warning are preserved without the indent (so the embedded
    // markdown fence still parses).
    for (const w of warnings) {
      const wLines = w.split('\n');
      const [first, ...rest] = wLines;
      lines.push(`- ${first ?? ''}`);
      for (const cont of rest) {
        lines.push(cont === '' ? '' : `  ${cont}`);
      }
    }
  }
  lines.push('');
  return lines.join('\n');
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
  '    --findings <path1> <path2> ... [--out <path>] [--notes-out <path>] [--repo-root <path>]\n';

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
  // Surface warnings on stderr (legacy channel) AND, when --notes-out
  // is supplied, write a `## Synthesizer notes` markdown fragment so
  // the scope-inventory skill can splice it into `synthesis.md` without
  // re-deriving the warning set. T7.5 polish — keeps notes off stderr-
  // only so the operator sees them in the run-dir reading-surface.
  for (const w of output.metadata.warnings) {
    process.stderr.write(`synthesis: note: ${w}\n`);
  }
  if (opts.notesOutPath !== null) {
    const notesAbs = isAbsolute(opts.notesOutPath)
      ? opts.notesOutPath
      : resolve(opts.repoRoot, opts.notesOutPath);
    try {
      await mkdir(dirname(notesAbs), { recursive: true });
      await writeFile(notesAbs, renderSynthesizerNotes(output.metadata.warnings), 'utf8');
    } catch (err) {
      process.stderr.write(`synthesis: notes write failed: ${errorMessage(err)}\n`);
      return 2;
    }
  }
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
