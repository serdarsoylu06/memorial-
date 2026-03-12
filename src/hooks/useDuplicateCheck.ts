import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DuplicatePair } from "../types";

/**
 * Provides a `checkDuplicates()` function that invokes the Rust
 * `check_duplicates` command for a list of file paths.
 */
export function useDuplicateCheck() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [isChecking, setChecking] = useState(false);

  const checkDuplicates = useCallback(async (filePaths: string[], threshold = 10) => {
    setChecking(true);
    try {
      const result = await invoke<DuplicatePair[]>("check_duplicates", {
        filePaths,
        phashThreshold: threshold,
      });
      setPairs(result);
    } catch (err) {
      console.error("Duplicate check failed:", err);
      setPairs([]);
    } finally {
      setChecking(false);
    }
  }, []);

  return { pairs, isChecking, checkDuplicates };
}
