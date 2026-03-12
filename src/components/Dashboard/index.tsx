import StatsCard from "./StatsCard";
import RecentSessions from "./RecentSessions";
import { useAppStore } from "../../store/useAppStore";
import { useInboxStore } from "../../store/useInboxStore";
import { HardDrive, CheckCircle, XCircle } from "lucide-react";

export default function Dashboard() {
  const { hddStatus, recentLogs } = useAppStore();
  const { scanResult } = useInboxStore();

  return (
    <div className="space-y-6">
      {/* HDD Status Banner */}
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${
          hddStatus.connected
            ? "bg-[#4caf82]/10 border-[#4caf82]/30"
            : "bg-[#e05252]/10 border-[#e05252]/30"
        }`}
      >
        <HardDrive
          size={18}
          className={hddStatus.connected ? "text-[#4caf82]" : "text-[#e05252]"}
        />
        {hddStatus.connected ? (
          <CheckCircle size={16} className="text-[#4caf82]" />
        ) : (
          <XCircle size={16} className="text-[#e05252]" />
        )}
        <span className="text-sm">
          {hddStatus.connected
            ? `HDD bağlı: ${hddStatus.path}`
            : "HDD bağlı değil. Ayarlar'dan yolu yapılandırın."}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="INBOX"
          value={scanResult?.total_files ?? 0}
          sub="bekleyen dosya"
          color="#6c8cff"
        />
        <StatsCard
          label="Oturum"
          value={scanResult?.sessions.length ?? 0}
          sub="tespit edildi"
          color="#6c8cff"
        />
        <StatsCard
          label="REVIEW"
          value={scanResult?.unclassified.length ?? 0}
          sub="belirsiz dosya"
          color="#f0a830"
        />
        <StatsCard
          label="İşlem"
          value={recentLogs.reduce((acc, l) => acc + l.operations, 0)}
          sub="toplam işlem"
          color="#4caf82"
        />
      </div>

      {/* Recent Sessions */}
      <RecentSessions sessions={recentLogs} />
    </div>
  );
}
