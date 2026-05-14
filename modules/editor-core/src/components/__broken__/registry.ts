/**
 * Dev-only registry of deliberately-broken React components used by the
 * test-discipline reform's credibility check (Phase 9R-A.1, issue #392).
 *
 * A spec is **credible** iff:
 *   1. it passes against the unbroken harness (no broken/context params), AND
 *   2. for every variant in its `credibleAgainst` meta list, it FAILS against
 *      `?broken=<variant>` or `?context=<variant>`.
 *
 * See: docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md
 *      §5 — Validity Claim B: credibility via runtime swap.
 *
 * The broken variants here are NEVER imported into production page code.
 * They are imported only by harness routes (T4) and this registry, and the
 * registry itself is consumed only by the harness layer + tools/.
 */
import { type ComponentType, type ReactNode } from 'react';
import { type AcRangeBarProps } from '@/components/AcRangeBar';
import { type AcEnvelopeTableProps } from '@/components/AcEnvelopeTable';

import { AcRangeBarBrokenRoleImg } from './AcRangeBar/role-img';
import { AcRangeBarBrokenNoPointerEvents } from './AcRangeBar/no-pointer-events';
import { AcRangeBarBrokenOnChangeDisconnected } from './AcRangeBar/onchange-disconnected';
import { AcEnvelopeTableBrokenCellsRoleImg } from './AcEnvelopeTable/cells-role-img';
import { AcEnvelopeTableBrokenOnChangeDisconnected } from './AcEnvelopeTable/onchange-disconnected';
import { StickyOverlayContext } from './contexts/sticky-overlay';
import { ZeroWidthGridContext } from './contexts/zero-width-grid';
import { PointerEventsNoneAncestorContext } from './contexts/pointer-events-none-ancestor';

export interface BrokenPrimitives {
  AcRangeBar: Readonly<Record<string, ComponentType<AcRangeBarProps>>>;
  AcEnvelopeTable: Readonly<Record<string, ComponentType<AcEnvelopeTableProps>>>;
}

export type BrokenContexts = Readonly<
  Record<string, ComponentType<{ children: ReactNode }>>
>;

export const BROKEN_PRIMITIVES: BrokenPrimitives = {
  AcRangeBar: {
    'role-img': AcRangeBarBrokenRoleImg,
    'no-pointer-events': AcRangeBarBrokenNoPointerEvents,
    'onchange-disconnected': AcRangeBarBrokenOnChangeDisconnected,
  },
  AcEnvelopeTable: {
    'cells-role-img': AcEnvelopeTableBrokenCellsRoleImg,
    'onchange-disconnected': AcEnvelopeTableBrokenOnChangeDisconnected,
  },
};

export const BROKEN_CONTEXTS: BrokenContexts = {
  'sticky-overlay': StickyOverlayContext,
  'zero-width-grid': ZeroWidthGridContext,
  'pointer-events-none-ancestor': PointerEventsNoneAncestorContext,
};
