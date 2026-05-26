import type { ReactNode } from 'react';

/**
 * `<Section>` — akai parameter-section panel.
 *
 * The visual chrome (`.s3k-section` border, `.s3k-section-title` eyebrow,
 * `.ac-param-rows` 22rem-min auto-fit grid for the body) is consistent
 * across ProgramEditor / KeygroupEditor / SampleEditor — they previously
 * each declared their own local `Section({ title, children })` function
 * with copy-pasted JSX. The clone-detector flagged the divergence at the
 * point where AUDIT-20260525-24 migrated all three from `.s3k-section-grid`
 * to `.ac-param-rows`; consolidating into this one canonical shape closes
 * the DRY violation in the same commit per `.claude/CLAUDE.md`.
 *
 * `headerContent` is an optional slot for rich chrome that mounts above
 * the grid body (e.g., a `<AcEnvelope>` graph in the filter / amp envelope
 * sections of KeygroupEditor). When omitted, the section renders title +
 * grid only.
 */
export interface SectionProps {
  /** Eyebrow title for the section. */
  title: string;
  /** Parameter rows; each child should be a `<S3kParamRow*>` variant. */
  children: ReactNode;
  /**
   * Optional rich chrome (e.g., envelope graph, frequency response) that
   * mounts between the title and the parameter-row grid.
   */
  headerContent?: ReactNode;
}

export function Section({ title, children, headerContent }: SectionProps): JSX.Element {
  return (
    <div className="s3k-section">
      <div className="s3k-section-title">{title}</div>
      {headerContent !== undefined ? (
        <div className="s3k-section-header-content">{headerContent}</div>
      ) : null}
      <div className="ac-param-rows">{children}</div>
    </div>
  );
}
