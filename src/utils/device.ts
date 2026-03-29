/** Map Rust DeviceType enum variants to human-readable display names */
export const DEVICE_LABELS: Record<string, string> = {
  SonyA6700: "Sony α6700",
  Canon6D: "Canon 6D",
  Canon60D: "Canon 60D",
  IPhone: "iPhone",
  SamsungNote8: "Samsung Note8",
  Unknown: "Bilinmeyen",
  Sony_a6700: "Sony α6700",
  Canon_6D: "Canon 6D",
  Canon_60D: "Canon 60D",
  iPhone: "iPhone",
  Samsung_Note8: "Samsung Note8",
};

export function deviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}

/** Device accent colors for chips and charts */
export const DEVICE_COLORS: Record<string, string> = {
  SonyA6700: "#6c8cff",
  Canon6D: "#f0b23a",
  Canon60D: "#f09a3a",
  IPhone: "#3dd68c",
  SamsungNote8: "#a78bfa",
  Unknown: "#565e80",
  Sony_a6700: "#6c8cff",
  Canon_6D: "#f0b23a",
  Canon_60D: "#f09a3a",
  iPhone: "#3dd68c",
  Samsung_Note8: "#a78bfa",
};

export function deviceColor(device: string): string {
  return DEVICE_COLORS[device] ?? "#565e80";
}

const DEVICE_FOLDER_SEGMENTS: Record<string, string> = {
  SonyA6700: "Sony_a6700",
  Canon6D: "Canon_6D",
  Canon60D: "Canon_60D",
  IPhone: "iPhone",
  SamsungNote8: "Samsung_Note8",
  Unknown: "Unknown_Device",
  Sony_a6700: "Sony_a6700",
  Canon_6D: "Canon_6D",
  Canon_60D: "Canon_60D",
  iPhone: "iPhone",
  Samsung_Note8: "Samsung_Note8",
};

export function deviceFolderSegment(device: string): string {
  return DEVICE_FOLDER_SEGMENTS[device] ?? "Unknown_Device";
}

/** Format bytes to KB / MB / GB / TB */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1e6) return `${(bytes / 1e3).toFixed(0)} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes < 1e12) return `${(bytes / 1e9).toFixed(2)} GB`;
  return `${(bytes / 1e12).toFixed(2)} TB`;
}
