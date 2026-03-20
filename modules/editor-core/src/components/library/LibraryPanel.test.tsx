import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LibraryPanel } from './LibraryPanel';
import type { LibraryTab } from './LibraryPanel';

describe('LibraryPanel', () => {
  it('renders children as content', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel><div>Tree content</div></LibraryPanel>,
    );
    expect(html).toContain('Tree content');
  });

  it('renders title when provided', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel title="Library">content</LibraryPanel>,
    );
    expect(html).toContain('Library');
    expect(html).toContain('ac-library-panel-title');
  });

  it('renders connection slot', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel connectionSlot={<span>Connected</span>}>
        content
      </LibraryPanel>,
    );
    expect(html).toContain('Connected');
    expect(html).toContain('ac-library-panel-connection');
  });

  it('renders tab bar with tabs', () => {
    const tabs: LibraryTab[] = [
      { id: 'samples', label: 'Samples' },
      { id: 'tones', label: 'Tones' },
    ];
    const html = renderToStaticMarkup(
      <LibraryPanel tabs={tabs} activeTabId="samples">content</LibraryPanel>,
    );
    expect(html).toContain('Samples');
    expect(html).toContain('Tones');
    expect(html).toContain('ac-tab--active');
  });

  it('renders tab count badge', () => {
    const tabs: LibraryTab[] = [
      { id: 'items', label: 'Items', count: 5 },
    ];
    const html = renderToStaticMarkup(
      <LibraryPanel tabs={tabs}>content</LibraryPanel>,
    );
    expect(html).toContain('5');
    expect(html).toContain('ac-tab-badge');
  });

  it('renders loading state', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel loading />,
    );
    expect(html).toContain('Loading...');
  });

  it('renders error state', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel error="Connection failed" />,
    );
    expect(html).toContain('Connection failed');
    expect(html).toContain('ac-text-error');
  });

  it('renders empty state when isEmpty is true', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel isEmpty emptyMessage="Nothing to show" />,
    );
    expect(html).toContain('Nothing to show');
  });

  it('renders refresh button when onRefresh provided', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel onRefresh={() => {}}>content</LibraryPanel>,
    );
    expect(html).toContain('↻');
  });

  it('renders header actions slot', () => {
    const html = renderToStaticMarkup(
      <LibraryPanel headerActions={<button>New Folder</button>}>
        content
      </LibraryPanel>,
    );
    expect(html).toContain('New Folder');
  });

  it('wraps in ac-library-panel class', () => {
    const html = renderToStaticMarkup(<LibraryPanel>x</LibraryPanel>);
    expect(html).toContain('ac-library-panel');
  });
});
