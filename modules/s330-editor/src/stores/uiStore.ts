/**
 * UI state store for layout preferences
 */

import { create } from 'zustand';

const STORAGE_KEY_DRAWER = 's330-drawer-open';
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
  /** Whether the video drawer is open */
  isDrawerOpen: boolean;
  /** Width of the drawer in pixels */
  drawerWidth: number;
}

interface UIActions {
  /** Toggle drawer open/closed */
  toggleDrawer: () => void;
  /** Set drawer open state */
  setDrawerOpen: (open: boolean) => void;
  /** Set drawer width */
  setDrawerWidth: (width: number) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  isDrawerOpen: localStorage.getItem(STORAGE_KEY_DRAWER) === 'true',
  drawerWidth: loadSidebarWidth(),

  toggleDrawer: () =>
    set((state) => {
      const newValue = !state.isDrawerOpen;
      localStorage.setItem(STORAGE_KEY_DRAWER, String(newValue));
      return { isDrawerOpen: newValue };
    }),

  setDrawerOpen: (open) => {
    localStorage.setItem(STORAGE_KEY_DRAWER, String(open));
    set({ isDrawerOpen: open });
  },

  setDrawerWidth: (width) => {
    const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    localStorage.setItem(STORAGE_KEY_SIDEBAR_WIDTH, String(clampedWidth));
    set({ drawerWidth: clampedWidth });
  },
}));

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH };
