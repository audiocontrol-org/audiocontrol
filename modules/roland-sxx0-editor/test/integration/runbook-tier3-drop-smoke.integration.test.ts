import { describe, expect, it } from 'vitest';
import {
  assertSmokePrereqs,
  readCurrentBaseline,
} from '../../scripts/runbook-tier3-drop-smoke';

describe('runbook tier-3 drop smoke helper', () => {
  it('fails safely before mutating anything when the baseline is not yet confident', () => {
    const baseline = readCurrentBaseline();

    expect(() => assertSmokePrereqs(baseline)).toThrowError(
      /Blocked: D-TONE-ENV-02 .* coverage=partial\./
    );
  });
});
