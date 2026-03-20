import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when not open', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        title="Delete?"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('renders title and message when open', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        message="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Delete Item');
    expect(html).toContain('This cannot be undone.');
  });

  it('renders custom button labels', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Remove?"
        message="Sure?"
        confirmLabel="Yes, remove"
        cancelLabel="Keep it"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Yes, remove');
    expect(html).toContain('Keep it');
  });

  it('applies danger styling to confirm button when danger is true', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Delete?"
        message="Sure?"
        danger
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('ac-btn-danger');
  });

  it('uses primary styling when danger is false', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Confirm?"
        message="OK?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('ac-btn-primary');
    expect(html).not.toContain('ac-btn-danger');
  });

  it('renders alertdialog role', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="X"
        message="Y"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('role="alertdialog"');
  });

  it('renders React node message', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={true}
        title="Delete"
        message={<div><strong>3 items</strong> will be removed.</div>}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('<strong>3 items</strong>');
    expect(html).toContain('will be removed.');
  });
});
