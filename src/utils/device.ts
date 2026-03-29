/** Map device key names (from YAML) to human-readable display names */
export const DEVICE_LABELS: Record<string, string> = {
  Sony_a6700: "Sony α6700",
  Canon_6D: "Canon 6D",
  Canon_60D: "Canon 60D",
  iPhone: "iPhone",
  Samsung_Note8: "Samsung Note8",
  Unknown_Device: "Bilinmeyen",
};

export function deviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}

/** Device accent colors for chips and charts */
export const DEVICE_COLORS: Record<string, string> = {
  Sony_a6700: "#6c8cff",
  Canon_6D: "#f0b23a",
  Canon_60D: "#f09a3a",
  iPhone: "#3dd68c",
  Samsung_Note8: "#a78bfa",
  Unknown_Device: "#565e80",
};

export function deviceColor(device: string): string {
  return DEVICE_COLORS[device] ?? "#565e80";
}

export function deviceFolderSegment(device: string): string {
  // Device key IS the folder segment now (e.g. "Sony_a6700", "iPhone")
  return device || "Unknown_Device";
}

/** Format bytes to KB / MB / GB / TB */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1e6) return `${(bytes / 1e3).toFixed(0)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes < 1e12) return `${(bytes / 1e9).toFixed(2)} GB`;
  return `${(bytes / 1e12).toFixed(2)} TB`;
}
