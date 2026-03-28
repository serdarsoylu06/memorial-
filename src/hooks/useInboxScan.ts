import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { useInboxStore } from "../store/useInboxStore";
import type { ScanResult } from "../types";

export function useInboxScan() {
  const { settings } = useAppStore();
  const { setScanning, setScanResult, isScanning } = useInboxStore();

  const scan = useCallback(async () => {
    if (!settings.hdd_root || isScanning) return;
    const inboxPath = `${settings.hdd_root}/${settings.inbox_dir}`;
    setScanning(true);
    try {
      const result = await invoke<ScanResult>("scan_inbox", {
        inboxPath,
        sessionGapHours: settings.operations.session_gap_hours,
      });
      setScanResult(result);
    } catch (err) {
      console.error("Scan failed:", err);
      setScanResult({ total_files: 0, sessions: [], unclassified: [] });
    } finally {
      setScanning(false);
    }
  }, [settings, isScanning, setScanning, setScanResult]);

  return { scan };
}
