import { afterEach, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { MoveDialog } from './MoveDialog';
import type { MoveDialogDirectory } from './MoveDialog';

afterEach(() => {
  cleanup();
});

const testDirs: MoveDialogDirectory[] = [
  { id: 'dir-1', name: 'Drums', path: [], depth: 0 },
  { id: 'dir-2', name: 'Bass', path: [], depth: 0 },
];

// Note on rendering choice:
//
// `MoveDialog` is a thin wrapper around `<SlideDrawer>`. SlideDrawer
// gates its DOM via `if (!mounted) return null;` and only flips
// `mounted` to true inside a `useEffect` (the same effect that
// schedules the open/visible CSS transition). `renderToStaticMarkup`
// is SSR-only — it never runs effects — so under SSR the drawer
// always reports the unmounted state and emits empty markup. The
// `open={false}` test still uses SSR because that path short-
// circuits before `<SlideDrawer>` even decides to mount; the
// `open={true}` paths must use `render` + the jsdom DOM so the
// mount effect fires.
function renderOpen(itemName: string, directories: MoveDialogDirectory[]): string {
  const { container } = render(
    <MoveDialog
      open={true}
      itemName={itemName}
      directories={directories}
      onMove={() => {}}
      onCancel={() => {}}
    />,
  );
  // The drawer renders an `.ac-drawer-overlay` + `.ac-drawer-panel`
  // pair into `document.body` (NOT inside the testing-library
  // container, because nothing in MoveDialog uses a portal — both
  // siblings render directly under the React root). Reading from
  // `document.body` covers both placements without coupling to
  // implementation detail.
  return document.body.innerHTML;
}

describe('MoveDialog', () => {
  it('renders nothing when not open', () => {
    const html = renderToStaticMarkup(
      <MoveDialog
        open={false}
        itemName="test"
        directories={[]}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('renders item name in title', () => {
    const html = renderOpen('My Tone', testDirs);
    // The title comes through SlideDrawer as plain text inside
    // `<h2 class="ac-drawer-title">`, so the operator-visible string
    // is `Move "My Tone"` (no HTML entity encoding in the DOM).
    expect(html).toContain('Move "My Tone"');
  });

  it('renders directory list with root option', () => {
    const html = renderOpen('x', testDirs);
    expect(html).toContain('(top level)');
    expect(html).toContain('Drums');
    expect(html).toContain('Bass');
  });

  it('renders cancel and move buttons', () => {
    const html = renderOpen('x', []);
    expect(html).toContain('Cancel');
    expect(html).toContain('>Move<');
  });

  it('renders dialog role', () => {
    const html = renderOpen('x', []);
    expect(html).toContain('role="dialog"');
  });
});
