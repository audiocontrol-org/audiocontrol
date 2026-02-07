/**
 * UI state store for layout preferences
 */

import { create } from 'zustand';

const STORAGE_KEY_DOCKED = 's330-video-docked';
const STORAGE_KEY_SIDEBAR_WIDTH = 's330-sidebar-width';

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;

function loadSidebarWidth(): number {
  const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR_WIDTH);
  if (saved) {
    const width = parseInt(saved, 10);
    if (!isNaN(width) && width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
      return width;
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

interface UIState {
  /** Whether the video panel is docked in the sidebar */
  isVideoDocked: boolean;
  /** Width of the sidebar in pixels */
  sidebarWidth: number;
}

interface UIActions {
  /** Toggle dock state */
  toggleVideoDock: () => void;
  /** Set dock state */
  setVideoDocked: (docked: boolean) => void;
  /** Set sidebar width */
  setSidebarWidth: (width: number) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  isVideoDocked: localStorage.getItem(STORAGE_KEY_DOCKED) === 'true',
  sidebarWidth: loadSidebarWidth(),

  toggleVideoDock: () =>
    set((state) => {
      const newValue = !state.isVideoDocked;
      localStorage.setItem(STORAGE_KEY_DOCKED, String(newValue));
      return { isVideoDocked: newValue };
    }),

  setVideoDocked: (docked) => {
    localStorage.setItem(STORAGE_KEY_DOCKED, String(docked));
    set({ isVideoDocked: docked });
  },

  setSidebarWidth: (width) => {
    const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    localStorage.setItem(STORAGE_KEY_SIDEBAR_WIDTH, String(clampedWidth));
    set({ sidebarWidth: clampedWidth });
  },
}));

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH };
