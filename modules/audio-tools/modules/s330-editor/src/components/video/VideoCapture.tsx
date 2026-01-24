/**
 * Video Capture Panel
 *
 * Displays video from a USB capture device (or webcam) using the
 * browser's Media Devices API. Useful for viewing S-330's display
 * alongside the editor.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const STORAGE_KEY_DEVICE = 's330-video-device';
const STORAGE_KEY_POSITION = 's330-video-position';
const STORAGE_KEY_SIZE = 's330-video-size';

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

interface VideoDevice {
  deviceId: string;
  label: string;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export function VideoCapture() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Position and size state
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_POSITION);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { x: window.innerWidth - DEFAULT_WIDTH - 16, y: window.innerHeight - DEFAULT_HEIGHT - 16 };
  });

  const [size, setSize] = useState<Size>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SIZE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Enumerate available video devices
  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}...`,
        }));
      setDevices(videoDevices);

      // Restore saved device selection
      const savedDeviceId = localStorage.getItem(STORAGE_KEY_DEVICE);
      if (savedDeviceId && videoDevices.some((d) => d.deviceId === savedDeviceId)) {
        setSelectedDeviceId(savedDeviceId);
      } else if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('[VideoCapture] Failed to enumerate devices:', err);
      setError('Failed to list video devices');
    }
  }, [selectedDeviceId]);

  // Request permission and enumerate devices
  const requestPermission = useCallback(async () => {
    try {
      setError(null);
      // Request permission by getting a temporary stream
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the temporary stream immediately
      tempStream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      await enumerateDevices();
    } catch (err) {
      console.error('[VideoCapture] Permission denied:', err);
      setHasPermission(false);
      setError('Camera permission denied');
    }
  }, [enumerateDevices]);

  // Start video stream
  const startStream = useCallback(async () => {
    if (!selectedDeviceId) return;

    try {
      setError(null);

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedDeviceId },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);
      localStorage.setItem(STORAGE_KEY_DEVICE, selectedDeviceId);
    } catch (err) {
      console.error('[VideoCapture] Failed to start stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to start video');
      setIsStreaming(false);
    }
  }, [selectedDeviceId]);

  // Stop video stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Handle device change
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isStreaming) {
      // Restart stream with new device
      stopStream();
    }
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  }, [size]);

  const handleDragEnd = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
    }
  }, [position]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const deltaX = e.clientX - resizeStart.current.x;
    const deltaY = e.clientY - resizeStart.current.y;
    const newWidth = Math.max(MIN_WIDTH, resizeStart.current.width + deltaX);
    const newHeight = Math.max(MIN_HEIGHT, resizeStart.current.height + deltaY);
    setSize({ width: newWidth, height: newHeight });
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify(size));
    }
  }, [size]);

  // Global mouse event listeners for drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e);
      handleResizeMove(e);
    };
    const handleMouseUp = () => {
      handleDragEnd();
      handleResizeEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);

  // Check for permission on mount
  useEffect(() => {
    // Check if we already have permission by trying to enumerate
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      // If labels are available, we have permission
      const hasLabels = devices.some((d) => d.kind === 'videoinput' && d.label);
      if (hasLabels) {
        setHasPermission(true);
        enumerateDevices();
      }
    });
  }, [enumerateDevices]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      if (hasPermission) {
        enumerateDevices();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [hasPermission, enumerateDevices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Auto-start stream when expanded and device selected
  useEffect(() => {
    if (isExpanded && selectedDeviceId && hasPermission && !isStreaming) {
      startStream();
    } else if (!isExpanded && isStreaming) {
      stopStream();
    }
  }, [isExpanded, selectedDeviceId, hasPermission, isStreaming, startStream, stopStream]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'px-4 py-2 rounded-lg shadow-lg',
            'bg-s330-panel border border-s330-accent',
            'text-s330-text hover:bg-s330-accent/50',
            'transition-colors flex items-center gap-2'
          )}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Video
        </button>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
          }}
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
            <span className="text-sm font-medium text-s330-text">S-330 Display</span>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              )}
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

          {/* Video area */}
          <div className="flex-1 bg-black relative min-h-0">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              muted
            />

            {/* Permission request overlay */}
            {hasPermission === null && (
              <div className="absolute inset-0 flex items-center justify-center bg-s330-bg/90">
                <button
                  onClick={requestPermission}
                  className="px-4 py-2 bg-s330-highlight text-white rounded hover:bg-s330-highlight/80"
                >
                  Enable Camera Access
                </button>
              </div>
            )}

            {/* No permission overlay */}
            {hasPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-s330-bg/90 p-4">
                <p className="text-s330-muted text-sm text-center mb-2">
                  Camera access denied
                </p>
                <button
                  onClick={requestPermission}
                  className="px-3 py-1 text-sm bg-s330-accent text-s330-text rounded hover:bg-s330-accent/80"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* No devices overlay */}
            {hasPermission && devices.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-s330-bg/90">
                <p className="text-s330-muted text-sm">No video devices found</p>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute bottom-0 left-0 right-0 bg-red-500/80 px-2 py-1">
                <p className="text-white text-xs">{error}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          {hasPermission && devices.length > 0 && (
            <div className="p-2 border-t border-s330-accent flex gap-2 items-center">
              {/* Device selector */}
              <select
                value={selectedDeviceId ?? ''}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className={cn(
                  'flex-1 px-2 py-1 text-xs font-mono',
                  'bg-s330-bg border border-s330-accent rounded',
                  'text-s330-text focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                )}
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>

              {/* Start/Stop button */}
              {!isStreaming ? (
                <button
                  onClick={startStream}
                  disabled={!selectedDeviceId}
                  className={cn(
                    'px-3 py-1 text-xs rounded',
                    'bg-s330-highlight text-white hover:bg-s330-highlight/80',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={stopStream}
                  className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500"
                >
                  Stop
                </button>
              )}
            </div>
          )}

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            className={cn(
              'absolute bottom-0 right-0 w-4 h-4 cursor-se-resize',
              'hover:bg-s330-highlight/30 transition-colors'
            )}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(233, 69, 96, 0.5) 50%)',
            }}
          />
        </div>
      )}
    </div>
  );
}
