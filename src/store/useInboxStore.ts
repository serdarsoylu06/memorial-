import { create } from "zustand";
import type { MediaFile, ScanResult, Session } from "../types";

interface InboxStore {
  scanResult: ScanResult | null;
  selectedSession: Session | null;
  isScanning: boolean;
  approvedSessions: Set<string>;
  rejectedSessions: Set<string>;
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
  approvedSessions: new Set(),
  rejectedSessions: new Set(),
  setScanResult: (scanResult) => set({ scanResult }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setScanning: (isScanning) => set({ isScanning }),
  approveSession: (id) =>
    set((state) => ({
      approvedSessions: new Set([...state.approvedSessions, id]),
      rejectedSessions: new Set([...state.rejectedSessions].filter((s) => s !== id)),
    })),
  rejectSession: (id) =>
    set((state) => ({
      rejectedSessions: new Set([...state.rejectedSessions, id]),
      approvedSessions: new Set([...state.approvedSessions].filter((s) => s !== id)),
    })),
  resetApprovals: () => set({ approvedSessions: new Set(), rejectedSessions: new Set() }),
}));
