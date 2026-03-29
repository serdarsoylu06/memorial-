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
  return new Date(iso).toLocaleDateString("tr-TR", {
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
 * Return a badge colour class for a confidence level.
 */
export function confidenceColor(level: string): string {
  switch (level.toLowerCase()) {
    case "high":
      return "text-[#4caf82] bg-[#4caf82]/10";
    case "medium":
      return "text-[#f0a830] bg-[#f0a830]/10";
    case "low":
      return "text-[#e05252] bg-[#e05252]/10";
    default:
      return "text-[#8b92a9] bg-[#8b92a9]/10";
  }
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
      return "Sinyal Yok";
  }
}
