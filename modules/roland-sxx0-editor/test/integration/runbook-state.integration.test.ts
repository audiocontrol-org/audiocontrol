import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Classification =
  | 'applicable'
  | 'already-satisfied'
  | 'obsolete-at-head'
  | 'blocked'
  | 'manual-only';

type StateProbe =
  | { type: 'inventory-row'; id: string }
  | { type: 'finding-status'; id: string };

interface ManifestStep {
  id: string;
  section: string;
  title: string;
  snapshot_sha: string;
  requires_hardware: boolean;
  mutates_repo: boolean;
  signal_type: 'command' | 'playwright-live' | 'manual' | 'git/github';
  finding_or_issue: string;
  state_probe: StateProbe;
  expected_snapshot_state: Record<string, string>;
  head_applicability_rule: string;
  current_head_classification: Classification;
  closure_artifact: string;
}

interface InventoryRowState {
  signOff: string;
  coverage: string;
}

const manifestPath = resolve(
  process.cwd(),
  '../../docs/1.0/001-IN-PROGRESS/s550-support/operator-review-runbook.manifest.json'
);
const auditLogPath = resolve(
  process.cwd(),
  '../../docs/1.0/001-IN-PROGRESS/s550-support/audit-log.md'
);
const inventoryPath = resolve(process.cwd(), '../../ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md');
const currentRunbookPath = resolve(
  process.cwd(),
  '../../docs/1.0/001-IN-PROGRESS/s550-support/operator-review-runbook-current.md'
);

function readManifest(): ManifestStep[] {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestStep[];
}

function readAuditStatus(findingId: string): string {
  const content = readFileSync(auditLogPath, 'utf8');
  const escapedId = findingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`Finding-ID: ${escapedId}\\nStatus: ([^\\n]+)`));
  if (!match) {
    throw new Error(`Finding status not found for ${findingId}`);
  }
  return match[1];
}

function readInventoryRowState(rowId: string): InventoryRowState {
  const content = readFileSync(inventoryPath, 'utf8');
  const line = content
    .split('\n')
    .find((candidate) => candidate.startsWith(`| ${rowId} |`));
  if (!line) {
    throw new Error(`Inventory row not found for ${rowId}`);
  }
  const cells = line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (cells.length < 8) {
    throw new Error(`Inventory row for ${rowId} had unexpected shape: ${line}`);
  }

  return {
    signOff: cells[6],
    coverage: cells[7],
  };
}

function classifyStep(step: ManifestStep): Classification {
  if (step.signal_type === 'git/github') {
    return 'manual-only';
  }

  if (step.state_probe.type === 'inventory-row') {
    const state = readInventoryRowState(step.state_probe.id);
    if (step.id === 'RUNBOOK-1.1-D-TONE-ENV-02-BASELINE') {
      if (state.signOff === 'none' && state.coverage === 'partial') {
        return 'applicable';
      }
      if (state.signOff !== 'none' && state.coverage === 'confident') {
        return 'obsolete-at-head';
      }
      return 'blocked';
    }
    if (step.id === 'RUNBOOK-1.2-D-TONE-ENV-02-SIGNOFF') {
      return state.signOff === 'none' ? 'manual-only' : 'already-satisfied';
    }
    if (step.id === 'RUNBOOK-1.3-D-TONE-ENV-02-CONFIDENCE') {
      if (state.signOff === 'none') {
        return 'blocked';
      }
      return state.coverage === 'confident' ? 'already-satisfied' : 'applicable';
    }
    if (step.id === 'RUNBOOK-1.4-D-TONE-ENV-02-TIER3-SMOKE') {
      return state.coverage === 'confident' ? 'applicable' : 'blocked';
    }
    if (step.id === 'RUNBOOK-1.5-SIGNOFF-COMMIT') {
      return 'manual-only';
    }
  }

  if (step.state_probe.type === 'finding-status') {
    const status = readAuditStatus(step.state_probe.id);
    if (status.startsWith('verified-')) {
      return 'already-satisfied';
    }
    if (status.startsWith('fixed-')) {
      return 'applicable';
    }
    if (status.startsWith('acknowledged-')) {
      return 'applicable';
    }
  }

  throw new Error(`No classification rule matched ${step.id}`);
}

describe('operator runbook state', () => {
  it('tracks the current HEAD classifications in the manifest', () => {
    const manifest = readManifest();
    const mismatches = manifest
      .map((step) => ({
        id: step.id,
        expected: step.current_head_classification,
        actual: classifyStep(step),
      }))
      .filter((item) => item.expected !== item.actual);

    expect(mismatches).toEqual([]);
  });

  it('keeps the current human-facing runbook aligned with the active queue', () => {
    const currentRunbook = readFileSync(currentRunbookPath, 'utf8');

    expect(currentRunbook).toContain('`LIVE-S550-LIB-001` is already verified');
    expect(currentRunbook).toContain('`D-TONE-ENV-02` Tier 4 sign-off is still missing');
    expect(currentRunbook).toContain('AUDIT-20260514-FU3-01');
    expect(currentRunbook).toContain('AUDIT-20260514-FU3-02');
    expect(currentRunbook).toContain('LIVE-S550-TONES-001');
    expect(currentRunbook).toContain('LIVE-S550-LIB-002');
    expect(currentRunbook).toContain('LIVE-S550-PATCH-001');
  });
});
