import { create } from "zustand";
import type { AppSettings, HDDStatus, SessionLog } from "../types";

interface AppStore {
  settings: AppSettings;
  hddStatus: HDDStatus;
  recentLogs: SessionLog[];
  isLoading: boolean;
  setSettings: (s: Partial<AppSettings>) => void;
  setHDDStatus: (s: HDDStatus) => void;
  setRecentLogs: (logs: SessionLog[]) => void;
  setLoading: (v: boolean) => void;
}

const defaultSettings: AppSettings = {
  hdd_root: "",
  archive_dir: "ARCHIVE",
  edits_dir: "EDITS",
  inbox_dir: "INBOX",
  review_dir: "REVIEW",
  staging_dir: "STAGING",
  log_dir: ".memorial_logs",
  operations: {
    default_mode: "copy",
    dry_run_first: true,
    session_gap_hours: 2,
    max_files_per_folder: 500,
  },
  duplicates: {
    sha256_check: true,
    phash_check: true,
    phash_threshold: 10,
  },
  ui: {
    theme: "dark",
    language: "tr",
  },
};

export const useAppStore = create<AppStore>((set) => ({
  settings: defaultSettings,
  hddStatus: { connected: false, path: null, label: null, total_bytes: null, free_bytes: null },
  recentLogs: [],
  isLoading: false,
  setSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),
  setHDDStatus: (hddStatus) => set({ hddStatus }),
  setRecentLogs: (recentLogs) => set({ recentLogs }),
  setLoading: (isLoading) => set({ isLoading }),
}));
