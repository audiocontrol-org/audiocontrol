/**
 * Loop Editor Component
 *
 * Split-pane waveform view for finding loop points.
 * Left pane shows waveform approaching the end point (where the loop restarts).
 * Right pane shows waveform from the loop point (where playback jumps to).
 * The splice point is at the center, allowing visual alignment of waveforms.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface LoopEditorProps {
    /** Audio samples (16-bit signed integers) */
    samples: Int16Array | null;
    /** Sample rate in Hz */
    sampleRate: number;
    /** Start point in samples */
    startPoint: number;
    /** Loop point in samples (where playback jumps to after end) */
    loopPoint: number;
    /** End point in samples (where the loop restarts from) */
    endPoint: number;
    /** Called when loop point changes */
    onLoopPointChange?: (loopPoint: number) => void;
    /** Called when end point changes */
    onEndPointChange?: (endPoint: number) => void;
    /** Called when changes should be committed to device */
    onCommit?: () => void;
    /** Height of each waveform pane */
    height?: number;
    /** Whether the editor is loading wave data */
    isLoading?: boolean;
    /** Loading progress (0-100) */
    loadingProgress?: number;
    /** Custom class name */
    className?: string;
}

/** Waveform colors */
const WAVEFORM_COLOR = 'rgba(59, 130, 246, 0.8)';
const WAVEFORM_FILL = 'rgba(59, 130, 246, 0.3)';
const BACKGROUND_COLOR_LEFT = '#1a1a2e';
const BACKGROUND_COLOR_RIGHT = '#1e1e32';
const CENTER_LINE_COLOR = '#333';
const MARKER_COLOR = 'rgba(34, 197, 94, 0.8)';

/** Zoom settings */
const MIN_ZOOM = 1;
const MAX_ZOOM = 128;
const ZOOM_STEP = 2;

/** Window sizes in samples (how many samples to show in each pane) */
const DEFAULT_WINDOW_SAMPLES = 4096;

export function LoopEditor({
    samples,
    sampleRate,
    startPoint,
    loopPoint,
    endPoint,
    onLoopPointChange,
    onEndPointChange,
    onCommit,
    height = 120,
    isLoading = false,
    loadingProgress,
    className,
}: LoopEditorProps): JSX.Element {
    const leftCanvasRef = useRef<HTMLCanvasElement>(null);
    const rightCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [canvasContainerWidth, setCanvasContainerWidth] = useState(600);
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState<'loop' | 'end' | null>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartValue, setDragStartValue] = useState(0);

    // Calculate window size based on zoom
    const windowSamples = Math.round(DEFAULT_WINDOW_SAMPLES / zoom);

    // Effective pane width (half of canvas container)
    const paneWidth = useMemo(() => Math.floor(canvasContainerWidth / 2), [canvasContainerWidth]);

    // Handle resize - measure the card container to set proper canvas resolution
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateWidth = () => {
            // Get the card's content width (excluding padding)
            const style = getComputedStyle(container);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            const contentWidth = container.clientWidth - paddingLeft - paddingRight;
            setCanvasContainerWidth(contentWidth);
        };

        const resizeObserver = new ResizeObserver(() => {
            updateWidth();
        });

        resizeObserver.observe(container);
        updateWidth();

        return () => resizeObserver.disconnect();
    }, []);

    // Convert pixel offset from splice point to sample offset
    const pixelToSampleOffset = useCallback(
        (pixelOffset: number): number => {
            if (paneWidth === 0) return 0;
            const samplesPerPixel = windowSamples / paneWidth;
            return Math.round(pixelOffset * samplesPerPixel);
        },
        [paneWidth, windowSamples]
    );

    // Draw a waveform segment on a canvas
    const drawWaveform = useCallback(
        (
            canvas: HTMLCanvasElement,
            startSample: number,
            direction: 'left' | 'right'
        ) => {
            const ctx = canvas.getContext('2d');
            if (!ctx || !samples || samples.length === 0) return;

            const width = canvas.width;
            const canvasHeight = canvas.height;
            const midY = canvasHeight / 2;

            // Clear canvas with direction-specific background for splice point contrast
            ctx.fillStyle = direction === 'left' ? BACKGROUND_COLOR_LEFT : BACKGROUND_COLOR_RIGHT;
            ctx.fillRect(0, 0, width, canvasHeight);

            // Draw center line
            ctx.strokeStyle = CENTER_LINE_COLOR;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(width, midY);
            ctx.stroke();

            // Calculate sample range to display
            const samplesPerPixel = windowSamples / width;
            let sampleStart: number;
            let sampleEnd: number;

            if (direction === 'left') {
                // Left pane shows samples leading UP TO the end point
                // Splice point is at the right edge
                sampleEnd = startSample;
                sampleStart = sampleEnd - windowSamples;
            } else {
                // Right pane shows samples starting FROM the loop point
                // Splice point is at the left edge
                sampleStart = startSample;
                sampleEnd = sampleStart + windowSamples;
            }

            // Clamp to valid range
            sampleStart = Math.max(0, sampleStart);
            sampleEnd = Math.min(samples.length, sampleEnd);

            // Draw waveform
            ctx.beginPath();
            ctx.strokeStyle = WAVEFORM_COLOR;
            ctx.fillStyle = WAVEFORM_FILL;
            ctx.lineWidth = 1;

            let firstPoint = true;
            for (let x = 0; x < width; x++) {
                let sampleIndex: number;
                if (direction === 'left') {
                    // For left pane, x=0 is windowSamples before end, x=width is at end
                    sampleIndex = Math.floor(sampleEnd - windowSamples + x * samplesPerPixel);
                } else {
                    // For right pane, x=0 is at loop point, x=width is windowSamples after
                    sampleIndex = Math.floor(sampleStart + x * samplesPerPixel);
                }

                if (sampleIndex < 0 || sampleIndex >= samples.length) {
                    continue;
                }

                // Find min/max in this pixel's sample range
                const pixelSampleStart = sampleIndex;
                const pixelSampleEnd = Math.min(
                    samples.length - 1,
                    Math.floor(sampleIndex + samplesPerPixel)
                );

                let minVal = samples[pixelSampleStart];
                let maxVal = samples[pixelSampleStart];
                for (let s = pixelSampleStart; s <= pixelSampleEnd; s++) {
                    if (samples[s] < minVal) minVal = samples[s];
                    if (samples[s] > maxVal) maxVal = samples[s];
                }

                // Convert to canvas Y (16-bit audio: -32768 to 32767)
                const yMin = midY - (maxVal / 32768) * (midY - 2);
                const yMax = midY - (minVal / 32768) * (midY - 2);

                if (firstPoint) {
                    ctx.moveTo(x, yMin);
                    firstPoint = false;
                }
                ctx.lineTo(x, yMin);
                ctx.lineTo(x, yMax);
            }
            ctx.stroke();

            // Draw current position marker label
            ctx.fillStyle = MARKER_COLOR;
            ctx.font = '10px monospace';
            const label = direction === 'left' ? `End: ${endPoint}` : `Loop: ${loopPoint}`;
            const labelX = direction === 'left' ? width - 60 : 4;
            ctx.fillText(label, labelX, 12);
        },
        [samples, windowSamples, endPoint, loopPoint]
    );

    // Redraw canvases when parameters change
    useEffect(() => {
        if (!samples || samples.length === 0) return;

        const leftCanvas = leftCanvasRef.current;
        const rightCanvas = rightCanvasRef.current;

        if (leftCanvas) {
            drawWaveform(leftCanvas, endPoint, 'left');
        }
        if (rightCanvas) {
            drawWaveform(rightCanvas, loopPoint, 'right');
        }
    }, [samples, endPoint, loopPoint, drawWaveform, paneWidth, height, zoom]);

    // Handle zoom
    const handleZoomIn = useCallback(() => {
        setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
    }, []);

    const handleZoomReset = useCallback(() => {
        setZoom(1);
    }, []);

    // Handle mouse drag for fine-tuning points
    const handleMouseDown = useCallback(
        (pane: 'loop' | 'end', e: React.MouseEvent) => {
            setIsDragging(pane);
            setDragStartX(e.clientX);
            setDragStartValue(pane === 'loop' ? loopPoint : endPoint);
        },
        [loopPoint, endPoint]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;

            const deltaX = e.clientX - dragStartX;
            // Negate delta so dragging right moves the waveform right (earlier samples)
            const deltaSamples = -pixelToSampleOffset(deltaX);
            const newValue = Math.max(
                startPoint,
                Math.min(samples?.length ?? 0, dragStartValue + deltaSamples)
            );

            if (isDragging === 'loop') {
                // Loop point must be <= end point
                const clampedValue = Math.min(newValue, endPoint);
                onLoopPointChange?.(clampedValue);
            } else {
                // End point must be >= loop point
                const clampedValue = Math.max(newValue, loopPoint);
                onEndPointChange?.(clampedValue);
            }
        },
        [
            isDragging,
            dragStartX,
            dragStartValue,
            pixelToSampleOffset,
            startPoint,
            endPoint,
            loopPoint,
            samples,
            onLoopPointChange,
            onEndPointChange,
        ]
    );

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            onCommit?.();
        }
        setIsDragging(null);
    }, [isDragging, onCommit]);

    // Global mouse event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Nudge controls
    const nudgeLoopPoint = useCallback(
        (delta: number) => {
            const newValue = Math.max(
                startPoint,
                Math.min(endPoint, loopPoint + delta)
            );
            onLoopPointChange?.(newValue);
            onCommit?.();
        },
        [loopPoint, startPoint, endPoint, onLoopPointChange, onCommit]
    );

    const nudgeEndPoint = useCallback(
        (delta: number) => {
            const newValue = Math.max(
                loopPoint,
                Math.min(samples?.length ?? 0, endPoint + delta)
            );
            onEndPointChange?.(newValue);
            onCommit?.();
        },
        [endPoint, loopPoint, samples, onEndPointChange, onCommit]
    );

    // Calculate loop length for display
    const loopLength = endPoint - loopPoint;
    const loopDurationMs = sampleRate > 0 ? (loopLength / sampleRate) * 1000 : 0;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if focus is within the component
            if (!containerRef.current?.contains(document.activeElement)) return;

            const nudgeAmount = e.shiftKey ? 100 : 1;

            switch (e.key) {
                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        nudgeLoopPoint(-nudgeAmount);
                    } else {
                        nudgeEndPoint(-nudgeAmount);
                    }
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        nudgeLoopPoint(nudgeAmount);
                    } else {
                        nudgeEndPoint(nudgeAmount);
                    }
                    e.preventDefault();
                    break;
                case '+':
                case '=':
                    handleZoomIn();
                    e.preventDefault();
                    break;
                case '-':
                    handleZoomOut();
                    e.preventDefault();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nudgeLoopPoint, nudgeEndPoint, handleZoomIn, handleZoomOut]);

    if (isLoading) {
        return (
            <div className={cn('card', className)}>
                <h4 className="font-medium text-s330-text mb-4">Loop Editor</h4>
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <div className="flex items-center">
                        <span className="inline-block w-4 h-4 border-2 border-s330-highlight border-t-transparent rounded-full animate-spin mr-2" />
                        <span className="text-s330-muted">Loading wave data...</span>
                    </div>
                    {loadingProgress !== undefined && (
                        <div className="w-48">
                            <div className="h-2 bg-s330-panel rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                                    style={{ width: `${loadingProgress}%` }}
                                />
                            </div>
                            <p className="text-s330-muted text-xs text-center mt-1">
                                {loadingProgress.toFixed(0)}%
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!samples || samples.length === 0) {
        return (
            <div className={cn('card', className)}>
                <div className="text-center py-8 text-s330-muted">
                    No wave data available. Export or import a sample first.
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn('card', className)}
            ref={containerRef}
            tabIndex={0}
            data-loop-editor
        >
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-s330-text">Loop Editor</h4>
                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <button
                        onClick={handleZoomOut}
                        disabled={zoom <= MIN_ZOOM}
                        className="ac-btn ac-btn-xs ac-btn-ghost"
                        title="Zoom out"
                    >
                        −
                    </button>
                    <button
                        onClick={handleZoomReset}
                        className="ac-btn ac-btn-xs ac-btn-ghost min-w-[40px]"
                        title="Reset zoom"
                    >
                        {zoom}x
                    </button>
                    <button
                        onClick={handleZoomIn}
                        disabled={zoom >= MAX_ZOOM}
                        className="ac-btn ac-btn-xs ac-btn-ghost"
                        title="Zoom in"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Info bar */}
            <div className="flex items-center justify-between mb-2 text-xs text-s330-muted">
                <span>Loop length: {loopLength} samples ({loopDurationMs.toFixed(1)}ms)</span>
                <span>Drag to adjust • Arrow keys to nudge • +/- to zoom</span>
            </div>

            {/* Split pane waveform display */}
            <div className="flex mb-1">
                <div className="flex-1 text-xs text-s330-muted text-center">
                    ← Approaching End Point
                </div>
                <div className="flex-1 text-xs text-s330-muted text-center">
                    Loop Point Continues →
                </div>
            </div>
            <div className="flex w-full" ref={canvasContainerRef}>
                {/* Left pane: waveform leading to end point */}
                <canvas
                    ref={leftCanvasRef}
                    width={paneWidth}
                    height={height}
                    style={{ width: '50%', height }}
                    className={cn(
                        'rounded-l cursor-ew-resize',
                        isDragging === 'end' && 'ring-2 ring-s330-highlight'
                    )}
                    onMouseDown={(e) => handleMouseDown('end', e)}
                />
                {/* Right pane: waveform from loop point */}
                <canvas
                    ref={rightCanvasRef}
                    width={paneWidth}
                    height={height}
                    style={{ width: '50%', height }}
                    className={cn(
                        'rounded-r cursor-ew-resize',
                        isDragging === 'loop' && 'ring-2 ring-s330-highlight'
                    )}
                    onMouseDown={(e) => handleMouseDown('loop', e)}
                />
            </div>

            {/* Nudge controls */}
            <div className="flex gap-4 mt-4">
                {/* End point controls */}
                <div className="flex-1">
                    <label className="text-xs text-s330-muted block mb-1">End Point</label>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => nudgeEndPoint(-100)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move end point -100 samples"
                        >
                            ‹‹
                        </button>
                        <button
                            onClick={() => nudgeEndPoint(-1)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move end point -1 sample"
                        >
                            ‹
                        </button>
                        <input
                            type="number"
                            value={endPoint}
                            onChange={(e) => {
                                const val = Math.max(loopPoint, parseInt(e.target.value) || 0);
                                onEndPointChange?.(val);
                            }}
                            onBlur={() => onCommit?.()}
                            className="flex-1 min-w-0 text-sm font-mono bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text text-center"
                        />
                        <button
                            onClick={() => nudgeEndPoint(1)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move end point +1 sample"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => nudgeEndPoint(100)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move end point +100 samples"
                        >
                            ››
                        </button>
                    </div>
                </div>

                {/* Loop point controls */}
                <div className="flex-1">
                    <label className="text-xs text-s330-muted block mb-1">Loop Point</label>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => nudgeLoopPoint(-100)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move loop point -100 samples"
                        >
                            ‹‹
                        </button>
                        <button
                            onClick={() => nudgeLoopPoint(-1)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move loop point -1 sample"
                        >
                            ‹
                        </button>
                        <input
                            type="number"
                            value={loopPoint}
                            onChange={(e) => {
                                const val = Math.min(endPoint, Math.max(startPoint, parseInt(e.target.value) || 0));
                                onLoopPointChange?.(val);
                            }}
                            onBlur={() => onCommit?.()}
                            className="flex-1 min-w-0 text-sm font-mono bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text text-center"
                        />
                        <button
                            onClick={() => nudgeLoopPoint(1)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move loop point +1 sample"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => nudgeLoopPoint(100)}
                            className="ac-btn ac-btn-xs ac-btn-ghost"
                            title="Move loop point +100 samples"
                        >
                            ››
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
