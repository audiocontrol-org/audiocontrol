/**
 * tools/codegen-tab-active-state.ts
 *
 * Build-time codegen for `modules/roland-sxx0-editor/src/styles/
 * tab-active-state.css`. Reads the tab-group registry at
 * `docs/scope-discovery/tab-groups.yaml` and emits the four coupled
 * `:checked` selector blocks (lit-tab fill, tab underline, panel show,
 * reduced-motion) per registered tab id.
 *
 * Closes Phase 2 task 2.10 of feature/akai-harmonization (originally
 * TF-012). Replaces the manual 4-copies-per-tab-id discipline that
 * produced the silent-drop bug commit d5d99516 named — a tab id added
 * to 3 of the 4 selector lists silently broke one behavior (e.g.,
 * panel showed but underline didn't) and the specificity accident
 * hid the bug from screenshot review.
 *
 * The codegen is deterministic + reproducible: for the same registry
 * input the same CSS bytes come out, so the `--check` mode can hash-
 * compare the on-disk file against a fresh regeneration without any
 * timestamp noise. The generated file is byte-identical across runs
 * unless the registry changes.
 *
 * CLI surface:
 *   tsx tools/codegen-tab-active-state.ts
 *     # Writes the regenerated CSS to the canonical output path.
 *
 *   tsx tools/codegen-tab-active-state.ts --check
 *     # Computes what the CSS would be; compares against the on-disk
 *     # file. Exits 0 if identical; exits 1 if any byte differs (with
 *     # a summary of which selector blocks drifted).
 *
 *   tsx tools/codegen-tab-active-state.ts --in <yaml> --out <css>
 *     # Override the input registry and output CSS paths. Used by the
 *     # adversarial validator scenarios (which plant per-scenario
 *     # fixture registries in temp dirs).
 *
 * Exit codes:
 *   0   write succeeded, or `--check` and the CSS is in sync
 *   1   `--check` and the CSS drifted from what the registry implies
 *   2   infra error (unreadable registry, malformed YAML, schema
 *       violation, write failure)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { errorMessage } from './scope-discovery/util/typeguards.js';
import {
  allTabIds,
  loadRegistry,
  type TabGroupRegistry,
} from './scope-discovery/tab-groups-registry.js';

const DEFAULT_REGISTRY_PATH = 'docs/scope-discovery/tab-groups.yaml';
const DEFAULT_CSS_PATH = 'modules/roland-sxx0-editor/src/styles/tab-active-state.css';

// ────────────────────────────────────────────────────────────────────────────
// CSS rendering
// ────────────────────────────────────────────────────────────────────────────

/**
 * Render the entire generated CSS file as a string. Pure function of
 * the registry — no I/O, no timestamps, no commit-sha embedding.
 * Determinism is load-bearing: `--check` compares bytes, so any
 * non-pure input (timestamp, env var, locale-sensitive sort) would
 * make the check flaky.
 */
export function renderCss(registry: TabGroupRegistry): string {
  // Order: the input list's order is preserved. Within a group, the
  // YAML's `tab_ids:` order is preserved. This keeps the diff between
  // registry edits + regenerated CSS predictable.
  const tabIds = allTabIds(registry);
  if (tabIds.length === 0) {
    // Empty registry → emit just the file header so the gate still
    // has a target. The actual selector blocks below collapse to
    // nothing (no IDs to emit selectors for).
    return FILE_HEADER;
  }

  const padCol = computeSelectorPadColumn(tabIds);
  const litTabBlock = renderBlock(tabIds, padCol, {
    selectorTemplate: (id) => `~ .ac-radio-tab-strip [for="${id}"]`,
    body: [
      '  color: var(--ac-color-accent);',
      '  background: color-mix(in srgb, var(--ac-color-accent) 8%, transparent);',
    ],
  });
  const underlineBlock = renderBlock(tabIds, padCol, {
    selectorTemplate: (id) => `~ .ac-radio-tab-strip [for="${id}"]::after`,
    body: [
      '  background: var(--ac-color-accent);',
      '  box-shadow: 0 0 8px color-mix(in srgb, var(--ac-color-accent) 55%, transparent);',
    ],
  });
  const panelShowBlock = renderBlock(tabIds, padCol, {
    selectorTemplate: (id) => `~ .ac-radio-panels > [data-tab="${id}"]`,
    body: [
      '  display: block;',
      '  animation: ac-tab-fade-in 180ms var(--ac-easing-default);',
    ],
  });
  const reducedMotionBlock = renderReducedMotionBlock(tabIds, padCol);

  return [
    FILE_HEADER,
    litTabBlock,
    '',
    underlineBlock,
    '',
    panelShowBlock,
    '',
    reducedMotionBlock,
    '',
  ].join('\n');
}

const FILE_HEADER = `/**
 * Tab active-state selector list — per-tab-ID \`:checked\` chains for
 * roland's uncontrolled-mode AcRadioTabs adopters (tones + patches
 * pages) plus the akai mockup-staging ids reserved for the akai
 * editor's eventual adoption.
 *
 * AUTO-GENERATED from \`docs/scope-discovery/tab-groups.yaml\` by
 * \`tools/codegen-tab-active-state.ts\`. Do not edit by hand — your
 * changes will be overwritten the next time the codegen runs. Edit
 * the YAML registry instead and run \`make codegen-tab-active-state\`
 * (or let the pre-commit gate \`make check-tab-active-state\` catch
 * any drift).
 *
 * The generic tab chrome (\`.ac-radio-tabs\`, \`.ac-radio-tab-strip\`,
 * \`.ac-radio-tab\`, \`.ac-radio-panels\`, \`.ac-radio-panel\`,
 * \`.ac-panel-stack\`, the \`ac-tab-fade-in\` keyframes) lives in
 * \`editor-core/src/design/tab-primitives.css\` so cross-editor consumers
 * get it without duplication. The per-tab-ID selector chains below
 * STAY HERE (and not in editor-core) because the radio-input ids are
 * consumer-owned: roland uses \`tt-*\` / \`pt-*\`; akai uses \`ap-*\` /
 * \`ak-*\` / \`as-*\`. Each new uncontrolled-mode adopter registers its
 * ids in the YAML registry; the four selector blocks below regenerate.
 *
 * Controlled-mode adopters (akai VelocityZoneEditor via the
 * \`activeId\` + \`onActiveIdChange\` props on AcRadioTabs) do NOT
 * register here — controlled mode renders only the active panel via
 * React state, bypassing the \`:checked\` selector chain.
 *
 * Co-located in roland's styles directory rather than editor-core
 * because the consumer-owned ids are intentionally consumer-specific.
 */

`;

/**
 * Compute the alignment column for `~` across every selector line in
 * the generated blocks. The padding goal: every selector line's `~`
 * starts at the same column, regardless of how short or long the
 * individual tab id is. Picks `max(\`#{id}:checked\`.length) + 2` so
 * the longest id has at least 2 trailing spaces before `~` and
 * shorter ids get proportionally more.
 */
function computeSelectorPadColumn(allIds: readonly string[]): number {
  const maxPrefixLen = allIds.reduce((acc, id) => {
    const prefixLen = 1 /* # */ + id.length + ':checked'.length;
    return prefixLen > acc ? prefixLen : acc;
  }, 0);
  return maxPrefixLen + 2;
}

function padSelectorPrefix(tabId: string, padCol: number): string {
  const prefix = `#${tabId}:checked`;
  const spaces = ' '.repeat(Math.max(1, padCol - prefix.length));
  return prefix + spaces;
}

interface BlockSpec {
  /** Returns the part of the selector after the padded `#<id>:checked` prefix. */
  readonly selectorTemplate: (tabId: string) => string;
  /** Lines forming the rule body (each already prefixed with two-space indent). */
  readonly body: readonly string[];
}

/**
 * Render one of the top-level selector blocks (lit-tab, underline,
 * panel-show). DRY across the three top-level blocks; the
 * reduced-motion block lives below because it needs the `@media`
 * wrapper and a deeper indent.
 */
function renderBlock(
  tabIds: readonly string[],
  padCol: number,
  spec: BlockSpec,
): string {
  const selectorLines = tabIds.map((id, idx) => {
    const sep = idx === tabIds.length - 1 ? ' {' : ',';
    return `${padSelectorPrefix(id, padCol)}${spec.selectorTemplate(id)}${sep}`;
  });
  return [...selectorLines, ...spec.body, '}'].join('\n');
}

function renderReducedMotionBlock(tabIds: readonly string[], padCol: number): string {
  // Inner indent is 2 spaces deeper than the top-level blocks to sit
  // inside the `@media` wrapper. The selector prefix's padding column
  // is the same; the leading 2-space indent renders identically across
  // lines.
  const indent = '  ';
  const selectorLines = tabIds.map((id, idx) => {
    const sep = idx === tabIds.length - 1 ? ' {' : ',';
    return `${indent}${padSelectorPrefix(id, padCol)}~ .ac-radio-panels > [data-tab="${id}"]${sep}`;
  });
  return [
    '@media (prefers-reduced-motion: reduce) {',
    ...selectorLines,
    '    animation: none;',
    '  }',
    '}',
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// CLI driver
// ────────────────────────────────────────────────────────────────────────────

export interface CliOptions {
  readonly registryPath: string;
  readonly cssPath: string;
  readonly check: boolean;
}

export function parseCli(argv: readonly string[]): CliOptions {
  let registryPath = DEFAULT_REGISTRY_PATH;
  let cssPath = DEFAULT_CSS_PATH;
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--in':
        registryPath = argv[i + 1] ?? registryPath;
        i += 1;
        break;
      case '--out':
        cssPath = argv[i + 1] ?? cssPath;
        i += 1;
        break;
      case '--check':
        check = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { registryPath, cssPath, check };
}

async function main(argv: readonly string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`codegen-tab-active-state: ${errorMessage(err)}\n`);
    return 2;
  }
  let registry: TabGroupRegistry;
  try {
    registry = await loadRegistry(opts.registryPath);
  } catch (err) {
    process.stderr.write(`codegen-tab-active-state: ${errorMessage(err)}\n`);
    return 2;
  }
  const generated = renderCss(registry);
  if (opts.check) {
    return runCheck(opts.cssPath, opts.registryPath, generated);
  }
  try {
    await writeFile(opts.cssPath, generated, 'utf8');
  } catch (err) {
    process.stderr.write(
      `codegen-tab-active-state: cannot write CSS ${opts.cssPath}: ${errorMessage(err)}\n`,
    );
    return 2;
  }
  const totalTabIds = allTabIds(registry).length;
  process.stdout.write(
    `codegen-tab-active-state: wrote ${opts.cssPath} (${registry.tabGroups.length} groups, ${totalTabIds} tab ids)\n`,
  );
  return 0;
}

async function runCheck(
  cssPath: string,
  registryPath: string,
  generated: string,
): Promise<number> {
  let onDisk: string;
  try {
    onDisk = await readFile(cssPath, 'utf8');
  } catch (err) {
    process.stderr.write(
      `codegen-tab-active-state: --check cannot read CSS ${cssPath}: ${errorMessage(err)}\n`,
    );
    return 2;
  }
  if (onDisk === generated) {
    process.stdout.write(
      `codegen-tab-active-state: OK — ${cssPath} is in sync with ${registryPath}\n`,
    );
    return 0;
  }
  process.stderr.write(
    `codegen-tab-active-state: DRIFT — ${cssPath} differs from regeneration of ${registryPath}.\n`,
  );
  process.stderr.write(formatDriftReport(onDisk, generated));
  process.stderr.write(
    `Fix: run \`make codegen-tab-active-state\` to regenerate, then re-commit.\n`,
  );
  return 1;
}

/**
 * Format a human-readable summary of which selector blocks drifted.
 * Not a full unified diff — we want the operator to see WHICH tab
 * ids appear in one side but not the other (the precise failure mode
 * the bug at d5d99516 named), without a 100-line diff dump.
 */
function formatDriftReport(onDisk: string, generated: string): string {
  const onDiskIds = extractTabIdsFromCss(onDisk);
  const generatedIds = extractTabIdsFromCss(generated);
  const inDiskOnly = [...onDiskIds].filter((id) => !generatedIds.has(id)).sort();
  const inGenOnly = [...generatedIds].filter((id) => !onDiskIds.has(id)).sort();
  const lines: string[] = [];
  if (inDiskOnly.length > 0) {
    lines.push(
      `  on-disk CSS references ${inDiskOnly.length} tab id(s) NOT in the registry:`,
    );
    inDiskOnly.forEach((id) => lines.push(`    - ${id}`));
  }
  if (inGenOnly.length > 0) {
    lines.push(
      `  registry implies ${inGenOnly.length} tab id(s) NOT in the on-disk CSS:`,
    );
    inGenOnly.forEach((id) => lines.push(`    - ${id}`));
  }
  if (inDiskOnly.length === 0 && inGenOnly.length === 0) {
    // ID sets match but bytes differ — likely whitespace, comment, or
    // block-ordering drift. Surface that so the operator doesn't have
    // to hand-diff to figure out what changed.
    lines.push(
      `  tab id sets match between on-disk and registry, but byte content differs;`,
    );
    lines.push(
      `  likely whitespace / comment / block-ordering drift. Regenerate to normalize.`,
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Extract the set of unique tab ids referenced by `#<id>:checked`
 * selectors in a CSS body. Used by the drift report to compare
 * id sets symbolically rather than as opaque bytes.
 */
function extractTabIdsFromCss(css: string): Set<string> {
  const result = new Set<string>();
  const re = /#([a-z][a-z0-9-]*):checked/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    result.add(m[1]!);
  }
  return result;
}

// Invoked-as-script guard: the file is also imported by the
// adversarial validator scenarios (which need the `parseCli` /
// `renderCss` exports). The CLI driver should only fire when this
// file is the process entry point.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`codegen-tab-active-state crashed: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
