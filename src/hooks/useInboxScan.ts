import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { useInboxStore } from "../store/useInboxStore";
import type { ScanResult } from "../types";

export function useInboxScan() {
  const { settings } = useAppStore();
  const { setScanning, setScanResult, setScanError, isScanning } = useInboxStore();

  const scan = useCallback(async () => {
    if (!settings.hdd_root || isScanning) return;
    const inboxPath = `${settings.hdd_root.replace(/\/$/, "")}/${settings.inbox_dir.replace(/^\//, "")}`;
    setScanning(true);
    setScanError(null);
    try {
      const inboxExists = await invoke<boolean>("check_path_exists", { path: inboxPath });
      if (!inboxExists) {
        throw new Error(`INBOX klasoru bulunamadi: ${inboxPath}`);
      }

      const result = await invoke<ScanResult>("scan_inbox", {
        inboxPath,
        sessionGapHours: settings.operations.session_gap_hours,
      });
      setScanResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Scan failed:", message);
      setScanError(message);
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  }, [settings, isScanning, setScanning, setScanError, setScanResult]);

  return { scan };
}
