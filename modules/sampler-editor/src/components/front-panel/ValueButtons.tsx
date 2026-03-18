/**
 * Value Buttons Component
 *
 * Inc/Dec buttons for adjusting parameter values.
 */

import { FrontPanelButton } from './FrontPanelButton';
import type { FrontPanelButton as ButtonType, NavigationButton } from '@/hooks/useFrontPanel';

export interface ValueButtonsProps {
    /** Handler for button press */
    onPress: (button: NavigationButton) => void;
    /** Currently active button */
    activeButton: ButtonType | null;
    /** Whether buttons are disabled */
    disabled?: boolean;
}

/**
 * Minus icon
 */
function MinusIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
    );
}

/**
 * Plus icon
 */
function PlusIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    );
}

/**
 * Increment/Decrement buttons for value adjustment
 *
 * Layout: [ - ] [ + ]
 */
export function ValueButtons({ onPress, activeButton, disabled = false }: ValueButtonsProps) {
    return (
        <div className="flex gap-2">
            <FrontPanelButton
                button="dec"
                label=""
                icon={<MinusIcon />}
                onClick={() => onPress('dec')}
                isActive={activeButton === 'dec'}
                disabled={disabled}
                size="md"
                className="w-10 h-10 flex items-center justify-center"
            />
            <FrontPanelButton
                button="inc"
                label=""
                icon={<PlusIcon />}
                onClick={() => onPress('inc')}
                isActive={activeButton === 'inc'}
                disabled={disabled}
                size="md"
                className="w-10 h-10 flex items-center justify-center"
            />
        </div>
    );
}
