/**
 * Function Button Row Component
 *
 * Row of function buttons: MODE, MENU, SUB MENU, COM, Execute.
 */

import { FrontPanelButton } from './FrontPanelButton';
import type { FrontPanelButton as ButtonType, FunctionButton } from '@/hooks/useFrontPanel';

export interface FunctionButtonRowProps {
    /** Handler for button press */
    onPress: (button: FunctionButton) => void;
    /** Currently active button */
    activeButton: ButtonType | null;
    /** Whether buttons are disabled */
    disabled?: boolean;
}

/**
 * Function button configuration
 */
const FUNCTION_BUTTONS: { button: FunctionButton; label: string }[] = [
    { button: 'mode', label: 'MODE' },
    { button: 'menu', label: 'MENU' },
    { button: 'sub-menu', label: 'SUB' },
    { button: 'com', label: 'COM' },
    { button: 'execute', label: 'EXEC' },
];

/**
 * Row of function buttons
 *
 * Layout: [MODE] [MENU] [SUB] [COM] [EXEC]
 */
export function FunctionButtonRow({ onPress, activeButton, disabled = false }: FunctionButtonRowProps) {
    return (
        <div className="flex gap-1">
            {FUNCTION_BUTTONS.map(({ button, label }) => (
                <FrontPanelButton
                    key={button}
                    button={button}
                    label={label}
                    onClick={() => onPress(button)}
                    isActive={activeButton === button}
                    disabled={disabled}
                    size="sm"
                    className="flex-1 px-1"
                />
            ))}
        </div>
    );
}
