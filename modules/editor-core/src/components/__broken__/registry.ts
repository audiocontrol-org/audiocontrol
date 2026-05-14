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
 * This registry will be imported by harness routes once 9R-A.1-T4 lands.
 * Until then, only this file references the broken variants; nothing in
 * production page code imports them.
 */
import { type ComponentType, type ReactNode } from 'react';
import { type AcRangeBarProps } from '@/components/AcRangeBar';
import { type AcEnvelopeTableProps } from '@/components/AcEnvelopeTable';

import { AcRangeBarBrokenRoleImg } from './AcRangeBar/role-img';
import { AcRangeBarBrokenNoPointerEvents } from './AcRangeBar/no-pointer-events';
import { AcRangeBarBrokenOnChangeDisconnected } from './AcRangeBar/onchange-disconnected';
import { AcEnvelopeTableBrokenCellsRoleImg } from './AcEnvelopeTable/cells-role-img';
import { AcEnvelopeTableBrokenOnChangeDisconnected } from './AcEnvelopeTable/onchange-disconnected';
import { BrokenStickyOverlayContext } from './contexts/sticky-overlay';
import { BrokenZeroWidthGridContext } from './contexts/zero-width-grid';
import { BrokenPointerEventsNoneAncestorContext } from './contexts/pointer-events-none-ancestor';

export type AcRangeBarVariantKey =
  | 'role-img'
  | 'no-pointer-events'
  | 'onchange-disconnected';

export type AcEnvelopeTableVariantKey =
  | 'cells-role-img'
  | 'onchange-disconnected';

export type BrokenContextKey =
  | 'sticky-overlay'
  | 'zero-width-grid'
  | 'pointer-events-none-ancestor';

export interface BrokenPrimitives {
  AcRangeBar: Readonly<Record<AcRangeBarVariantKey, ComponentType<AcRangeBarProps>>>;
  AcEnvelopeTable: Readonly<Record<AcEnvelopeTableVariantKey, ComponentType<AcEnvelopeTableProps>>>;
}

export type BrokenContexts = Readonly<
  Record<BrokenContextKey, ComponentType<{ children: ReactNode }>>
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
  'sticky-overlay': BrokenStickyOverlayContext,
  'zero-width-grid': BrokenZeroWidthGridContext,
  'pointer-events-none-ancestor': BrokenPointerEventsNoneAncestorContext,
};
