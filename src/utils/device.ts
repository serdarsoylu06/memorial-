/** Map device key names (from YAML) to human-readable display names */
export const DEVICE_LABELS: Record<string, string> = {
  Sony_a6700: "Sony α6700",
  Canon_6D: "Canon 6D",
  Canon_60D: "Canon 60D",
  iPhone: "iPhone",
  Samsung_Note8: "Samsung Note8",
  Unknown_Device: "Bilinmeyen cihaz",
  Unknown: "Bilinmeyen cihaz",
};

export function deviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}

export function deviceFolderSegment(device: string): string {
  // Device key IS the folder segment now (e.g. "Sony_a6700", "iPhone")
  return device || "Unknown_Device";
}

/** Format bytes to KB / MB / GB / TB (decimal units, Turkish number format). */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "—";
  const fmt = (value: number, digits: number) =>
    value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
  if (bytes < 1e6) return `${fmt(bytes / 1e3, 0)} KB`;
  if (bytes < 1e9) return `${fmt(bytes / 1e6, 1)} MB`;
  if (bytes < 1e12) return `${fmt(bytes / 1e9, 1)} GB`;
  return `${fmt(bytes / 1e12, 2)} TB`;
}

/** List the devices of a session in a sentence-friendly form. */
export function deviceList(devices: string[]): string {
  const names = devices.map(deviceLabel);
  if (names.length === 0) return "Cihaz bilinmiyor";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}`;
}
