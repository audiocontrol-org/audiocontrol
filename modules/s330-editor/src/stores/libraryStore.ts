/**
 * Zustand store for library management
 *
 * Manages state for the sampler library including:
 * - Loading library contents
 * - Exporting tones to library
 * - Importing tones from library
 */

import { create } from 'zustand';
import type { ToneYaml, PatchYaml, TemplateYaml } from '@audiocontrol/sampler-library/browser';

/**
 * Library item summary for display in browser
 */
export interface LibraryItemSummary {
  name: string;
  filename: string;
  modifiedAt?: Date;
}

/**
 * Export operation state
 */
export interface ExportState {
  isExporting: boolean;
  progress: number;
  toneName: string | null;
  error: string | null;
}

/**
 * Import operation state
 */
export interface ImportState {
  isImporting: boolean;
  progress: number;
  toneName: string | null;
  error: string | null;
}

interface LibraryState {
  // Library contents
  tones: Map<string, LibraryItemSummary>;
  patches: Map<string, LibraryItemSummary>;
  templates: Map<string, LibraryItemSummary>;

  // Loaded item cache
  loadedTones: Map<string, ToneYaml>;
  loadedPatches: Map<string, PatchYaml>;
  loadedTemplates: Map<string, TemplateYaml>;

  // UI state
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;

  // Library panel state
  isLibraryPanelOpen: boolean;
  selectedCategory: 'tones' | 'patches' | 'templates';
  selectedItemName: string | null;

  // Export dialog state
  exportDialog: ExportState;

  // Import dialog state
  importDialog: ImportState;
}

interface LibraryActions {
  // Library loading
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;

  // Library contents
  setTones: (tones: Map<string, LibraryItemSummary>) => void;
  setPatches: (patches: Map<string, LibraryItemSummary>) => void;
  setTemplates: (templates: Map<string, LibraryItemSummary>) => void;
  addTone: (filename: string, summary: LibraryItemSummary) => void;
  removeTone: (filename: string) => void;

  // Loaded item cache
  cacheTone: (name: string, tone: ToneYaml) => void;
  cachePatch: (name: string, patch: PatchYaml) => void;
  cacheTemplate: (name: string, template: TemplateYaml) => void;
  getCachedTone: (name: string) => ToneYaml | undefined;
  getCachedPatch: (name: string) => PatchYaml | undefined;
  getCachedTemplate: (name: string) => TemplateYaml | undefined;

  // UI state
  toggleLibraryPanel: () => void;
  setLibraryPanelOpen: (open: boolean) => void;
  setSelectedCategory: (category: 'tones' | 'patches' | 'templates') => void;
  setSelectedItem: (name: string | null) => void;

  // Export dialog
  openExportDialog: (toneName: string) => void;
  closeExportDialog: () => void;
  setExportProgress: (progress: number) => void;
  setExportError: (error: string | null) => void;
  setExportComplete: () => void;

  // Import dialog
  openImportDialog: (toneName: string) => void;
  closeImportDialog: () => void;
  setImportProgress: (progress: number) => void;
  setImportError: (error: string | null) => void;
  setImportComplete: () => void;

  // Reset
  clear: () => void;
}

type LibraryStore = LibraryState & LibraryActions;

const initialExportState: ExportState = {
  isExporting: false,
  progress: 0,
  toneName: null,
  error: null,
};

const initialImportState: ImportState = {
  isImporting: false,
  progress: 0,
  toneName: null,
  error: null,
};

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  // Initial state
  tones: new Map(),
  patches: new Map(),
  templates: new Map(),
  loadedTones: new Map(),
  loadedPatches: new Map(),
  loadedTemplates: new Map(),
  isLoading: false,
  loadingMessage: null,
  error: null,
  isLibraryPanelOpen: false,
  selectedCategory: 'tones',
  selectedItemName: null,
  exportDialog: initialExportState,
  importDialog: initialImportState,

  // Library loading
  setLoading: (isLoading, message = null) =>
    set({ isLoading, loadingMessage: message }),

  setError: (error) => set({ error }),

  // Library contents
  setTones: (tones) => set({ tones }),
  setPatches: (patches) => set({ patches }),
  setTemplates: (templates) => set({ templates }),

  addTone: (filename, summary) =>
    set((state) => {
      const newTones = new Map(state.tones);
      newTones.set(filename, summary);
      return { tones: newTones };
    }),

  removeTone: (filename) =>
    set((state) => {
      const newTones = new Map(state.tones);
      newTones.delete(filename);
      return { tones: newTones };
    }),

  // Loaded item cache
  cacheTone: (name, tone) =>
    set((state) => {
      const newLoadedTones = new Map(state.loadedTones);
      newLoadedTones.set(name, tone);
      return { loadedTones: newLoadedTones };
    }),

  cachePatch: (name, patch) =>
    set((state) => {
      const newLoadedPatches = new Map(state.loadedPatches);
      newLoadedPatches.set(name, patch);
      return { loadedPatches: newLoadedPatches };
    }),

  cacheTemplate: (name, template) =>
    set((state) => {
      const newLoadedTemplates = new Map(state.loadedTemplates);
      newLoadedTemplates.set(name, template);
      return { loadedTemplates: newLoadedTemplates };
    }),

  getCachedTone: (name) => get().loadedTones.get(name),
  getCachedPatch: (name) => get().loadedPatches.get(name),
  getCachedTemplate: (name) => get().loadedTemplates.get(name),

  // UI state
  toggleLibraryPanel: () =>
    set((state) => ({ isLibraryPanelOpen: !state.isLibraryPanelOpen })),

  setLibraryPanelOpen: (open) => set({ isLibraryPanelOpen: open }),

  setSelectedCategory: (category) =>
    set({ selectedCategory: category, selectedItemName: null }),

  setSelectedItem: (name) => set({ selectedItemName: name }),

  // Export dialog
  openExportDialog: (toneName) =>
    set({
      exportDialog: {
        isExporting: true,
        progress: 0,
        toneName,
        error: null,
      },
    }),

  closeExportDialog: () => set({ exportDialog: initialExportState }),

  setExportProgress: (progress) =>
    set((state) => ({
      exportDialog: { ...state.exportDialog, progress },
    })),

  setExportError: (error) =>
    set((state) => ({
      exportDialog: { ...state.exportDialog, error, isExporting: false },
    })),

  setExportComplete: () =>
    set((state) => ({
      exportDialog: { ...state.exportDialog, isExporting: false, progress: 100 },
    })),

  // Import dialog
  openImportDialog: (toneName) =>
    set({
      importDialog: {
        isImporting: true,
        progress: 0,
        toneName,
        error: null,
      },
    }),

  closeImportDialog: () => set({ importDialog: initialImportState }),

  setImportProgress: (progress) =>
    set((state) => ({
      importDialog: { ...state.importDialog, progress },
    })),

  setImportError: (error) =>
    set((state) => ({
      importDialog: { ...state.importDialog, error, isImporting: false },
    })),

  setImportComplete: () =>
    set((state) => ({
      importDialog: { ...state.importDialog, isImporting: false, progress: 100 },
    })),

  // Reset
  clear: () =>
    set({
      tones: new Map(),
      patches: new Map(),
      templates: new Map(),
      loadedTones: new Map(),
      loadedPatches: new Map(),
      loadedTemplates: new Map(),
      error: null,
      selectedItemName: null,
      exportDialog: initialExportState,
      importDialog: initialImportState,
    }),
}));
