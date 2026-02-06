/**
 * Virtual Front Panel Component
 *
 * A draggable, collapsible floating panel that mirrors the S-330's
 * physical front panel buttons for remote control via SysEx.
 *
 * ## Keyboard Shortcuts (when panel is expanded)
 *
 * - Arrow keys: Navigation (Up/Down/Left/Right)
 * - +/- or =/- : Inc/Dec values
 * - Enter: Execute
 * - F1: MODE button
 * - F2: MENU button
 * - F3: SUB MENU button
 * - F4: COM button
 * - F5: Execute button
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useFrontPanel, type NavigationButton, type FunctionButton } from '@/hooks/useFrontPanel';
import { NavigationPad } from './NavigationPad';
import { ValueButtons } from './ValueButtons';
import { FunctionButtonRow } from './FunctionButtonRow';

// localStorage keys for panel state persistence
const STORAGE_KEY_POSITION = 's330-front-panel-position';
const STORAGE_KEY_EXPANDED = 's330-front-panel-expanded';

// Panel dimensions
const PANEL_WIDTH = 280;
const PANEL_HEIGHT_EXPANDED = 200;
const MIN_X = 0;
const MIN_Y = 0;

interface Position {
    x: number;
    y: number;
}

/**
 * Load saved position from localStorage
 */
function loadPosition(): Position {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_POSITION);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch {
        // Ignore parse errors
    }
    // Default position: bottom-left with some margin
    return { x: 16, y: typeof window !== 'undefined' ? window.innerHeight - PANEL_HEIGHT_EXPANDED - 80 : 400 };
}

/**
 * Load expanded state from localStorage
 */
function loadExpanded(): boolean {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_EXPANDED);
        if (saved !== null) {
            return saved === 'true';
        }
    } catch {
        // Ignore parse errors
    }
    return false;
}

/**
 * Virtual Front Panel - Floating draggable panel for S-330 remote control
 *
 * Provides buttons for:
 * - Navigation (Up/Down/Left/Right)
 * - Value adjustment (Inc/Dec)
 * - Functions (MODE, MENU, SUB MENU, COM, Execute)
 */
export function VirtualFrontPanel() {
    const [isExpanded, setIsExpanded] = useState(loadExpanded);
    const [position, setPosition] = useState<Position>(loadPosition);

    const panelRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Get front panel hook state
    const { pressButton, isConnected, isPressing, activeButton, lastError } = useFrontPanel();

    // Save expanded state to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_EXPANDED, String(isExpanded));
    }, [isExpanded]);

    // Drag handlers
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        // Don't start drag if clicking on interactive elements
        if ((e.target as HTMLElement).closest('button')) return;

        isDragging.current = true;
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        e.preventDefault();
    }, [position]);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;

        const maxX = window.innerWidth - PANEL_WIDTH;
        const maxY = window.innerHeight - (isExpanded ? PANEL_HEIGHT_EXPANDED : 40);

        const newX = Math.max(MIN_X, Math.min(maxX, e.clientX - dragOffset.current.x));
        const newY = Math.max(MIN_Y, Math.min(maxY, e.clientY - dragOffset.current.y));

        setPosition({ x: newX, y: newY });
    }, [isExpanded]);

    const handleDragEnd = useCallback(() => {
        if (isDragging.current) {
            isDragging.current = false;
            localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
        }
    }, [position]);

    // Global mouse event listeners for drag
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            handleDragMove(e);
        };
        const handleMouseUp = () => {
            handleDragEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleDragMove, handleDragEnd]);

    // Keyboard shortcut handler
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Only handle shortcuts when panel is expanded and connected
        if (!isExpanded || !isConnected || isPressing) return;

        // Don't capture keys when typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            return;
        }

        // Map keys to navigation buttons
        const navKeyMap: Record<string, NavigationButton> = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            '+': 'inc',
            '=': 'inc',  // = key (unshifted +)
            '-': 'dec',
            '_': 'dec',  // _ key (shifted -)
        };

        // Map F-keys and Enter to function buttons
        const funcKeyMap: Record<string, FunctionButton> = {
            'F1': 'mode',
            'F2': 'menu',
            'F3': 'sub-menu',
            'F4': 'com',
            'F5': 'execute',
            'Enter': 'execute',
        };

        // Handle navigation keys
        const navButton = navKeyMap[e.key];
        if (navButton) {
            e.preventDefault();
            pressButton(navButton);
            return;
        }

        // Handle function keys
        const funcButton = funcKeyMap[e.key];
        if (funcButton) {
            e.preventDefault();
            pressButton(funcButton);
            return;
        }
    }, [isExpanded, isConnected, isPressing, pressButton]);

    // Register keyboard event listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
            {/* Collapsed button */}
            {!isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className={cn(
                        'px-4 py-2 rounded-lg shadow-lg',
                        'bg-s330-panel border border-s330-accent',
                        'text-s330-text hover:bg-s330-accent/50',
                        'transition-colors flex items-center gap-2',
                        !isConnected && 'opacity-50'
                    )}
                    title={isConnected ? 'Open Virtual Front Panel' : 'Connect MIDI to enable'}
                >
                    {/* Grid icon for panel */}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        />
                    </svg>
                    Panel
                </button>
            )}

            {/* Expanded panel */}
            {isExpanded && (
                <div
                    ref={panelRef}
                    style={{ width: PANEL_WIDTH }}
                    className={cn(
                        'bg-s330-panel border border-s330-accent rounded-lg shadow-xl',
                        'overflow-hidden flex flex-col'
                    )}
                >
                    {/* Header - draggable */}
                    <div
                        className="flex items-center justify-between px-3 py-2 border-b border-s330-accent cursor-move select-none"
                        onMouseDown={handleDragStart}
                    >
                        <span className="text-sm font-medium text-s330-text">Front Panel</span>
                        <div className="flex items-center gap-2">
                            {/* Connection status indicator */}
                            <span
                                className={cn(
                                    'w-2 h-2 rounded-full',
                                    isConnected ? 'bg-green-400' : 'bg-s330-muted'
                                )}
                                title={isConnected ? 'MIDI connected' : 'MIDI disconnected'}
                            />
                            {/* Active indicator */}
                            {isPressing && (
                                <span className="text-xs text-s330-highlight animate-pulse">
                                    Sending...
                                </span>
                            )}
                            {/* Collapse button */}
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 text-s330-muted hover:text-s330-text"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Panel content */}
                    <div className="p-3 space-y-3">
                        {/* Function buttons row */}
                        <FunctionButtonRow
                            onPress={pressButton}
                            activeButton={activeButton}
                            disabled={!isConnected || isPressing}
                        />

                        {/* Navigation and value controls */}
                        <div className="flex items-center justify-between gap-2">
                            {/* Navigation D-pad */}
                            <NavigationPad
                                onPress={pressButton}
                                activeButton={activeButton}
                                disabled={!isConnected || isPressing}
                            />

                            {/* Inc/Dec buttons */}
                            <ValueButtons
                                onPress={pressButton}
                                activeButton={activeButton}
                                disabled={!isConnected || isPressing}
                            />
                        </div>

                        {/* Shortcuts hint */}
                        <div className="text-xs text-s330-muted text-center opacity-70">
                            Keys: Arrows, +/-, Enter, F1-F5
                        </div>

                        {/* Error display */}
                        {lastError && (
                            <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                                {lastError}
                            </div>
                        )}

                        {/* Disconnected message */}
                        {!isConnected && (
                            <div className="text-xs text-s330-muted text-center">
                                Connect MIDI to use
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
