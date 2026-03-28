import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { useArchiveStore } from "../store/useArchiveStore";
import type { ArchiveFolder } from "../types";

export function useArchiveTree() {
  const { settings } = useAppStore();
  const { setTree, setLoading } = useArchiveStore();

  const loadTree = useCallback(async () => {
    if (!settings.hdd_root) return;
    const archivePath = `${settings.hdd_root}/${settings.archive_dir}`;
    setLoading(true);
    try {
      const tree = await invoke<ArchiveFolder>("get_archive_tree", { archivePath });
      setTree(tree);
    } catch (err) {
      console.error("Archive tree failed:", err);
    } finally {
      setLoading(false);
    }
  }, [settings, setTree, setLoading]);

  return { loadTree };
}
