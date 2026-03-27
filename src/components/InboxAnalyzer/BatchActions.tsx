import { useInboxStore } from "../../store/useInboxStore";
import { CheckCircle } from "lucide-react";

export default function BatchActions() {
  const { scanResult, approvedSessions, approveSession, resetApprovals } = useInboxStore();

  const sessions = scanResult?.sessions ?? [];
  const highConfidenceSessions = sessions.filter((s) => s.confidence === "high");
  const approvedCount = approvedSessions.length;

  return (
    <div className="flex items-center justify-between p-4 bg-[#1a1d27] border border-[#2e3347] rounded-xl">
      <p className="text-sm text-[#8b92a9]">
        <span className="text-[#e8eaf0] font-medium">{approvedCount}</span> / {sessions.length} oturum onaylandı
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetApprovals}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] hover:text-[#e8eaf0] transition-colors"
        >
          Sıfırla
        </button>
        <button
          type="button"
          onClick={() => highConfidenceSessions.forEach((s) => approveSession(s.id))}
          disabled={highConfidenceSessions.length === 0}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#4caf82]/10 text-[#4caf82] hover:bg-[#4caf82]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle size={13} />
          Tümünü Onayla ({highConfidenceSessions.length} yüksek güven)
        </button>
      </div>
    </div>
  );
}
