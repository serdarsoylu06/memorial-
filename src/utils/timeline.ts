import type { Session } from "../types";

const DAY_MS = 86_400_000;
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export { MONTHS_SHORT };

function parse(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
      new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    axis = [clock(from), clock((from + to) / 2), clock(to)];
  } else {
    from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    to = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() + DAY_MS;
    const day = (t: number) => new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
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
  const month = (d: Date) => MONTHS_SHORT[d.getMonth()];

  if (sameDay(start, end)) {
    const weekday = start.toLocaleDateString("tr-TR", { weekday: "long" });
    return { main: `${start.getDate()} ${month(start)}`, sub: `${start.getFullYear()}, ${weekday}` };
  }

  const days =
    Math.round(
      (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
        new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) /
        DAY_MS
    ) + 1;
  const main =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
      ? `${start.getDate()}–${end.getDate()} ${month(start)}`
      : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
  return { main, sub: `${start.getFullYear()}, ${days} gün` };
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
    const year = new Date(startT).getFullYear();
    const yearStart = new Date(year, 0, 1).getTime();
    const yearLength = new Date(year + 1, 0, 1).getTime() - yearStart;
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
