/**
 * useLibraryTreeDragDrop
 *
 * Encapsulates all drag-and-drop event handlers used by
 * LibraryTreePanel: device-to-library drop zones for tones
 * and patches, and library-to-device drag-start handlers for
 * individual tones, patches, drum kits, and set children.
 */

import { useState, useCallback } from 'react';
import type {
  DrumKitInfo,
  LibraryToneInfo,
  LibraryPatchInfo,
} from '@/lib/library-service';
import {
  DEVICE_DRAG_MIME,
  type DeviceDragData,
  LIBRARY_DRAG_MIME,
  type LibraryDragData,
} from '@/components/library/DeviceMemoryPanel';

export interface UseLibraryTreeDragDropParams {
  onDropDeviceTone?: (data: DeviceDragData, targetPath?: string[]) => void;
  onDropDevicePatch?: (data: DeviceDragData, targetPath?: string[]) => void;
}

export interface LibraryTreeDragDropHandlers {
  isToneDragOver: boolean;
  isPatchDragOver: boolean;
  handleToneDragOver: (e: React.DragEvent) => void;
  handleToneDragEnter: (e: React.DragEvent) => void;
  handleToneDragLeave: (e: React.DragEvent) => void;
  handleToneDrop: (e: React.DragEvent) => void;
  handlePatchDragOver: (e: React.DragEvent) => void;
  handlePatchDragEnter: (e: React.DragEvent) => void;
  handlePatchDragLeave: (e: React.DragEvent) => void;
  handlePatchDrop: (e: React.DragEvent) => void;
  handleIndividualToneDragStart: (e: React.DragEvent, toneInfo: LibraryToneInfo) => void;
  handleIndividualPatchDragStart: (e: React.DragEvent, patchInfo: LibraryPatchInfo) => void;
  handleDrumKitDragStart: (e: React.DragEvent, kitInfo: DrumKitInfo) => void;
  handleSetToneDragStart: (e: React.DragEvent, toneFile: string, setName: string) => void;
  handleSetPatchDragStart: (e: React.DragEvent, patchFile: string, setName: string) => void;
}

export function useLibraryTreeDragDrop({
  onDropDeviceTone,
  onDropDevicePatch,
}: UseLibraryTreeDragDropParams): LibraryTreeDragDropHandlers {
  const [isToneDragOver, setIsToneDragOver] = useState(false);
  const [isPatchDragOver, setIsPatchDragOver] = useState(false);

  // Handle drag over for tone drop zone
  const handleToneDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleToneDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setIsToneDragOver(true);
    }
  }, []);

  const handleToneDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsToneDragOver(false);
    }
  }, []);

  const handleToneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsToneDragOver(false);

    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as DeviceDragData;
      onDropDeviceTone?.(data);
    } catch (err) {
      console.error('[LibraryTreePanel] Failed to parse drop data:', err);
    }
  }, [onDropDeviceTone]);

  // Handle drag over for patch drop zone
  const handlePatchDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handlePatchDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setIsPatchDragOver(true);
    }
  }, []);

  const handlePatchDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsPatchDragOver(false);
    }
  }, []);

  const handlePatchDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsPatchDragOver(false);

    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as DeviceDragData;
      onDropDevicePatch?.(data);
    } catch (err) {
      console.error('[LibraryTreePanel] Failed to parse drop data:', err);
    }
  }, [onDropDevicePatch]);

  // Handle drag start for individual tones (library -> device)
  const handleIndividualToneDragStart = useCallback((e: React.DragEvent, toneInfo: LibraryToneInfo) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'tone',
      name: toneInfo.fileName,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for individual patches (library -> device)
  const handleIndividualPatchDragStart = useCallback((e: React.DragEvent, patchInfo: LibraryPatchInfo) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'patch',
      name: patchInfo.directoryName,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for drum kits (library -> device)
  const handleDrumKitDragStart = useCallback((e: React.DragEvent, kitInfo: DrumKitInfo) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'drumKit',
      name: kitInfo.directoryName,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for tones within sets (library -> device)
  const handleSetToneDragStart = useCallback((e: React.DragEvent, toneFile: string, setName: string) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'tone',
      name: toneFile,
      setName,
      toneFile,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for patches within sets (library -> device)
  const handleSetPatchDragStart = useCallback((e: React.DragEvent, patchFile: string, setName: string) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'patch',
      name: patchFile,
      setName,
      patchFile,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return {
    isToneDragOver,
    isPatchDragOver,
    handleToneDragOver,
    handleToneDragEnter,
    handleToneDragLeave,
    handleToneDrop,
    handlePatchDragOver,
    handlePatchDragEnter,
    handlePatchDragLeave,
    handlePatchDrop,
    handleIndividualToneDragStart,
    handleIndividualPatchDragStart,
    handleDrumKitDragStart,
    handleSetToneDragStart,
    handleSetPatchDragStart,
  };
}
