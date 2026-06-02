import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcDisclosure } from './AcDisclosure';

describe('AcDisclosure', () => {
  it('renders children when defaultOpen is true (section presentation)', () => {
    const html = renderToStaticMarkup(
      <AcDisclosure title="Section" defaultOpen={true}>
        <div>Child Content</div>
      </AcDisclosure>
    );
    expect(html).toContain('Section');
    expect(html).toContain('Child Content');
  });

  it('UNMOUNTS children when collapsed (default-collapsed Tweak presentation)', () => {
    const html = renderToStaticMarkup(
      <AcDisclosure title="Tweak" hint="per-segment values" titleAs="span" defaultOpen={false}>
        <div>Child Content</div>
      </AcDisclosure>
    );
    expect(html).toContain('Tweak');
    expect(html).toContain('per-segment values');
    expect(html).not.toContain('Child Content');
  });

  it('renders the canonical AcChevron marker (never a +/- glyph)', () => {
    const collapsed = renderToStaticMarkup(
      <AcDisclosure title="Section" defaultOpen={false}>
        <div>Body</div>
      </AcDisclosure>
    );
    // The marker is AcChevron: ▸ when collapsed, ▾ when expanded. Never +/−.
    expect(collapsed).toContain('ac-chevron');
    expect(collapsed).toContain('data-expanded="false"');
    expect(collapsed).not.toContain('>+<');
    expect(collapsed).not.toContain('>−<');

    const expanded = renderToStaticMarkup(
      <AcDisclosure title="Section" defaultOpen={true}>
        <div>Body</div>
      </AcDisclosure>
    );
    expect(expanded).toContain('data-expanded="true"');
  });

  it('toggles body visibility on header click (uncontrolled)', () => {
    render(
      <AcDisclosure title="Section" defaultOpen={false}>
        <div>Child Content</div>
      </AcDisclosure>
    );
    expect(screen.queryByText('Child Content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Section/ }));
    expect(screen.getByText('Child Content')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Section/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('is controllable via open + onOpenChange (does not self-toggle when controlled)', () => {
    const onOpenChange = vi.fn();
    render(
      <AcDisclosure title="Section" open={false} onOpenChange={onOpenChange}>
        <div>Child Content</div>
      </AcDisclosure>
    );
    // Controlled-closed: body absent.
    expect(screen.queryByText('Child Content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Section/ }));
    // Controlled component must NOT flip its own state — it reports intent only.
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Child Content')).toBeNull();
  });

  it('honours titleAs for the title element tag', () => {
    const asSpan = renderToStaticMarkup(
      <AcDisclosure title="Tweak" titleAs="span" hint="x" defaultOpen={false}>
        <div>B</div>
      </AcDisclosure>
    );
    expect(asSpan).not.toContain('<h4');

    const asH4 = renderToStaticMarkup(
      <AcDisclosure title="Sec" defaultOpen={false}>
        <div>B</div>
      </AcDisclosure>
    );
    expect(asH4).toContain('<h4');
  });
});
