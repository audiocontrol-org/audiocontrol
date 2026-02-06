/**
 * Navigation Pad Component
 *
 * D-pad layout for directional navigation (Up/Down/Left/Right).
 */

import { FrontPanelButton } from './FrontPanelButton';
import type { FrontPanelButton as ButtonType, NavigationButton } from '@/hooks/useFrontPanel';

export interface NavigationPadProps {
    /** Handler for button press */
    onPress: (button: NavigationButton) => void;
    /** Currently active button */
    activeButton: ButtonType | null;
    /** Whether buttons are disabled */
    disabled?: boolean;
}

/**
 * Arrow icon pointing in specified direction
 */
function ArrowIcon({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
    const rotations = {
        up: 'rotate-0',
        right: 'rotate-90',
        down: 'rotate-180',
        left: '-rotate-90',
    };

    return (
        <svg
            className={`w-4 h-4 ${rotations[direction]}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
            />
        </svg>
    );
}

/**
 * D-pad style navigation pad
 *
 * Layout:
 * ```
 *      [ Up ]
 * [Left]   [Right]
 *     [Down]
 * ```
 */
export function NavigationPad({ onPress, activeButton, disabled = false }: NavigationPadProps) {
    return (
        <div className="grid grid-cols-3 gap-1 w-fit">
            {/* Top row - Up */}
            <div />
            <FrontPanelButton
                button="up"
                label=""
                icon={<ArrowIcon direction="up" />}
                onClick={() => onPress('up')}
                isActive={activeButton === 'up'}
                disabled={disabled}
                size="md"
                className="w-10 h-10 flex items-center justify-center"
            />
            <div />

            {/* Middle row - Left and Right */}
            <FrontPanelButton
                button="left"
                label=""
                icon={<ArrowIcon direction="left" />}
                onClick={() => onPress('left')}
                isActive={activeButton === 'left'}
                disabled={disabled}
                size="md"
                className="w-10 h-10 flex items-center justify-center"
            />
            <div />
            <FrontPanelButton
                button="right"
                label=""
                icon={<ArrowIcon direction="right" />}
                onClick={() => onPress('right')}
                isActive={activeButton === 'right'}
                disabled={disabled}
                size="md"
                className="w-10 h-10 flex items-center justify-center"
            />

            {/* Bottom row - Down */}
            <div />
            <FrontPanelButton
                button="down"
                label=""
                icon={<ArrowIcon direction="down" />}
                onClick={() => onPress('down')}
                isActive={activeButton === 'down'}
                disabled={disabled}
                size="md"
                className="w-10 h-10 flex items-center justify-center"
            />
            <div />
        </div>
    );
}
