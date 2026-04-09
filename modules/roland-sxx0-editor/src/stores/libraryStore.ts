/**
 * Zustand store for library management
 *
 * Manages state for the sampler library including:
 * - Loading library contents
 * - Exporting tones to library
 * - Importing tones from library
 */

import { create } from 'zustand';
import type {
  ToneYaml,
  PatchYaml,
  TemplateYaml,
  SetInfo,
} from '@audiocontrol/sampler-library/browser';

/**
 * Library item summary for display in browser
 */
export interface LibraryItemSummary {
  name: string;
  filename: string;
  modifiedAt?: Date;
}

/**
 * Set operation state
 */
export interface SetOperationState {
  isOperating: boolean;
  progress: number;
  setName: string | null;
  error: string | null;
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

/**
 * Expanded directories state for hierarchical library view.
 * Keys are path strings joined by '/' (e.g., "Piano/Grand")
 */
export interface ExpandedPaths {
  tones: Set<string>;
  patches: Set<string>;
  samples: Set<string>;
}

interface LibraryState {
  // Library contents
  tones: Map<string, LibraryItemSummary>;
  patches: Map<string, LibraryItemSummary>;
  templates: Map<string, LibraryItemSummary>;
  sets: SetInfo[];

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
  selectedCategory: 'tones' | 'patches' | 'templates' | 'sets';
  selectedItemName: string | null;
  selectedSetName: string | null;

  // Export dialog state
  exportDialog: ExportState;

  // Import dialog state
  importDialog: ImportState;

  // Set operation state
  saveSetDialog: SetOperationState;
  loadSetDialog: SetOperationState;

  // Directory expansion state for hierarchical view
  expandedPaths: ExpandedPaths;
}

interface LibraryActions {
  // Library loading
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;

  // Library contents
  setTones: (tones: Map<string, LibraryItemSummary>) => void;
  setPatches: (patches: Map<string, LibraryItemSummary>) => void;
  setTemplates: (templates: Map<string, LibraryItemSummary>) => void;
  setSets: (sets: SetInfo[]) => void;
  addTone: (filename: string, summary: LibraryItemSummary) => void;
  removeTone: (filename: string) => void;
  addSet: (setInfo: SetInfo) => void;
  removeSet: (setName: string) => void;

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
  setSelectedCategory: (category: 'tones' | 'patches' | 'templates' | 'sets') => void;
  setSelectedItem: (name: string | null) => void;
  setSelectedSet: (name: string | null) => void;

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

  // Save set dialog
  openSaveSetDialog: (setName: string) => void;
  closeSaveSetDialog: () => void;
  setSaveSetProgress: (progress: number) => void;
  setSaveSetError: (error: string | null) => void;
  setSaveSetComplete: () => void;

  // Load set dialog
  openLoadSetDialog: (setName: string) => void;
  closeLoadSetDialog: () => void;
  setLoadSetProgress: (progress: number) => void;
  setLoadSetError: (error: string | null) => void;
  setLoadSetComplete: () => void;

  // Directory expansion
  toggleDirectoryExpanded: (category: 'tones' | 'patches' | 'samples', path: string) => void;
  setDirectoryExpanded: (category: 'tones' | 'patches' | 'samples', path: string, expanded: boolean) => void;
  setExpandedPaths: (category: 'tones' | 'patches' | 'samples', paths: Set<string>) => void;
  collapseAllDirectories: (category?: 'tones' | 'patches' | 'samples') => void;

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

const initialSetOperationState: SetOperationState = {
  isOperating: false,
  progress: 0,
  setName: null,
  error: null,
};

const initialExpandedPaths: ExpandedPaths = {
  tones: new Set(),
  patches: new Set(),
  samples: new Set(),
};

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  // Initial state
  tones: new Map(),
  patches: new Map(),
  templates: new Map(),
  sets: [],
  loadedTones: new Map(),
  loadedPatches: new Map(),
  loadedTemplates: new Map(),
  isLoading: false,
  loadingMessage: null,
  error: null,
  isLibraryPanelOpen: false,
  selectedCategory: 'tones',
  selectedItemName: null,
  selectedSetName: null,
  exportDialog: initialExportState,
  importDialog: initialImportState,
  saveSetDialog: initialSetOperationState,
  loadSetDialog: initialSetOperationState,
  expandedPaths: initialExpandedPaths,

  // Library loading
  setLoading: (isLoading, message = null) =>
    set({ isLoading, loadingMessage: message }),

  setError: (error) => set({ error }),

  // Library contents
  setTones: (tones) => set({ tones }),
  setPatches: (patches) => set({ patches }),
  setTemplates: (templates) => set({ templates }),
  setSets: (sets) => set({ sets }),

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

  addSet: (setInfo) =>
    set((state) => ({
      sets: [...state.sets.filter((s) => s.name !== setInfo.name), setInfo].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    })),

  removeSet: (setName) =>
    set((state) => ({
      sets: state.sets.filter((s) => s.name !== setName),
    })),

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
    set({ selectedCategory: category, selectedItemName: null, selectedSetName: null }),

  setSelectedItem: (name) => set({ selectedItemName: name }),

  setSelectedSet: (name) => set({ selectedSetName: name }),

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

  // Save set dialog
  openSaveSetDialog: (setName) =>
    set({
      saveSetDialog: {
        isOperating: true,
        progress: 0,
        setName,
        error: null,
      },
    }),

  closeSaveSetDialog: () => set({ saveSetDialog: initialSetOperationState }),

  setSaveSetProgress: (progress) =>
    set((state) => ({
      saveSetDialog: { ...state.saveSetDialog, progress },
    })),

  setSaveSetError: (error) =>
    set((state) => ({
      saveSetDialog: { ...state.saveSetDialog, error, isOperating: false },
    })),

  setSaveSetComplete: () =>
    set((state) => ({
      saveSetDialog: { ...state.saveSetDialog, isOperating: false, progress: 100 },
    })),

  // Load set dialog
  openLoadSetDialog: (setName) =>
    set({
      loadSetDialog: {
        isOperating: true,
        progress: 0,
        setName,
        error: null,
      },
    }),

  closeLoadSetDialog: () => set({ loadSetDialog: initialSetOperationState }),

  setLoadSetProgress: (progress) =>
    set((state) => ({
      loadSetDialog: { ...state.loadSetDialog, progress },
    })),

  setLoadSetError: (error) =>
    set((state) => ({
      loadSetDialog: { ...state.loadSetDialog, error, isOperating: false },
    })),

  setLoadSetComplete: () =>
    set((state) => ({
      loadSetDialog: { ...state.loadSetDialog, isOperating: false, progress: 100 },
    })),

  // Directory expansion
  toggleDirectoryExpanded: (category, path) =>
    set((state) => {
      const categoryPaths = state.expandedPaths[category];
      const newPaths = new Set(categoryPaths);
      if (newPaths.has(path)) {
        newPaths.delete(path);
      } else {
        newPaths.add(path);
      }
      return {
        expandedPaths: {
          ...state.expandedPaths,
          [category]: newPaths,
        },
      };
    }),

  setDirectoryExpanded: (category, path, expanded) =>
    set((state) => {
      const categoryPaths = state.expandedPaths[category];
      const newPaths = new Set(categoryPaths);
      if (expanded) {
        newPaths.add(path);
      } else {
        newPaths.delete(path);
      }
      return {
        expandedPaths: {
          ...state.expandedPaths,
          [category]: newPaths,
        },
      };
    }),

  setExpandedPaths: (category, paths) =>
    set((state) => ({
      expandedPaths: {
        ...state.expandedPaths,
        [category]: paths,
      },
    })),

  collapseAllDirectories: (category) =>
    set((state) => {
      if (category) {
        return {
          expandedPaths: {
            ...state.expandedPaths,
            [category]: new Set(),
          },
        };
      }
      return {
        expandedPaths: initialExpandedPaths,
      };
    }),

  // Reset
  clear: () =>
    set({
      tones: new Map(),
      patches: new Map(),
      templates: new Map(),
      sets: [],
      loadedTones: new Map(),
      loadedPatches: new Map(),
      loadedTemplates: new Map(),
      error: null,
      selectedItemName: null,
      selectedSetName: null,
      exportDialog: initialExportState,
      importDialog: initialImportState,
      saveSetDialog: initialSetOperationState,
      loadSetDialog: initialSetOperationState,
      expandedPaths: initialExpandedPaths,
    }),
}));
