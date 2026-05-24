/**
 * Test harness for the Library page chrome contract — closes
 * AUDIT-20260524-03. The production LibraryPage uses the single-body
 * variant of the fixed-viewport shell (`.ac-page-shell-body`
 * wrapping a full-height widget — the `PluginLibraryBrowser` —
 * rather than the 2-col `.ac-app-shell` grid used by the Programs /
 * Samples / Keygroups pages).
 *
 * This harness mirrors that single-body shape with a stub `<div>`
 * standing in for the browser, so the contract spec can verify the
 * page-shell + page-shell-body geometry without mounting the real
 * plugin (which needs a library handle, store hydration, and
 * device-connection signals).
 */
import { PageTitleRow } from '@audiocontrol/editor-core';

export function TestLibraryPage(): JSX.Element {
  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-library-page-heading"
        headingText="Test Library (harness)"
      />

      <div className="ac-page-shell-body" data-capability="C-LIB-01">
        {/*
         * Stand-in for `PluginLibraryBrowser`. The real component is a
         * full-height 3-column widget; we only need a single block
         * that claims the body's full height so the contract spec can
         * verify `.ac-page-shell-body` clips to the viewport and
         * doesn't overflow the document.
         */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--ac-color-surface-canvas)',
            border: '1px solid var(--ac-color-border-subtle)',
            borderRadius: 'var(--ac-radius-md)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p className="text-gray-300">
              Test library pane (stand-in for PluginLibraryBrowser)
            </p>
            <p className="text-gray-500 text-sm mt-2">
              The production page mounts a 3-column plugin browser
              here. This stub verifies the single-body shell contract
              only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
