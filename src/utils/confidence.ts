import type { Confidence, MediaFile } from "../types";

export interface ConfidenceResult {
  level: Confidence;
  label: string;
  color: string;
  autoMove: boolean;
}

/**
 * Calculate a confidence score for a group of files based on available signals.
 *
 * Signal priority:
 *   1. EXIF GPS + folder name match  → High  → auto-move
 *   2. EXIF GPS present, no folder   → High  → auto-move
 *   3. Folder name + iPhone GPS      → Medium → auto-move + log
 *   4. Only iPhone GPS correlation   → Medium → auto-move + log
 *   5. Only folder name              → Low   → ask user
 *   6. No signal                     → None  → send to REVIEW
 */
export function calculateConfidence(
  files: MediaFile[],
  folderNameParsed: boolean
): ConfidenceResult {
  const hasExifGps = files.some((f) => f.has_gps && f.device !== "iPhone");
  const hasIPhoneGps = files.some((f) => f.has_gps && f.device === "iPhone");

  if (hasExifGps && folderNameParsed) {
    return { level: "high", label: "Yüksek", color: "#4caf82", autoMove: true };
  }
  if (hasExifGps) {
    return { level: "high", label: "Yüksek", color: "#4caf82", autoMove: true };
  }
  if (folderNameParsed && hasIPhoneGps) {
    return { level: "medium", label: "Orta", color: "#f0a830", autoMove: true };
  }
  if (hasIPhoneGps) {
    return { level: "medium", label: "Orta", color: "#f0a830", autoMove: true };
  }
  if (folderNameParsed) {
    return { level: "low", label: "Düşük", color: "#e05252", autoMove: false };
  }
  return { level: "none", label: "Sinyal Yok", color: "#8b92a9", autoMove: false };
}
