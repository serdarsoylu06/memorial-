import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { useInboxStore } from "../store/useInboxStore";
import type { ScanResult } from "../types";

export function useInboxScan() {
  const { setScanning, setScanResult, setScanError, isScanning } = useInboxStore();
  const scanningRef = useRef(false);

  const scan = useCallback(async (overrideInboxDir?: string) => {
    // Always read the latest settings from the store directly
    const latestSettings = useAppStore.getState().settings;
    const inboxDir = overrideInboxDir ?? latestSettings.inbox_dir;
    const hddRoot = latestSettings.hdd_root;

    if (!hddRoot || scanningRef.current) return;

    // If inbox_dir is an absolute path, use it directly; otherwise join with hdd_root
    const inboxPath = inboxDir.startsWith("/")
      ? inboxDir
      : `${hddRoot.replace(/\/$/, "")}/${inboxDir.replace(/^\//, "")}`;
    scanningRef.current = true;
    setScanning(true);
    setScanError(null);
    try {
      const inboxExists = await invoke<boolean>("check_path_exists", { path: inboxPath });
      if (!inboxExists) {
        throw new Error(`INBOX klasörü bulunamadı: ${inboxPath}`);
      }

      const result = await invoke<ScanResult>("scan_inbox", {
        inboxPath,
        sessionGapHours: latestSettings.operations.session_gap_hours,
      });
      setScanResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Scan failed:", message);
      setScanError(message);
      setScanResult(null);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [setScanning, setScanError, setScanResult]);

  return { scan, isScanning };
}
