import { confidenceLabel } from "../../utils/formatters";

const LEVELS: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Güven skoru, renk yerine dolulukla okunur: üç basamak ve yanında kelime.
 */
export default function ConfidenceMeter({ level, className = "" }: { level: string; className?: string }) {
  const filled = LEVELS[level.toLowerCase()] ?? 0;
  const label = confidenceLabel(level);

  return (
    <span
      className={`inline-flex items-center gap-2 text-[13px] whitespace-nowrap ${filled >= 2 ? "text-paper" : "text-dim"} ${className}`}
    >
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`w-[5px] h-3.5 rounded-[1px] ${step <= filled ? "bg-paper" : "border border-edge-strong"}`}
          />
        ))}
      </span>
      <span>
        <span className="sr-only">Güven: </span>
        {label}
      </span>
    </span>
  );
}
