import type { Session } from "../types";
import { parseTimestamp } from "./formatters";

const DAY_MS = 86_400_000;
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export { MONTHS_SHORT };

// Çekim saatleri duvar saatidir ve UTC olarak taşınır; bu dosyadaki bütün
// hesaplar ve gösterimler bu yüzden UTC üzerinden yapılır.

function parse(iso: string | null | undefined): number | null {
  return parseTimestamp(iso)?.getTime() ?? null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
  );
}

function dayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export interface Ribbon {
  /** Çizgilerin şerit üzerindeki konumu, yüzde olarak (0–100), tekrarsız. */
  ticks: number[];
  /** Eksenin başı, ortası ve sonu için etiketler. */
  axis: [string, string, string];
  /** Çekim saati bilinen dosya sayısı. */
  timed: number;
}

/**
 * Bir oturumun dosyalarını, çekildikleri ana göre bir şeride yerleştirir.
 * Çekim saati olmayan dosyalar şeride girmez. Çok dosyalı oturumlarda
 * çizgi sayısı `resolution` ile sınırlanır (aynı noktaya düşenler birleşir).
 */
export function buildRibbon(files: { created_at: string | null }[], resolution = 240): Ribbon | null {
  const times = files.map((f) => parse(f.created_at)).filter((t): t is number => t !== null);
  if (times.length === 0) return null;

  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;
  const start = new Date(min);
  const end = new Date(max);

  // Tek güne sığan oturumda eksen günün saatleridir; yoksa çekimin ilk ve son günü.
  let from: number;
  let to: number;
  let axis: [string, string, string];
  if (sameDay(start, end)) {
    const pad = Math.max(span * 0.04, 15 * 60_000);
    from = min - pad;
    to = max + pad;
    const clock = (t: number) =>
      new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    axis = [clock(from), clock((from + to) / 2), clock(to)];
  } else {
    from = dayStart(start);
    to = dayStart(end) + DAY_MS;
    const day = (t: number) =>
      new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
    axis = [day(from), day((from + to - DAY_MS) / 2), day(to - DAY_MS)];
  }

  const width = to - from;
  const slots = new Set<number>();
  for (const t of times) {
    slots.add(Math.round(((t - from) / width) * resolution));
  }
  const ticks = Array.from(slots)
    .sort((a, b) => a - b)
    .map((slot) => (slot / resolution) * 100);

  return { ticks, axis, timed: times.length };
}

/** Oturumun tarih bloğu: büyük yazılan gün ("14 Haz", "3–9 Haz") ve altındaki satır. */
export function sessionDayLabel(session: Pick<Session, "date_start" | "date_end">): { main: string; sub: string } {
  const startT = parse(session.date_start);
  if (startT === null) return { main: "Tarihsiz", sub: "Çekim tarihi bilinmiyor" };
  const start = new Date(startT);
  const end = new Date(parse(session.date_end) ?? startT);
  const month = (d: Date) => MONTHS_SHORT[d.getUTCMonth()];

  if (sameDay(start, end)) {
    const weekday = start.toLocaleDateString("tr-TR", { weekday: "long", timeZone: "UTC" });
    return { main: `${start.getUTCDate()} ${month(start)}`, sub: `${start.getUTCFullYear()}, ${weekday}` };
  }

  const days = Math.round((dayStart(end) - dayStart(start)) / DAY_MS) + 1;
  const main =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()
      ? `${start.getUTCDate()}–${end.getUTCDate()} ${month(start)}`
      : `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)}`;
  return { main, sub: `${start.getUTCFullYear()}, ${days} gün` };
}

export interface YearSpan {
  id: string;
  label: string;
  /** Yıl içindeki konum ve genişlik, yüzde olarak. */
  left: number;
  width: number;
}

/** Oturumları yıllara ayırır ve her birinin yıl içindeki yerini hesaplar (yeni yıl önce). */
export function groupByYear(
  sessions: Pick<Session, "id" | "date_start" | "date_end" | "suggested_path">[]
): { year: number; spans: YearSpan[] }[] {
  const years = new Map<number, YearSpan[]>();
  for (const s of sessions) {
    const startT = parse(s.date_start);
    if (startT === null) continue;
    const endT = Math.max(parse(s.date_end) ?? startT, startT);
    const year = new Date(startT).getUTCFullYear();
    const yearStart = Date.UTC(year, 0, 1);
    const yearLength = Date.UTC(year + 1, 0, 1) - yearStart;
    const left = ((startT - yearStart) / yearLength) * 100;
    // En kısa oturum bile seçilebilecek kadar geniş çizilir.
    const width = Math.max(((Math.min(endT, yearStart + yearLength) - startT) / yearLength) * 100, 0.6);
    const list = years.get(year) ?? [];
    list.push({
      id: s.id,
      label: s.suggested_path.split("/").filter(Boolean).pop() ?? s.suggested_path,
      left: Math.min(left, 100 - width),
      width,
    });
    years.set(year, list);
  }
  return Array.from(years.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, spans]) => ({ year, spans }));
}
