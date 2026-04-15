/**
 * Regression test for #280: changing filter parameters resets E_FREQ to 0.
 *
 * The Node e2e test (test-filter-efreq-bug.ts) proved the client/transport
 * stack is clean. This test exercises the UI state management code paths
 * in KeygroupsPage to find where the corruption happens.
 *
 * We replicate the exact spread/copy/encode patterns from:
 *   - handleParameterChange (click-to-edit)
 *   - handleDragChange (knob drag)
 *   - handleCommitHeader (drag end)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { writeKeygroupField } from '@/lib/keygroup-writers';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import { useKeygroupStore } from '@/stores/keygroupStore';

/**
 * Build a KeygroupHeader with a properly-encoded raw buffer.
 * Uses the writer functions to ensure raw and properties are consistent.
 */
function makeConsistentHeader(overrides: Partial<KeygroupHeader> = {}): KeygroupHeader {
  const header = makeKeygroupHeader(overrides);
  // Allocate a raw buffer large enough for all keygroup fields
  // (S3K keygroup headers are ~300+ nibble pairs)
  header.raw = new Array(600).fill(0);

  // Encode every numeric field into raw using the writer functions
  for (const [key, value] of Object.entries(header)) {
    if (key === 'raw') continue;
    if (typeof value === 'number') {
      writeKeygroupField(header, key, value);
    }
  }

  return header;
}

/** Read E_FREQ from raw buffer (offset 30-31, nibble LE) */
function readEFreqFromRaw(raw: number[]): number {
  return raw[30] | (raw[31] << 4);
}

describe('Bug #280: E_FREQ corruption during UI parameter changes', () => {
  describe('handleParameterChange code path', () => {
    it('changing FILFRQ does not corrupt E_FREQ in raw buffer', () => {
      // Setup: header with E_FREQ=25
      const header = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });
      const rawEFreqBefore = readEFreqFromRaw(header.raw);
      expect(rawEFreqBefore).toBe(25);

      // Replicate handleParameterChange exactly:
      // const updated = { ...header, [field]: value, raw: [...header.raw] };
      const field = 'FILFRQ';
      const value = 75;
      const updated = { ...header, [field]: value, raw: [...header.raw] } as KeygroupHeader;

      // writeKeygroupField(updated, field, value);
      writeKeygroupField(updated, field, value);

      // Assert: E_FREQ in raw is unchanged
      expect(readEFreqFromRaw(updated.raw)).toBe(25);
      expect(updated.E_FREQ).toBe(25);
    });

    it('changing FILQ does not corrupt E_FREQ in raw buffer', () => {
      const header = makeConsistentHeader({ E_FREQ: 30, FILQ: 5 });
      expect(readEFreqFromRaw(header.raw)).toBe(30);

      const updated = { ...header, FILQ: 10, raw: [...header.raw] } as KeygroupHeader;
      writeKeygroupField(updated, 'FILQ', 10);

      expect(readEFreqFromRaw(updated.raw)).toBe(30);
      expect(updated.E_FREQ).toBe(30);
    });
  });

  describe('handleDragChange code path', () => {
    it('dragging FILFRQ does not corrupt E_FREQ in raw buffer', () => {
      // Setup: simulate what the store would have
      const header = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });

      // Replicate handleDragChange:
      // const updated = { ...header, [field]: value };
      // (store gets updated without raw re-encode)
      const field = 'FILFRQ';
      const value = 60;
      const updated = { ...header, [field]: value } as KeygroupHeader;

      // Then the throttled write path:
      // const toSend = { ...updated, raw: [...header.raw] };
      // writeKeygroupField(toSend, field, value);
      const toSend = { ...updated, raw: [...header.raw] } as KeygroupHeader;
      writeKeygroupField(toSend, field, value);

      expect(readEFreqFromRaw(toSend.raw)).toBe(25);
      expect(toSend.E_FREQ).toBe(25);
    });
  });

  describe('handleCommitHeader code path', () => {
    it('re-encoding all fields does not corrupt E_FREQ', () => {
      // Setup: header as it would be in the store after a drag
      // (E_FREQ property is correct, raw is from original device read)
      const header = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 60 });

      // Replicate handleCommitHeader:
      // const toSend = { ...header, raw: [...header.raw] };
      const toSend = { ...header, raw: [...header.raw] } as KeygroupHeader;

      // Re-encode all fields:
      // for (const field of Object.keys(toSend)) {
      //   if (field !== 'raw') {
      //     const val = toSend[field];
      //     writeKeygroupField(toSend, field, val);
      //   }
      // }
      for (const field of Object.keys(toSend)) {
        if (field !== 'raw') {
          const val = (toSend as Record<string, unknown>)[field];
          writeKeygroupField(toSend, field, val as number);
        }
      }

      expect(readEFreqFromRaw(toSend.raw)).toBe(25);
      expect(toSend.E_FREQ).toBe(25);
    });

    it('re-encoding after drag divergence preserves E_FREQ', () => {
      // Setup: simulate the full drag flow
      // 1. Original header from device
      const original = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });

      // 2. handleDragChange stores updated property without raw re-encode
      const storeHeader = { ...original, FILFRQ: 75 } as KeygroupHeader;
      // Note: storeHeader.raw is the SAME reference as original.raw (shallow copy)

      // 3. handleCommitHeader reads from store and re-encodes
      const toSend = { ...storeHeader, raw: [...storeHeader.raw] } as KeygroupHeader;

      for (const field of Object.keys(toSend)) {
        if (field !== 'raw') {
          const val = (toSend as Record<string, unknown>)[field];
          writeKeygroupField(toSend, field, val as number);
        }
      }

      expect(readEFreqFromRaw(toSend.raw)).toBe(25);
      expect(toSend.E_FREQ).toBe(25);
    });
  });

  describe('full store lifecycle (simulates actual React component)', () => {
    beforeEach(() => {
      useKeygroupStore.getState().invalidateCache();
    });

    it('drag FILFRQ then commit does not corrupt E_FREQ', () => {
      // 1. Simulate device read: store gets header with consistent raw
      const deviceHeader = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });
      useKeygroupStore.getState().setKeygroupCount(1);
      useKeygroupStore.getState().setKeygroup(0, deviceHeader);

      // 2. Simulate handleDragChange: user drags FILFRQ knob
      {
        const header = useKeygroupStore.getState().keygroups[0]!;
        const updated = { ...header, FILFRQ: 70 };
        useKeygroupStore.getState().setKeygroup(0, updated);

        // Throttled write (immediate for test purposes)
        const toSend = { ...updated, raw: [...header.raw] } as KeygroupHeader;
        writeKeygroupField(toSend, 'FILFRQ', 70);
        // client.writeKeygroupHeader(toSend) would happen here

        // Verify what would be sent to device
        expect(readEFreqFromRaw(toSend.raw)).toBe(25);
      }

      // 3. Simulate handleCommitHeader: drag ends
      {
        const header = useKeygroupStore.getState().keygroups[0]!;
        const toSend = { ...header, raw: [...header.raw] } as KeygroupHeader;

        for (const field of Object.keys(toSend)) {
          if (field !== 'raw') {
            const val = (toSend as Record<string, unknown>)[field];
            writeKeygroupField(toSend, field, val as number);
          }
        }

        // This is the critical assertion
        expect(readEFreqFromRaw(toSend.raw)).toBe(25);
        expect(toSend.E_FREQ).toBe(25);
      }
    });

    it('handleParameterChange on FILFRQ does not corrupt E_FREQ', () => {
      const deviceHeader = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });
      useKeygroupStore.getState().setKeygroupCount(1);
      useKeygroupStore.getState().setKeygroup(0, deviceHeader);

      // Simulate handleParameterChange
      const header = useKeygroupStore.getState().keygroups[0]!;
      const updated = { ...header, FILFRQ: 75, raw: [...header.raw] } as KeygroupHeader;
      useKeygroupStore.getState().setKeygroup(0, updated);
      writeKeygroupField(updated, 'FILFRQ', 75);

      expect(readEFreqFromRaw(updated.raw)).toBe(25);
      expect(updated.E_FREQ).toBe(25);

      // Verify the store header also has correct raw
      const storeHeader = useKeygroupStore.getState().keygroups[0]!;
      expect(readEFreqFromRaw(storeHeader.raw)).toBe(25);
    });

    it('multiple rapid drags then commit preserves E_FREQ', () => {
      const deviceHeader = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });
      useKeygroupStore.getState().setKeygroupCount(1);
      useKeygroupStore.getState().setKeygroup(0, deviceHeader);

      // Rapid drags: only property updates, no raw re-encode in store
      for (const dragValue of [55, 60, 65, 70, 75]) {
        const header = useKeygroupStore.getState().keygroups[0]!;
        const updated = { ...header, FILFRQ: dragValue };
        useKeygroupStore.getState().setKeygroup(0, updated);
      }

      // Commit
      const header = useKeygroupStore.getState().keygroups[0]!;
      const toSend = { ...header, raw: [...header.raw] } as KeygroupHeader;

      for (const field of Object.keys(toSend)) {
        if (field !== 'raw') {
          const val = (toSend as Record<string, unknown>)[field];
          writeKeygroupField(toSend, field, val as number);
        }
      }

      expect(readEFreqFromRaw(toSend.raw)).toBe(25);
      expect(toSend.E_FREQ).toBe(25);
      expect(toSend.FILFRQ).toBe(75);
    });
  });

  describe('sequential parameter changes', () => {
    it('two consecutive handleParameterChange calls preserve E_FREQ', () => {
      // Simulate: user changes FILFRQ, then changes FILQ
      const header = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50, FILQ: 5 });

      // First change: FILFRQ
      const after1 = { ...header, FILFRQ: 75, raw: [...header.raw] } as KeygroupHeader;
      writeKeygroupField(after1, 'FILFRQ', 75);

      // Second change reads from store (which has after1)
      const after2 = { ...after1, FILQ: 10, raw: [...after1.raw] } as KeygroupHeader;
      writeKeygroupField(after2, 'FILQ', 10);

      expect(readEFreqFromRaw(after2.raw)).toBe(25);
      expect(after2.E_FREQ).toBe(25);
    });

    it('drag followed by handleParameterChange preserves E_FREQ', () => {
      const original = makeConsistentHeader({ E_FREQ: 25, FILFRQ: 50 });

      // Drag: store gets property update, no raw re-encode
      const afterDrag = { ...original, FILFRQ: 70 } as KeygroupHeader;
      // afterDrag.raw === original.raw (same reference, shallow spread)

      // Click-to-edit on a DIFFERENT field reads from store
      const afterClick = { ...afterDrag, FILQ: 8, raw: [...afterDrag.raw] } as KeygroupHeader;
      writeKeygroupField(afterClick, 'FILQ', 8);

      // E_FREQ in raw should still be 25
      expect(readEFreqFromRaw(afterClick.raw)).toBe(25);
      expect(afterClick.E_FREQ).toBe(25);
    });
  });
});
