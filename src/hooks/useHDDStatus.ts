import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export function useHDDStatus() {
  const { settings, hddStatus, setHDDStatus } = useAppStore();

  const checkStatus = useCallback(async () => {
    if (!settings.hdd_root) {
      setHDDStatus({ connected: false, path: null, label: null, total_bytes: null, free_bytes: null });
      return;
    }
    try {
      const exists = await invoke<boolean>("check_path_exists", { path: settings.hdd_root });
      if (!exists) {
        setHDDStatus({ connected: false, path: null, label: null, total_bytes: null, free_bytes: null });
        return;
      }
      let total_bytes: number | null = null;
      let free_bytes: number | null = null;
      try {
        const usage = await invoke<{ total_bytes: number; free_bytes: number; used_bytes: number }>(
          "get_disk_usage",
          { path: settings.hdd_root }
        );
        if (usage.total_bytes > 0) {
          total_bytes = usage.total_bytes;
          free_bytes = usage.free_bytes;
        }
      } catch {/* ignore disk usage errors */}

      setHDDStatus({
        connected: true,
        path: settings.hdd_root,
        label: settings.hdd_root.split("/").pop() ?? null,
        total_bytes,
        free_bytes,
      });
    } catch {
      setHDDStatus({ connected: false, path: null, label: null, total_bytes: null, free_bytes: null });
    }
  }, [settings.hdd_root, setHDDStatus]);

  useEffect(() => {
    void checkStatus();
    const interval = setInterval(() => void checkStatus(), 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return hddStatus;
}
