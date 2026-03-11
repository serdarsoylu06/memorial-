import type { DuplicatePair } from "../../types";
import { formatBytes } from "../../utils/formatters";
import { Trash2, Check } from "lucide-react";

interface ComparisonViewProps {
  pair: DuplicatePair;
  onKeepOriginal: () => void;
  onKeepDuplicate: () => void;
}

export default function ComparisonView({ pair, onKeepOriginal, onKeepDuplicate }: ComparisonViewProps) {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl overflow-hidden">
      {/* Match info */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2e3347]">
        <span className="text-xs text-[#8b92a9]">
          Eşleşme türü:{" "}
          <span className="text-[#e8eaf0] font-medium">
            {pair.match_type === "exact" ? "Tam kopya (SHA256)" : "Görsel kopya (pHash)"}
          </span>
        </span>
        <span className="text-xs text-[#8b92a9]">
          Benzerlik: <span className="text-[#e8eaf0] font-medium">{(pair.similarity * 100).toFixed(0)}%</span>
        </span>
      </div>

      {/* Side-by-side */}
      <div className="grid grid-cols-2 gap-px bg-[#2e3347]">
        {[
          { label: "Orijinal", path: pair.original, onKeep: onKeepOriginal },
          { label: "Kopya", path: pair.duplicate, onKeep: onKeepDuplicate },
        ].map(({ label, path, onKeep }) => (
          <div key={label} className="bg-[#1a1d27] p-5 flex flex-col gap-3">
            <p className="text-xs font-medium text-[#8b92a9] uppercase tracking-wider">{label}</p>
            <div className="aspect-video bg-[#242736] rounded-lg flex items-center justify-center">
              <span className="text-xs text-[#8b92a9]">Önizleme yok</span>
            </div>
            <p className="text-xs text-[#e8eaf0] truncate" title={path}>{path.split("/").pop()}</p>
            <p className="text-xs text-[#8b92a9] truncate">{path}</p>
            <button
              type="button"
              onClick={onKeep}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-[#4caf82]/10 text-[#4caf82] hover:bg-[#4caf82]/20 transition-colors"
            >
              <Check size={13} />
              Bu dosyayı sakla
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
