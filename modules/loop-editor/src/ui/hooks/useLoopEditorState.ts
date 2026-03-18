/**
 * Hook managing local UI state for the loop editor.
 *
 * Tracks zoom, drag state, and preview mode without coupling
 * to any external store.
 */

import { useState, useCallback } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 128;
const ZOOM_STEP = 2;

export interface UseLoopEditorStateReturn {
  zoom: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  isDragging: 'loop' | 'end' | null;
  setIsDragging: (v: 'loop' | 'end' | null) => void;
  dragStartX: number;
  setDragStartX: (v: number) => void;
  dragStartValue: number;
  setDragStartValue: (v: number) => void;
  previewMode: 'normal' | 'smoothed' | null;
  setPreviewMode: (v: 'normal' | 'smoothed' | null) => void;
}

export function useLoopEditorState(): UseLoopEditorStateReturn {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState<'loop' | 'end' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const [previewMode, setPreviewMode] = useState<'normal' | 'smoothed' | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  return {
    zoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    isDragging,
    setIsDragging,
    dragStartX,
    setDragStartX,
    dragStartValue,
    setDragStartValue,
    previewMode,
    setPreviewMode,
  };
}
