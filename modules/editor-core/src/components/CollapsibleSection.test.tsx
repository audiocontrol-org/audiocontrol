import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders children when defaultOpen is true', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection title="Section" defaultOpen={true}>
        <div>Child Content</div>
      </CollapsibleSection>
    );

    expect(html).toContain('Section');
    expect(html).toContain('Child Content');
  });

  it('hides children when defaultOpen is false', () => {
    const html = renderToStaticMarkup(
      <CollapsibleSection title="Section" defaultOpen={false}>
        <div>Child Content</div>
      </CollapsibleSection>
    );

    expect(html).toContain('Section');
    expect(html).not.toContain('Child Content');
  });
});
