import type { SessionLog } from "../../types";
import { formatDateTime } from "../../utils/formatters";

interface RecentSessionsProps {
  sessions: SessionLog[];
}

export default function RecentSessions({ sessions }: RecentSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
        <p className="text-sm font-medium text-[#e8eaf0] mb-4">Son Oturumlar</p>
        <p className="text-sm text-[#8b92a9]">Henüz oturum yok.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
      <p className="text-sm font-medium text-[#e8eaf0] mb-4">Son Oturumlar</p>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2 border-b border-[#2e3347] last:border-0">
            <div>
              <p className="text-xs font-medium text-[#e8eaf0]">{formatDateTime(s.date)}</p>
              <p className="text-xs text-[#8b92a9]">
                {s.files_moved} taşındı · {s.files_copied} kopyalandı
                {s.errors > 0 && (
                  <span className="text-[#e05252] ml-1">· {s.errors} hata</span>
                )}
              </p>
            </div>
            <span className="text-xs text-[#8b92a9]">{s.operations} işlem</span>
          </div>
        ))}
      </div>
    </div>
  );
}
