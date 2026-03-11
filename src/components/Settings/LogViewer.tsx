import { useAppStore } from "../../store/useAppStore";
import { formatDateTime } from "../../utils/formatters";

export default function LogViewer() {
  const { recentLogs } = useAppStore();

  return (
    <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
      <p className="text-sm font-semibold text-[#e8eaf0] mb-4">Oturum Günlüğü</p>
      {recentLogs.length === 0 ? (
        <p className="text-xs text-[#8b92a9]">Henüz günlük yok.</p>
      ) : (
        <div className="space-y-2 font-mono text-xs text-[#8b92a9]">
          {recentLogs.map((log) => (
            <div key={log.id} className="bg-[#242736] rounded-lg px-3 py-2">
              <span className="text-[#6c8cff]">[{formatDateTime(log.date)}]</span>{" "}
              {log.operations} işlem · {log.files_moved} taşındı · {log.files_copied} kopyalandı
              {log.errors > 0 && <span className="text-[#e05252]"> · {log.errors} hata</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
