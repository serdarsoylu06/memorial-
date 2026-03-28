import { create } from "zustand";
import type { ArchiveFolder } from "../types";

interface ArchiveStore {
  tree: ArchiveFolder | null;
  selectedFolder: ArchiveFolder | null;
  searchQuery: string;
  isLoading: boolean;
  setTree: (tree: ArchiveFolder | null) => void;
  setSelectedFolder: (folder: ArchiveFolder | null) => void;
  setSearchQuery: (q: string) => void;
  setLoading: (v: boolean) => void;
}

export const useArchiveStore = create<ArchiveStore>((set) => ({
  tree: null,
  selectedFolder: null,
  searchQuery: "",
  isLoading: false,
  setTree: (tree) => set({ tree }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLoading: (isLoading) => set({ isLoading }),
}));

