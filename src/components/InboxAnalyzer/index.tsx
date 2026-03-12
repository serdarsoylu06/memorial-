import { useEffect } from "react";
import { useInboxStore } from "../../store/useInboxStore";
import { useInboxScan } from "../../hooks/useInboxScan";
import SessionCard from "./SessionCard";
import BatchActions from "./BatchActions";
import { RefreshCw } from "lucide-react";

export default function InboxAnalyzer() {
  const { scanResult, isScanning } = useInboxStore();
  const { scan } = useInboxScan();

  useEffect(() => {
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e8eaf0]">INBOX Analizi</h2>
          <p className="text-xs text-[#8b92a9] mt-0.5">
            {scanResult
              ? `${scanResult.total_files} dosya · ${scanResult.sessions.length} oturum tespit edildi`
              : "Tarama bekleniyor…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={isScanning}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] hover:text-[#e8eaf0] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
          Yeniden Tara
        </button>
      </div>

      {/* Batch actions */}
      {(scanResult?.sessions.length ?? 0) > 0 && <BatchActions />}

      {/* Sessions */}
      {isScanning && (
        <div className="text-center py-12 text-sm text-[#8b92a9]">Taranıyor…</div>
      )}
      {!isScanning && (scanResult?.sessions.length ?? 0) === 0 && (
        <div className="text-center py-12 text-sm text-[#8b92a9]">
          INBOX boş ya da HDD bağlı değil.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {scanResult?.sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
