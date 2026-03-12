import { useEffect, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

/**
 * Polls HDD connection status by checking if the configured hdd_root path
 * is accessible. Updates the global store on change.
 */
export function useHDDStatus() {
  const { settings, hddStatus, setHDDStatus } = useAppStore();

  const checkStatus = useCallback(async () => {
    if (!settings.hdd_root) {
      setHDDStatus({ connected: false, path: null, label: null, total_bytes: null, free_bytes: null });
      return;
    }
    try {
      // TODO: invoke Tauri fs.exists / fs.stat to check hdd_root
      // TODO: Read disk usage via Tauri shell command (df on macOS/Linux, wmic on Windows)
      setHDDStatus({
        connected: true,
        path: settings.hdd_root,
        label: settings.hdd_root.split("/").pop() ?? null,
        total_bytes: null,
        free_bytes: null,
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
