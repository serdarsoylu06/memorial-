import type { Confidence } from "../../types";

interface ReviewFiltersProps {
  activeFilter: string;
  onFilterChange: (f: string) => void;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "no_exif", label: "EXIF Yok" },
  { key: "unknown_device", label: "Bilinmeyen Cihaz" },
  { key: "date_conflict", label: "Tarih Çakışması" },
  { key: "duplicate_suspect", label: "Kopya Şüphesi" },
];

export default function ReviewFilters({ activeFilter, onFilterChange }: ReviewFiltersProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onFilterChange(f.key)}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            activeFilter === f.key
              ? "bg-[#6c8cff]/15 text-[#6c8cff] font-medium"
              : "bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] hover:text-[#e8eaf0]"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
