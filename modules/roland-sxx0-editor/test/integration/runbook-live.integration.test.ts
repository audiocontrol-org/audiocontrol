import { describe, expect, it } from 'vitest';
import {
  getRequestedSection,
  resolveTarget,
  RUNBOOK_LIVE_TARGETS,
} from '../../scripts/runbook-live';

describe('runbook live dispatcher', () => {
  it('maps the current runbook live sections to the existing S-550 conformance specs', () => {
    expect(RUNBOOK_LIVE_TARGETS).toEqual([
      {
        id: '2.3',
        title: 'Re-run live Tones conformance for #428',
        specs: ['test/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts'],
        hardwareRequired: true,
      },
      {
        id: '2.4-library',
        title: 'Capture live diagnostic evidence for #430',
        specs: ['test/e2e/s550-D-LIB-live-core.spec.ts'],
        hardwareRequired: true,
      },
      {
        id: '2.4-patches',
        title: 'Capture live diagnostic evidence for #431',
        specs: ['test/e2e/s550-D-PATCH-live-core.spec.ts'],
        hardwareRequired: true,
      },
      {
        id: '2.4',
        title: 'Capture live diagnostic evidence for #430 and #431',
        specs: [
          'test/e2e/s550-D-LIB-live-core.spec.ts',
          'test/e2e/s550-D-PATCH-live-core.spec.ts',
        ],
        hardwareRequired: true,
      },
    ]);
  });

  it('supports section aliases used by the human runbook and finding IDs', () => {
    expect(resolveTarget('2.3')?.id).toBe('2.3');
    expect(resolveTarget('runbook-2.4')?.id).toBe('2.4');
    expect(resolveTarget('#430')?.id).toBe('2.4-library');
    expect(resolveTarget('LIVE-S550-PATCH-001')?.id).toBe('2.4-patches');
    expect(resolveTarget('unknown')).toBeNull();
  });

  it('accepts the pnpm argument separator form used by the human runbook', () => {
    expect(getRequestedSection(['node', 'scripts/runbook-live.ts', '--', '--list'])).toBe(
      '--list',
    );
    expect(getRequestedSection(['node', 'scripts/runbook-live.ts', '--', '2.3'])).toBe('2.3');
    expect(getRequestedSection(['node', 'scripts/runbook-live.ts', '2.4-library'])).toBe(
      '2.4-library',
    );
  });
});
