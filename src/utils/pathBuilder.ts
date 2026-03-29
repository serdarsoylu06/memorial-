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
 * Build the EDITS path for edited exports.
 *
 * Structure: EDITS/YYYY/YYYY-MM-DD_EventName/{Photos|Videos}/
 */
export function buildEditsPath(opts: {
  hddRoot: string;
  year: string;
  month: string;
  day: string;
  eventName: string;
  isVideo: boolean;
}): string {
  const { hddRoot, year, month, day, eventName, isVideo } = opts;
  const mediaFolder = isVideo ? "Videos" : "Photos";
  return `${hddRoot}/EDITS/${year}/${year}-${month}-${day}_${eventName}/${mediaFolder}/`;
}

/**
 * Build the _source.json path inside an EDITS event folder.
 */
export function buildSourceJsonPath(opts: {
  hddRoot: string;
  year: string;
  month: string;
  day: string;
  eventName: string;
}): string {
  const { hddRoot, year, month, day, eventName } = opts;
  return `${hddRoot}/EDITS/${year}/${year}-${month}-${day}_${eventName}/_source.json`;
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
