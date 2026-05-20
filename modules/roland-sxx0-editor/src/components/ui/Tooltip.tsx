/**
 * Tooltip — currently a no-op pass-through.
 *
 * Operator request 2026-05-18: the previous Radix-driven hover tooltips
 * were perceived as more disruptive than informative on this editor —
 * they covered the controls they were describing and fired during
 * routine parameter editing. This component now renders its children
 * unchanged so every existing `<Tooltip content={...}>...</Tooltip>`
 * call site keeps working without any per-site edits.
 *
 * The `content`, `side`, and `delayDuration` props are accepted but
 * intentionally ignored. To restore the Radix behavior, revert this
 * file to its prior implementation (uses
 * `@radix-ui/react-tooltip`'s Provider/Root/Trigger/Portal/Content/
 * Arrow primitives) — the dependency is still in the workspace.
 */

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function Tooltip({ children }: TooltipProps): JSX.Element {
  return <>{children}</>;
}
