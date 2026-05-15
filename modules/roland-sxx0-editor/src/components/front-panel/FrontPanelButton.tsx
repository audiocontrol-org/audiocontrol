/**
 * Front Panel Button Component
 *
 * Base button primitive used by the virtual front panel. Holds the
 * accessible-name contract (load-bearing for the D-XX-02 / D-XX-03 /
 * D-XX-04 capability specs in `test/wiring/front-panel-emit.spec.ts`)
 * and emits a `data-pressed="true"` attribute when the
 * controlled `isActive` flag is set so external CSS (e.g.,
 * `front-panel.css`'s chunky-button variant) can paint a pressed state
 * for keyboard-driven presses where the mouse `:active` pseudo never
 * fires.
 *
 * Two visual variants:
 *   - `default` — the original tailwind-painted button (kept so any
 *     future caller can opt in to the panel-chrome look without
 *     hand-rolling it).
 *   - `chunky` — unstyled-chrome mode for the canonical
 *     `VirtualFrontPanel` surface; the primitive renders only the
 *     accessible-name + click + size + `data-pressed` plumbing and
 *     `front-panel.css` paints the matte-black chassis + molded-plastic
 *     button look on top via the `className` the caller passes in.
 */

import { cn } from '@/lib/utils';
import type { FrontPanelButton as ButtonType } from '@/hooks/useFrontPanel';

export type FrontPanelButtonVariant = 'default' | 'chunky';

export interface FrontPanelButtonProps {
    /** Button identifier */
    button: ButtonType;
    /** Button display label */
    label: string;
    /** Click handler */
    onClick: () => void;
    /** Whether this button is currently being pressed */
    isActive?: boolean;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Button size variant (only applies to `default` visual variant) */
    size?: 'sm' | 'md' | 'lg';
    /** Optional icon to display */
    icon?: React.ReactNode;
    /**
     * Accessible name override. Required when the button renders icon-only
     * (no visible `label` text) so screen readers and capability specs
     * have a deterministic accessible name to target. When unset, the
     * visible label serves as the accessible name.
     */
    ariaLabel?: string;
    /**
     * Visual variant. `default` keeps the original tailwind chrome;
     * `chunky` disables the built-in chrome so the consumer can paint
     * the matte-black + molded-plastic look via component CSS.
     */
    variant?: FrontPanelButtonVariant;
}

/**
 * A single front panel button with press feedback
 */
export function FrontPanelButton({
    button,
    label,
    onClick,
    isActive = false,
    disabled = false,
    className,
    size = 'md',
    icon,
    ariaLabel,
    variant = 'default',
}: FrontPanelButtonProps) {
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
    };

    const isChunky = variant === 'chunky';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            data-button={button}
            data-pressed={isActive ? 'true' : undefined}
            className={cn(
                'select-none whitespace-nowrap transition-all',
                !isChunky && [
                    'rounded font-medium',
                    'border border-s330-accent',
                    'bg-s330-panel text-s330-text',
                    !disabled && 'hover:bg-s330-accent/50',
                    isActive && 'bg-s330-highlight text-white scale-95',
                    sizeClasses[size],
                ],
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
        >
            {icon ? (
                <span className="flex items-center justify-center gap-1">
                    {icon}
                    {label && <span>{label}</span>}
                </span>
            ) : (
                label
            )}
        </button>
    );
}
