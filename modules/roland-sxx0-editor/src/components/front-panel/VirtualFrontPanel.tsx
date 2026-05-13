/**
 * Virtual Front Panel — chunky-button control surface
 *
 * The 11-control surface for remote Roland S-330 / S-550 operation,
 * mounted inside the editor's `<VideoCapture>` drawer (Decision 1 in
 * `decisions-2026-05-11.md`). Visual blueprint:
 * `docs/1.0/001-IN-PROGRESS/s550-support/explorations/
 * 08-front-panel-s550.html` (operator-approved 2026-05-12, commit
 * `ffd003d7`).
 *
 * Layout — 7-column × 2-row grid mirroring the S-550 hardware photo:
 *
 *   Row 1:  MODE | MENU | SUB-MENU | (blank) | ▲ | (blank) | COM
 *   Row 2:  DEC  | INC  | (blank)  | ◀ | ▼ | ▶ | EXEC
 *
 * Device-agnostic: both the S-330 and the S-550 editors render the
 * same panel. The visual aesthetic (matte chassis + chunky molded
 * keys + red arrow silkscreen) is borrowed from the S-550 hardware
 * reference because the S-330 was the visual outlier — a 1990s
 * rackmount unit shares its design language with the S-550 anyway.
 *
 * Capability contract (load-bearing for
 * `test/ui/capabilities/front-panel-emit.spec.ts`):
 *   - Arrows expose accessible names `Arrow up` / `Arrow down` /
 *     `Arrow left` / `Arrow right` (D-XX-02).
 *   - Value buttons expose `Decrement` / `Increment` (D-XX-03).
 *   - Function buttons expose visible labels `MODE` / `MENU` / `SUB` /
 *     `COM` / `EXEC` (D-XX-04).
 *
 * Press flow: every button click ends in
 * `useFrontPanel.pressButton(id)` via the `onPress` prop the host
 * (currently `VideoCapture.tsx`) wires through.
 */

import { FrontPanelButton } from './FrontPanelButton';
import type { FrontPanelButton as ButtonType } from '@/hooks/useFrontPanel';
import './front-panel.css';

export interface VirtualFrontPanelProps {
    /** Press handler — fired with the canonical button id. */
    onPress: (button: ButtonType) => void;
    /** Currently active button (controlled by `useFrontPanel`). */
    activeButton: ButtonType | null;
    /** Disable the whole panel (e.g., MIDI not connected). */
    disabled?: boolean;
}

/**
 * SUB MENU label — stacks "SUB" over "MENU" per the v2 mockup. The
 * primitive's `icon` slot renders above the (empty) `label`, so we use
 * `icon` to host the two-line node.
 */
function SubMenuLabel() {
    return (
        <span className="flex flex-col items-center justify-center leading-tight">
            <span>SUB</span>
            <span>MENU</span>
        </span>
    );
}

/**
 * Arrow glyph — single Unicode triangle. The `--ac-color-rec` red is
 * applied via the `.ac-fp__btn--arrow` modifier class.
 */
function ArrowGlyph({ direction }: { direction: 'up' | 'down' | 'left' | 'right' }) {
    const glyph = direction === 'up' ? '▲'
        : direction === 'down' ? '▼'
        : direction === 'left' ? '◀'
        : '▶';
    return <span aria-hidden="true">{glyph}</span>;
}

/**
 * Plus / minus glyph for the value buttons.
 */
function ValueGlyph({ sign }: { sign: 'minus' | 'plus' }) {
    return <span aria-hidden="true">{sign === 'minus' ? '－' : '＋'}</span>;
}

/**
 * 7×2 chunky-button control surface.
 *
 * The grid order follows the v2 mockup exactly:
 *   row 1 cells 1-7 → MODE, MENU, SUB-MENU, blank, ▲, blank, COM
 *   row 2 cells 1-7 → DEC, INC, blank, ◀, ▼, ▶, EXEC
 *
 * Blank cells are non-interactive spacers preserving the cross-arrow
 * cluster's visual identity from the real hardware.
 */
export function VirtualFrontPanel({ onPress, activeButton, disabled = false }: VirtualFrontPanelProps) {
    return (
        <div
            role="group"
            aria-label="Virtual front panel"
            className="ac-fp"
        >
            <div className="ac-fp__grid">
                {/* Row 1 */}
                <FrontPanelButton
                    button="mode"
                    label="MODE"
                    ariaLabel="MODE"
                    onClick={() => onPress('mode')}
                    isActive={activeButton === 'mode'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn"
                />
                <FrontPanelButton
                    button="menu"
                    label="MENU"
                    ariaLabel="MENU"
                    onClick={() => onPress('menu')}
                    isActive={activeButton === 'menu'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn"
                />
                <FrontPanelButton
                    button="sub-menu"
                    label=""
                    ariaLabel="SUB"
                    icon={<SubMenuLabel />}
                    onClick={() => onPress('sub-menu')}
                    isActive={activeButton === 'sub-menu'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--stack"
                />
                <span className="ac-fp__btn ac-fp__blank" aria-hidden="true" />
                <FrontPanelButton
                    button="up"
                    label=""
                    ariaLabel="Arrow up"
                    icon={<ArrowGlyph direction="up" />}
                    onClick={() => onPress('up')}
                    isActive={activeButton === 'up'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--arrow"
                />
                <span className="ac-fp__btn ac-fp__blank" aria-hidden="true" />
                <FrontPanelButton
                    button="com"
                    label="COM"
                    ariaLabel="COM"
                    onClick={() => onPress('com')}
                    isActive={activeButton === 'com'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn"
                />

                {/* Row 2 */}
                <FrontPanelButton
                    button="dec"
                    label=""
                    ariaLabel="Decrement"
                    icon={<ValueGlyph sign="minus" />}
                    onClick={() => onPress('dec')}
                    isActive={activeButton === 'dec'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--value"
                />
                <FrontPanelButton
                    button="inc"
                    label=""
                    ariaLabel="Increment"
                    icon={<ValueGlyph sign="plus" />}
                    onClick={() => onPress('inc')}
                    isActive={activeButton === 'inc'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--value"
                />
                <span className="ac-fp__btn ac-fp__blank" aria-hidden="true" />
                <FrontPanelButton
                    button="left"
                    label=""
                    ariaLabel="Arrow left"
                    icon={<ArrowGlyph direction="left" />}
                    onClick={() => onPress('left')}
                    isActive={activeButton === 'left'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--arrow"
                />
                <FrontPanelButton
                    button="down"
                    label=""
                    ariaLabel="Arrow down"
                    icon={<ArrowGlyph direction="down" />}
                    onClick={() => onPress('down')}
                    isActive={activeButton === 'down'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--arrow"
                />
                <FrontPanelButton
                    button="right"
                    label=""
                    ariaLabel="Arrow right"
                    icon={<ArrowGlyph direction="right" />}
                    onClick={() => onPress('right')}
                    isActive={activeButton === 'right'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn ac-fp__btn--arrow"
                />
                <FrontPanelButton
                    button="execute"
                    label="EXEC"
                    ariaLabel="EXEC"
                    onClick={() => onPress('execute')}
                    isActive={activeButton === 'execute'}
                    disabled={disabled}
                    variant="chunky"
                    className="ac-fp__btn"
                />
            </div>
        </div>
    );
}
