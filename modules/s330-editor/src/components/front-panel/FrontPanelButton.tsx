/**
 * Front Panel Button Component
 *
 * Base button component with press feedback styling.
 * Shows active state while button is being pressed.
 */

import { cn } from '@/lib/utils';
import type { FrontPanelButton as ButtonType } from '@/hooks/useFrontPanel';

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
    /** Button size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Optional icon to display */
    icon?: React.ReactNode;
}

/**
 * A single front panel button with press feedback
 */
export function FrontPanelButton({
    label,
    onClick,
    isActive = false,
    disabled = false,
    className,
    size = 'md',
    icon,
}: FrontPanelButtonProps) {
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                // Base styles
                'rounded font-medium transition-all',
                'select-none whitespace-nowrap',
                // Border
                'border border-s330-accent',
                // Default state
                'bg-s330-panel text-s330-text',
                // Hover state
                !disabled && 'hover:bg-s330-accent/50',
                // Active/pressing state
                isActive && 'bg-s330-highlight text-white scale-95',
                // Disabled state
                disabled && 'opacity-50 cursor-not-allowed',
                // Size
                sizeClasses[size],
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
