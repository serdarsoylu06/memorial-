import type { Session } from "../../types";
import { useInboxStore } from "../../store/useInboxStore";
import { confidenceColor, confidenceLabel, formatDate } from "../../utils/formatters";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SessionCardProps {
  session: Session;
}

export default function SessionCard({ session }: SessionCardProps) {
  const { approvedSessions, rejectedSessions, approveSession, rejectSession } = useInboxStore();
  const navigate = useNavigate();

  const isApproved = approvedSessions.includes(session.id);
  const isRejected = rejectedSessions.includes(session.id);

  return (
    <div
      className={`bg-[#1a1d27] border rounded-xl p-5 transition-colors ${
        isApproved
          ? "border-[#4caf82]/50"
          : isRejected
          ? "border-[#e05252]/30 opacity-60"
          : "border-[#2e3347]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-[#e8eaf0] truncate max-w-xs">
            {session.suggested_path || "Yol hesaplanıyor…"}
          </p>
          <p className="text-xs text-[#8b92a9] mt-0.5">
            {formatDate(session.date_start)}
            {session.date_end && session.date_end !== session.date_start
              ? ` – ${formatDate(session.date_end)}`
              : ""}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColor(session.confidence)}`}
        >
          {confidenceLabel(session.confidence)}
        </span>
      </div>

      {/* Devices + file count */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {session.devices.map((d) => (
          <span key={d} className="text-xs bg-[#242736] text-[#8b92a9] px-2 py-0.5 rounded">
            {d}
          </span>
        ))}
        <span className="text-xs text-[#8b92a9] ml-auto">{session.files.length} dosya</span>
      </div>

      {/* Thumbnail placeholder grid */}
      <div className="grid grid-cols-4 gap-1 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square bg-[#242736] rounded overflow-hidden">
            {session.files[i]?.thumbnail ? (
              <img
                src={session.files[i].thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => approveSession(session.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-[#4caf82]/10 text-[#4caf82] hover:bg-[#4caf82]/20 transition-colors"
        >
          <CheckCircle size={14} />
          Onayla
        </button>
        <button
          type="button"
          onClick={() => navigate(`/session/${session.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] hover:text-[#e8eaf0] transition-colors"
        >
          <Eye size={14} />
          Detay
        </button>
        <button
          type="button"
          onClick={() => rejectSession(session.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-[#e05252]/10 text-[#e05252] hover:bg-[#e05252]/20 transition-colors"
        >
          <XCircle size={14} />
          Reddet
        </button>
      </div>
    </div>
  );
}
