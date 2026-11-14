import type { MediaFile, Session } from "../../types";
import { buildRibbon, groupByYear, MONTHS_SHORT } from "../../utils/timeline";
import { GreaseMark } from "./ContactStrip";

/**
 * Bir oturumun zaman şeridi: her çizgi bir dosyanın çekildiği an.
 * Boşluklar çekime ara verildiğini, tek bir yığın ise saatin güvenilmez
 * olabileceğini gösterir. `marked` ise etrafına mumlu kalem halkası çizilir.
 */
export default function TimeRibbon({
  files,
  marked = false,
  className = "",
}: {
  files: MediaFile[];
  marked?: boolean;
  className?: string;
}) {
  const ribbon = buildRibbon(files);

  if (!ribbon) {
    return (
      <p className={`text-[13px] text-dim m-0 ${className}`}>
        Bu dosyaların çekim saati bilinmiyor; zaman şeridi çizilemedi.
      </p>
    );
  }

  const untimed = files.length - ribbon.timed;
  const label =
    `${ribbon.timed.toLocaleString("tr-TR")} dosyanın çekim anı, ${ribbon.axis[0]} ile ${ribbon.axis[2]} arasında` +
    (untimed > 0 ? `; ${untimed.toLocaleString("tr-TR")} dosyanın saati bilinmiyor` : "");

  return (
    <div className={className}>
      <div className="relative">
        <div role="img" aria-label={label} className="relative h-9 bg-table border border-edge rounded-[2px] overflow-hidden">
          {ribbon.ticks.map((left) => (
            <span key={left} className="absolute top-1 bottom-1 w-0.5 bg-trace" style={{ left: `${left}%` }} />
          ))}
        </div>
        {marked && <GreaseMark />}
      </div>
      <div className="flex justify-between mt-1 condensed text-xs text-dim" aria-hidden>
        <span>{ribbon.axis[0]}</span>
        <span>{ribbon.axis[1]}</span>
        <span>{ribbon.axis[2]}</span>
      </div>
    </div>
  );
}

/** Oturumların yıl içindeki yeri: her yıl için on iki aylık bir şerit. */
export function YearRibbons({ sessions }: { sessions: Session[] }) {
  const groups = groupByYear(sessions);
  if (groups.length === 0) return null;

  return (
    <section aria-label="Oturumların yıl içindeki yeri" className="bg-table border border-edge rounded-sm px-5 pt-4 pb-3 space-y-4">
      {groups.map(({ year, spans }) => (
        <div key={year}>
          <p className="m-0 mb-2 font-medium">
            {year} <span className="text-dim font-normal">yılında {spans.length.toLocaleString("tr-TR")} oturum</span>
          </p>
          <div className="relative h-5 bg-well rounded-[2px]">
            {spans.map((span) => (
              <a
                key={span.id}
                href={`#oturum-${span.id}`}
                title={span.label}
                aria-label={`${span.label} oturumuna git`}
                className="absolute inset-y-0 bg-trace hover:bg-paper rounded-[1px] min-w-1.5"
                style={{ left: `${span.left}%`, width: `${span.width}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-12 mt-1 condensed text-xs text-dim" aria-hidden>
            {MONTHS_SHORT.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
