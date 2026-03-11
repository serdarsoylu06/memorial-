import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInboxStore } from "../store/useInboxStore";
import { useAppStore } from "../store/useAppStore";
import type { ScanResult } from "../types";

/**
 * Provides a `scan()` function that invokes the Rust `scan_inbox` command
 * and stores the result in the inbox store.
 */
export function useInboxScan() {
  const { setScanning, setScanResult } = useInboxStore();
  const { settings } = useAppStore();

  const scan = useCallback(async () => {
    if (!settings.hdd_root) return;
    const inboxPath = `${settings.hdd_root}/${settings.inbox_dir}`;
    setScanning(true);
    try {
      const result = await invoke<ScanResult>("scan_inbox", { inboxPath });
      setScanResult(result);
    } catch (err) {
      console.error("Inbox scan failed:", err);
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  }, [settings.hdd_root, settings.inbox_dir, setScanning, setScanResult]);

  return { scan };
}
