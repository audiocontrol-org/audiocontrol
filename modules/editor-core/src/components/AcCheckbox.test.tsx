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

  it('applies dataTestId to the <input> element (not the label)', () => {
    const { container } = render(
      <AcCheckbox checked={false} onChange={() => {}} dataTestId="tone-tvf-enabled">
        Enable Filter
      </AcCheckbox>,
    );
    const input = container.querySelector<HTMLInputElement>('input.ac-checkbox__input');
    if (input === null) {
      throw new Error('AcCheckbox did not render its input');
    }
    expect(input.getAttribute('data-testid')).toBe('tone-tvf-enabled');
    // The outer <label> must NOT carry the testid — getByTestId would then
    // hit the wrong element and `.click()` would only toggle the label, not
    // the input.
    const label = container.querySelector('label.ac-checkbox');
    expect(label?.getAttribute('data-testid')).toBeNull();
  });

  it('omits the data-testid attribute when dataTestId is not provided', () => {
    const { container } = render(
      <AcCheckbox checked={false} onChange={() => {}}>
        Plain
      </AcCheckbox>,
    );
    const input = container.querySelector<HTMLInputElement>('input.ac-checkbox__input');
    if (input === null) {
      throw new Error('AcCheckbox did not render its input');
    }
    expect(input.hasAttribute('data-testid')).toBe(false);
  });
});
