import { useState } from 'react';
import type { ReactNode } from 'react';

export interface CollapsibleSectionTheme {
  container?: string;
  headerButton?: string;
  title?: string;
  icon?: string;
  body?: string;
}

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  theme?: CollapsibleSectionTheme;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  theme,
}: CollapsibleSectionProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={theme?.container}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={theme?.headerButton}
      >
        <h4 className={theme?.title}>{title}</h4>
        <span className={theme?.icon}>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen ? <div className={theme?.body}>{children}</div> : null}
    </div>
  );
}
