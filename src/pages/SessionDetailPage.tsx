import { useParams, useNavigate } from "react-router-dom";
import { useInboxStore } from "../store/useInboxStore";
import SessionDetail from "../components/SessionDetail";
import { ArrowLeft } from "lucide-react";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scanResult } = useInboxStore();

  const session = scanResult?.sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-[#8b92a9]">Oturum bulunamadı.</p>
        <button
          type="button"
          onClick={() => navigate("/inbox")}
          className="mt-4 text-xs text-[#6c8cff] hover:underline"
        >
          INBOX'a dön
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate("/inbox")}
        className="flex items-center gap-1.5 text-xs text-[#8b92a9] hover:text-[#e8eaf0] transition-colors"
      >
        <ArrowLeft size={13} />
        INBOX'a dön
      </button>
      <SessionDetail session={session} />
    </div>
  );
}
