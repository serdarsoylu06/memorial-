/**
 * Format bytes to a human-readable string (KB, MB, GB, TB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

/**
 * Format an ISO date string to a localised display string.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format an ISO date string to a short date+time string.
 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Return a human-readable label for a confidence level (Turkish).
 */
export function confidenceLabel(level: string): string {
  switch (level.toLowerCase()) {
    case "high":
      return "Yüksek";
    case "medium":
      return "Orta";
    case "low":
      return "Düşük";
    default:
      return "Sinyal yok";
  }
}

/**
 * Format a session's date span: one date, or "start – end" when it covers several days.
 */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Tarih bilinmiyor";
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/**
 * Describe a file count by kind, e.g. "42 dosya: 38 fotoğraf, 4 video".
 */
export function formatFileCounts(files: { kind: string }[]): string {
  const n = (v: number) => v.toLocaleString("tr-TR");
  const photos = files.filter((f) => f.kind === "photo").length;
  const videos = files.filter((f) => f.kind === "video").length;
  const parts: string[] = [];
  if (photos > 0) parts.push(`${n(photos)} fotoğraf`);
  if (videos > 0) parts.push(`${n(videos)} video`);
  if (parts.length === 0 || (parts.length === 1 && photos + videos === files.length)) {
    return parts[0] ?? `${n(files.length)} dosya`;
  }
  return `${n(files.length)} dosya: ${parts.join(", ")}`;
}
