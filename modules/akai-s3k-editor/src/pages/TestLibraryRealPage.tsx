/**
 * Test harness for the Library page chrome contract — closes
 * AUDIT-20260524-07. The pre-existing `TestLibraryPage` at
 * `/akai/s3000xl/editor/test/library` mounts a stub `<div>` standing
 * in for `PluginLibraryBrowser`, so the contract spec only validates
 * outer `.ac-page-shell-body` geometry — not the inner-pane overflow
 * ownership that AUDIT-20260524-05's fix-guidance specifically called
 * out ("list and detail panes own internal scroll on desktop without
 * clipping their bodies").
 *
 * This file mounts the REAL `PluginLibraryBrowser` with the actual
 * `s3kLibraryPlugin`, a stubbed in-memory library handle, and an
 * empty `S3kMemoryPanelState` so the contract spec can assert
 * inner-pane overflow on the real production component:
 *
 *   .ac-page-shell--fixed-viewport
 *     PageTitleRow
 *     .ac-page-shell-body
 *       PluginLibraryBrowser (REAL component)
 *         .ac-plugin-library-browser-device      (overflow-y: auto)
 *         .ac-plugin-library-browser-library     (overflow: hidden, with .ac-plugin-library-browser-sections inside owning scroll)
 *         .ac-plugin-library-browser-preview     (overflow-y: auto)
 *
 * The library handle is a `{ name: string }` stub: `PluginLibraryBrowser`
 * only checks the handle for truthiness + `.name` to render — see
 * `PluginLibraryBrowserProps.libraryHandle` docs and the matching
 * unit-test pattern in `PluginLibraryBrowser.test.tsx`.
 */
import { useState, useCallback } from 'react';
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

const EMPTY_MEMORY_STATE: S3kMemoryPanelState = {
  programNames: [],
  sampleNames: [],
  selectedIndex: null,
  selectedType: null,
  onSelectProgram: () => { /* no-op for shell harness */ },
  onSelectSample: () => { /* no-op for shell harness */ },
  onRefresh: () => { /* no-op for shell harness */ },
  isConnected: false,
  isLoading: false,
};

export function TestLibraryRealPage(): JSX.Element {
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [expandedPaths] = useState<Record<string, Set<string>>>({
    samples: new Set(),
    'common-programs': new Set(),
    's3k-programs': new Set(),
  });

  // Empty category data — the contract under test is overflow
  // ownership on the inner panes, not tree-rendering behavior.
  const categoryData: Record<string, TreeNode[]> = {
    samples: [],
    'common-programs': [],
    's3k-programs': [],
  };

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
          deviceMemoryState={EMPTY_MEMORY_STATE}
          loading={false}
        />
      </div>
    </div>
  );
}
