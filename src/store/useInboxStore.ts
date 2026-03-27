import { create } from "zustand";
import type { ScanResult, Session } from "../types";

interface InboxStore {
  scanResult: ScanResult | null;
  selectedSession: Session | null;
  isScanning: boolean;
  approvedSessions: string[];
  rejectedSessions: string[];
  setScanResult: (result: ScanResult | null) => void;
  setSelectedSession: (session: Session | null) => void;
  setScanning: (v: boolean) => void;
  approveSession: (id: string) => void;
  rejectSession: (id: string) => void;
  resetApprovals: () => void;
}

export const useInboxStore = create<InboxStore>((set) => ({
  scanResult: null,
  selectedSession: null,
  isScanning: false,
  approvedSessions: [],
  rejectedSessions: [],
  setScanResult: (scanResult) => set({ scanResult }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setScanning: (isScanning) => set({ isScanning }),
  approveSession: (id) =>
    set((state) => ({
      approvedSessions: state.approvedSessions.includes(id)
        ? state.approvedSessions
        : [...state.approvedSessions, id],
      rejectedSessions: state.rejectedSessions.filter((s) => s !== id),
    })),
  rejectSession: (id) =>
    set((state) => ({
      rejectedSessions: state.rejectedSessions.includes(id)
        ? state.rejectedSessions
        : [...state.rejectedSessions, id],
      approvedSessions: state.approvedSessions.filter((s) => s !== id),
    })),
  resetApprovals: () => set({ approvedSessions: [], rejectedSessions: [] }),
}));
