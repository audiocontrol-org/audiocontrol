import { useState } from 'react';
import type { ReactNode } from 'react';
import { AcChevron } from './AcChevron';

/**
 * AcDisclosure — the canonical collapse/expand primitive for the editor.
 *
 * Supersedes the prior `CollapsibleSection`, which rendered a bare `−`/`+`
 * text glyph for its marker. Every disclosure marker now renders the
 * canonical `AcChevron` per `.claude/rules/chevron-sizing.md`, so there is
 * exactly one chevron in the codebase and no disclosure can drift in marker
 * size or color.
 *
 * Two presentations, both driven entirely by the `theme` className bag so
 * each surface supplies its own chrome (no editor/device styling is baked
 * into the primitive):
 *   - **section-collapsible** — a titled section header + body, open by
 *     default. Pass `titleAs="h4"` (default) and section chrome classes.
 *   - **"Tweak" pill** — an inline label + `hint`, collapsed by default,
 *     used to hide a numeric back-channel beneath a graphical editor. Pass
 *     `titleAs="span"`, a `hint`, and `defaultOpen={false}`.
 *
 * Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`).
 *
 * Like `CollapsibleSection` before it, the body is UNMOUNTED when collapsed
 * (not merely hidden) — consumers and specs must expand the disclosure
 * before interacting with body content.
 */

export interface AcDisclosureTheme {
  /** Outermost wrapper. */
  container?: string;
  /** The clickable summary/toggle button. */
  headerButton?: string;
  /** Wraps title + hint together (used by the Tweak presentation). */
  labelGroup?: string;
  /** The title / label element. */
  title?: string;
  /** Secondary hint text beside the title (Tweak presentation). */
  hint?: string;
  /** Wraps the `AcChevron` marker. Must NOT contain the substring "chevron". */
  icon?: string;
  /** The disclosed body. */
  body?: string;
}

export interface AcDisclosureProps {
  /** Title / label text shown in the header. */
  title: string;
  /** Secondary hint shown beside the title (Tweak presentation). */
  hint?: string;
  /** Uncontrolled initial open state. Ignored when `open` is provided. */
  defaultOpen?: boolean;
  /** Controlled open state. When provided, the component is controlled. */
  open?: boolean;
  /** Fires with the next open state on every toggle. */
  onOpenChange?: (open: boolean) => void;
  /** Tag for the title element — `h4` for sections, `span` for the Tweak pill. */
  titleAs?: 'h3' | 'h4' | 'h5' | 'span';
  children: ReactNode;
  theme?: AcDisclosureTheme;
}

export function AcDisclosure({
  title,
  hint,
  defaultOpen = true,
  open,
  onOpenChange,
  titleAs = 'h4',
  children,
  theme,
}: AcDisclosureProps): JSX.Element {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const TitleTag = titleAs;
  const titleNode = <TitleTag className={theme?.title}>{title}</TitleTag>;

  return (
    <div className={theme?.container}>
      <button
        type="button"
        className={theme?.headerButton}
        onClick={toggle}
        aria-expanded={isOpen}
      >
        {hint !== undefined ? (
          <span className={theme?.labelGroup}>
            {titleNode}
            <span className={theme?.hint}>{hint}</span>
          </span>
        ) : (
          titleNode
        )}
        <span className={theme?.icon}>
          <AcChevron expanded={isOpen} />
        </span>
      </button>
      {isOpen ? <div className={theme?.body}>{children}</div> : null}
    </div>
  );
}
