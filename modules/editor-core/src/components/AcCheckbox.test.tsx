import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { AcCheckbox } from './AcCheckbox';

afterEach(() => {
  cleanup();
});

describe('AcCheckbox', () => {
  it('renders the two-element pattern with v3 classes', () => {
    const html = renderToStaticMarkup(
      <AcCheckbox checked={false} onChange={() => {}}>
        Restore wave data
      </AcCheckbox>,
    );
    expect(html).toContain('ac-checkbox');
    expect(html).toContain('ac-checkbox__input');
    expect(html).toContain('ac-checkbox__label');
    expect(html).toContain('Restore wave data');
  });

  it('reflects the checked prop in the input', () => {
    const html = renderToStaticMarkup(
      <AcCheckbox checked={true} onChange={() => {}}>
        On
      </AcCheckbox>,
    );
    expect(html).toContain('checked=""');
  });

  it('renders disabled state when disabled', () => {
    const html = renderToStaticMarkup(
      <AcCheckbox checked={false} onChange={() => {}} disabled={true}>
        Off
      </AcCheckbox>,
    );
    expect(html).toContain('disabled');
  });

  it('appends a custom className to the outer label', () => {
    const html = renderToStaticMarkup(
      <AcCheckbox checked={false} onChange={() => {}} className="extra">
        X
      </AcCheckbox>,
    );
    expect(html).toContain('class="ac-checkbox extra"');
  });

  it('emits onChange with the new checked state on toggle', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcCheckbox checked={false} onChange={onChange}>
        Toggle
      </AcCheckbox>,
    );
    const input = container.querySelector('input.ac-checkbox__input');
    if (input === null) {
      throw new Error('AcCheckbox did not render its input');
    }
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('forwards aria-label, id, and name attributes', () => {
    const html = renderToStaticMarkup(
      <AcCheckbox
        checked={false}
        onChange={() => {}}
        ariaLabel="Hidden label"
        id="cb-1"
        name="restore"
      >
        Visible
      </AcCheckbox>,
    );
    expect(html).toContain('aria-label="Hidden label"');
    expect(html).toContain('id="cb-1"');
    expect(html).toContain('name="restore"');
  });
});
