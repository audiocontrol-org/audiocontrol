import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuAction } from './ContextMenu';

describe('ContextMenu', () => {
  const baseActions: ContextMenuAction[] = [
    { label: 'Rename', onClick: () => {} },
    { label: 'Delete', onClick: () => {}, danger: true },
  ];

  it('renders menu items', () => {
    const html = renderToStaticMarkup(
      <ContextMenu x={100} y={100} actions={baseActions} onClose={() => {}} />,
    );
    expect(html).toContain('Rename');
    expect(html).toContain('Delete');
  });

  it('renders menu role', () => {
    const html = renderToStaticMarkup(
      <ContextMenu x={0} y={0} actions={baseActions} onClose={() => {}} />,
    );
    expect(html).toContain('role="menu"');
  });

  it('renders menuitem role on actions', () => {
    const html = renderToStaticMarkup(
      <ContextMenu x={0} y={0} actions={baseActions} onClose={() => {}} />,
    );
    expect(html).toContain('role="menuitem"');
  });

  it('renders danger class on danger actions', () => {
    const html = renderToStaticMarkup(
      <ContextMenu x={0} y={0} actions={baseActions} onClose={() => {}} />,
    );
    expect(html).toContain('ac-context-menu-item--danger');
  });

  it('renders disabled class on disabled actions', () => {
    const actions: ContextMenuAction[] = [
      { label: 'Disabled', onClick: () => {}, disabled: true },
    ];
    const html = renderToStaticMarkup(
      <ContextMenu x={0} y={0} actions={actions} onClose={() => {}} />,
    );
    expect(html).toContain('ac-context-menu-item--disabled');
    expect(html).toContain('disabled');
  });

  it('renders separator between actions', () => {
    const actions: ContextMenuAction[] = [
      { label: 'First', onClick: () => {} },
      { label: 'sep', onClick: () => {}, separator: true },
      { label: 'Second', onClick: () => {} },
    ];
    const html = renderToStaticMarkup(
      <ContextMenu x={0} y={0} actions={actions} onClose={() => {}} />,
    );
    expect(html).toContain('ac-context-menu-separator');
  });

  it('renders with fixed positioning', () => {
    const html = renderToStaticMarkup(
      <ContextMenu x={200} y={300} actions={baseActions} onClose={() => {}} />,
    );
    expect(html).toContain('ac-context-menu');
    // Initial position set via style
    expect(html).toContain('left:200px');
    expect(html).toContain('top:300px');
  });

  it('renders icon slot when action has icon', () => {
    const actions: ContextMenuAction[] = [
      { label: 'With Icon', onClick: () => {}, icon: <span>★</span> },
    ];
    const html = renderToStaticMarkup(
      <ContextMenu x={0} y={0} actions={actions} onClose={() => {}} />,
    );
    expect(html).toContain('ac-context-menu-icon');
    expect(html).toContain('★');
  });
});
