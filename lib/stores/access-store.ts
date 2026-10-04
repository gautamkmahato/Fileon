import { create } from "zustand";

/** Open/closed state for the "Add from Google Drive" picker flow inside the app. */
interface AccessState {
  setupOpen: boolean;
  openSetup: () => void;
  closeSetup: () => void;
}

export const useAccessStore = create<AccessState>()((set) => ({
  setupOpen: false,
  openSetup: () => set({ setupOpen: true }),
  closeSetup: () => set({ setupOpen: false }),
}));
