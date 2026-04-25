import { create } from 'zustand';

interface PendingPdfState {
  pendingUri: string | null;
  setPending: (uri: string) => void;
  clearPending: () => void;
}

export const usePendingPdfStore = create<PendingPdfState>((set) => ({
  pendingUri: null,
  setPending: (uri) => set({ pendingUri: uri }),
  clearPending: () => set({ pendingUri: null }),
}));
