import type { DeviceType } from "../types";

/**
 * Build the archive path for a set of files.
 *
 * Rules:
 *   - Everyday Giresun routine → ARCHIVE/YYYY/EVERYDAY/YYYY-MM/
 *   - Everyday high-volume     → ARCHIVE/YYYY/EVERYDAY/YYYY-MM-W1/
 *   - Named event              → ARCHIVE/YYYY/YYYY-MM-DD_EventName/
 *   - Unknown                  → REVIEW/
 */
export function buildArchivePath(opts: {
  hddRoot: string;
  year: string;
  month: string;
  day?: string;
  eventName?: string;
  isEveryday: boolean;
  week?: number;
  deviceType: DeviceType;
  isVideo: boolean;
}): string {
  const { hddRoot, year, month, day, eventName, isEveryday, week, deviceType, isVideo } = opts;
  const mediaFolder = isVideo ? "Videos" : "Photos";

  if (!isEveryday && day && eventName) {
    return `${hddRoot}/ARCHIVE/${year}/${year}-${month}-${day}_${eventName}/${mediaFolder}/${deviceType}/`;
  }

  if (isEveryday) {
    const subFolder = week !== undefined ? `${year}-${month}-W${week}` : `${year}-${month}`;
    return `${hddRoot}/ARCHIVE/${year}/EVERYDAY/${subFolder}/${mediaFolder}/${deviceType}/`;
  }

  return `${hddRoot}/REVIEW/`;
}

/**
 * Determine the ISO week number within the month (W1–W5).
 */
export function weekOfMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

/**
 * Parse a folder name like "2024-06-14_Kumbet-Yaylasi" into its components.
 */
export function parseFolderName(name: string): {
  date: string | null;
  eventName: string | null;
} {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
  if (match) {
    return { date: match[1], eventName: match[2] };
  }
  return { date: null, eventName: null };
}
