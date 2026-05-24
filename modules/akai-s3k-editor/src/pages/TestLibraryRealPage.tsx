/**
 * Test harness for the Library page chrome contract — closes
 * AUDIT-20260524-07 and AUDIT-20260524-09. The pre-existing
 * `TestLibraryPage` at `/akai/s3000xl/editor/test/library` mounts a
 * stub `<div>` standing in for `PluginLibraryBrowser`, so the contract
 * spec only validates outer `.ac-page-shell-body` geometry — not the
 * inner-pane overflow ownership that AUDIT-20260524-05's fix-guidance
 * specifically called out ("list and detail panes own internal scroll
 * on desktop without clipping their bodies").
 *
 * This file mounts the REAL `PluginLibraryBrowser` with the actual
 * `s3kLibraryPlugin`, a stubbed in-memory library handle, and a
 * CONTENTFUL `S3kMemoryPanelState` + tree data so the contract spec
 * can assert inner-pane overflow under populated content (not just
 * the CSS declarations on empty-state DOM):
 *
 *   .ac-page-shell--fixed-viewport
 *     PageTitleRow
 *     .ac-page-shell-body
 *       PluginLibraryBrowser (REAL component)
 *         .ac-plugin-library-browser-device      (overflow-y: auto)
 *           DeviceMemoryPanel: 30 programs + 30 samples
 *         .ac-plugin-library-browser-library     (overflow: hidden)
 *           .ac-plugin-library-browser-sections  (overflow-y: scroll)
 *             samples category: 30 entries
 *             common-programs category: 30 entries
 *             s3k-programs category: 30 entries
 *         .ac-plugin-library-browser-preview     (overflow-y: auto)
 *
 * Data shapes are mirrored from production wiring:
 * - `categoryData` matches `LibraryPage.tsx:296` (Record<categoryId,
 *   TreeNode[]>); each TreeNode is `{ id, name, type }` with `type`
 *   matching the category's itemType (`sample` or `program`) — see
 *   `s3k-library-plugin.tsx` + `categories.tsx`.
 * - `S3kMemoryPanelState` matches the interface declared at
 *   `s3k-library-plugin.tsx:35-57`; only the display fields
 *   (`programNames`, `sampleNames`, `isConnected`) need real values;
 *   the action callbacks are no-ops because the contract under test
 *   is overflow ownership, not write behavior.
 * - `libraryHandle` keeps the truthy `{ name }` stub
 *   (`PluginLibraryBrowser` only checks for truthiness + `.name` to
 *   render — see `PluginLibraryBrowser.test.tsx`).
 */
import { useState, useCallback, useMemo } from 'react';
import {
  PageTitleRow,
  PluginLibraryBrowser,
  type TreeNode,
  type ItemSelection,
} from '@audiocontrol/editor-core';
import { s3kLibraryPlugin } from '@/plugins/s3k-library-plugin';
import type { S3kMemoryPanelState } from '@/plugins/s3k-library-plugin';

// Stub library handle — matches the truthy `{ name }` shape
// `PluginLibraryBrowser.test.tsx` uses (`{} as FileSystemDirectoryHandle`).
const STUB_LIBRARY_HANDLE = { name: 'TestLibraryRoot' };

const ITEMS_PER_CATEGORY = 30;
const DEVICE_PROGRAM_COUNT = 30;
const DEVICE_SAMPLE_COUNT = 30;

/**
 * Build deterministic device memory program names. Names are
 * fixed-width and zero-padded so a future visual diff can compare
 * byte-for-byte. Matches the shape S3000XL programs surface in
 * `DeviceMemoryPanel` (12-char name slot, padded).
 */
function buildDeviceProgramNames(): string[] {
  return Array.from({ length: DEVICE_PROGRAM_COUNT }, (_, i) =>
    `PRG_${String(i).padStart(2, '0')}_NAME`,
  );
}

function buildDeviceSampleNames(): string[] {
  return Array.from({ length: DEVICE_SAMPLE_COUNT }, (_, i) =>
    `SMP_${String(i).padStart(2, '0')}_NAME`,
  );
}

/**
 * Build deterministic library tree nodes for the named category.
 * The `type` discriminator matches what the category factory expects
 * (`sample` for samples; `program` for both common-programs and
 * s3k-programs). Each node is a leaf (no children), so the section
 * renders one row per entry — enough to force the sections pane
 * past viewport height when stacked across three categories.
 */
function buildLibraryNodes(
  category: 'samples' | 'common-programs' | 's3k-programs',
): TreeNode[] {
  const type = category === 'samples' ? 'sample' : 'program';
  const prefix = category === 'samples' ? 'Sample' :
    category === 'common-programs' ? 'CommonProg' : 'S3kProg';
  return Array.from({ length: ITEMS_PER_CATEGORY }, (_, i) => ({
    id: `${category}/${prefix}_${String(i).padStart(3, '0')}`,
    name: `${prefix}_${String(i).padStart(3, '0')}`,
    type,
  }));
}

export function TestLibraryRealPage(): JSX.Element {
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [expandedPaths] = useState<Record<string, Set<string>>>({
    samples: new Set(),
    'common-programs': new Set(),
    's3k-programs': new Set(),
  });

  // Contentful category data — 30 entries per category so the sections
  // pane MUST overflow on a 900px-tall desktop viewport. AUDIT-20260524-09.
  const categoryData = useMemo<Record<string, TreeNode[]>>(() => ({
    samples: buildLibraryNodes('samples'),
    'common-programs': buildLibraryNodes('common-programs'),
    's3k-programs': buildLibraryNodes('s3k-programs'),
  }), []);

  // Contentful device memory — `isConnected: true` so the DeviceMemoryPanel
  // renders its full grid of program/sample rows instead of the
  // "Connect to S3000XL first" empty state. AUDIT-20260524-09.
  const memoryState = useMemo<S3kMemoryPanelState>(() => ({
    programNames: buildDeviceProgramNames(),
    sampleNames: buildDeviceSampleNames(),
    selectedIndex: null,
    selectedType: null,
    onSelectProgram: () => { /* no-op for shell harness */ },
    onSelectSample: () => { /* no-op for shell harness */ },
    onRefresh: () => { /* no-op for shell harness */ },
    isConnected: true,
    isLoading: false,
  }), []);

  const noopAsync = useCallback(async () => { /* no-op for shell harness */ }, []);
  const noopAsyncMove = useCallback(async () => { /* no-op for shell harness */ }, []);
  const noopAsyncRename = useCallback(async () => { /* no-op for shell harness */ }, []);

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-library-real-page-heading"
        headingText="Test Library Real (harness)"
      />

      <div className="ac-page-shell-body" data-capability="C-LIB-01">
        <PluginLibraryBrowser
          plugin={s3kLibraryPlugin}
          libraryHandle={STUB_LIBRARY_HANDLE}
          categoryData={categoryData}
          expandedPaths={expandedPaths}
          selection={selection}
          onSelectionChange={setSelection}
          onToggleExpand={() => { /* no-op for shell harness */ }}
          onRefresh={() => { /* no-op for shell harness */ }}
          onCreateFolder={noopAsync}
          onDelete={noopAsync}
          onMove={noopAsyncMove}
          onRename={noopAsyncRename}
          deviceMemoryState={memoryState}
          loading={false}
        />
      </div>
    </div>
  );
}
