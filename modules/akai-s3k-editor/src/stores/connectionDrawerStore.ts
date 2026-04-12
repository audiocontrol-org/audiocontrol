import { create } from 'zustand';

interface ConnectionDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useConnectionDrawerStore = create<ConnectionDrawerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
