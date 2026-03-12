import { useState } from "react";
import ComparisonView from "./ComparisonView";
import { useDuplicateCheck } from "../../hooks/useDuplicateCheck";
import type { DuplicatePair } from "../../types";

export default function DuplicateManager() {
  const { pairs, isChecking } = useDuplicateCheck();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentPair = pairs[currentIndex] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e8eaf0]">Kopya Yönetimi</h2>
          <p className="text-xs text-[#8b92a9] mt-0.5">
            {isChecking ? "Kontrol ediliyor…" : `${pairs.length} kopya çifti bulundu`}
          </p>
        </div>
        {pairs.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] disabled:opacity-50"
            >
              ← Önceki
            </button>
            <span className="text-xs px-3 py-1.5 text-[#8b92a9]">
              {currentIndex + 1} / {pairs.length}
            </span>
            <button
              type="button"
              disabled={currentIndex >= pairs.length - 1}
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] disabled:opacity-50"
            >
              Sonraki →
            </button>
          </div>
        )}
      </div>

      {isChecking && (
        <div className="text-center py-16 text-sm text-[#8b92a9]">Kontrol ediliyor…</div>
      )}
      {!isChecking && pairs.length === 0 && (
        <div className="text-center py-16 text-sm text-[#8b92a9]">Kopya bulunamadı. 🎉</div>
      )}
      {currentPair && (
        <ComparisonView
          pair={currentPair}
          onKeepOriginal={() => setCurrentIndex((i) => Math.min(i + 1, pairs.length - 1))}
          onKeepDuplicate={() => setCurrentIndex((i) => Math.min(i + 1, pairs.length - 1))}
        />
      )}
    </div>
  );
}
