import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import {
  HardDrive, Inbox, AlertCircle, Archive,
  Camera, Film, FolderOpen, RefreshCw, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { useInboxStore } from "../../store/useInboxStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import { useInboxScan } from "../../hooks/useInboxScan";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";

import type { ArchiveStats } from "../../types";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(2)} TB`;
}

function HDDBanner() {
  const hdd = useHDDStatus();
  const { settings } = useAppStore();
  const navigate = useNavigate();
  const used = hdd.total_bytes && hdd.free_bytes
    ? hdd.total_bytes - hdd.free_bytes
    : null;
  const pct = hdd.total_bytes && used ? (used / hdd.total_bytes) * 100 : null;

  return (
    <Card padded={false} className="p-4 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${hdd.connected ? "bg-[rgba(61,214,140,0.15)]" : "bg-[rgba(136,144,180,0.1)]"}`}>
        <HardDrive size={18} className={hdd.connected ? "text-[#3dd68c]" : "text-[#565e80]"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#e8eaf6]">
          {hdd.connected ? (hdd.label ?? "HDD Bağlı") : "HDD Bağlı Değil"}
        </p>
        <p className="text-xs text-[#565e80] mt-0.5 truncate">
          {hdd.connected
            ? `${formatBytes(used)} kullanıldı / ${formatBytes(hdd.total_bytes)} toplam`
            : settings.hdd_root
            ? "Sürücü şu an bağlı değil"
            : "Ayarlar'dan HDD yolu seçin"}
        </p>
        {pct !== null && (
          <div className="mt-1.5 w-full h-1 bg-[#1a1d2e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct > 90 ? "#e05252" : pct > 70 ? "#f0b23a" : "#6c8cff",
              }}
            />
          </div>
        )}
      </div>
      {!hdd.connected && (
        <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
          Ayarlar <ArrowRight size={13} />
        </Button>
      )}
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = "#6c8cff",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-semibold text-[#e8eaf6]">{value}</p>
        <p className="text-xs text-[#565e80] mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { settings } = useAppStore();
  const { scanResult } = useInboxStore();
  const hdd = useHDDStatus();
  const { scan } = useInboxScan();
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hdd.connected || !settings.hdd_root) return;
    setStatsLoading(true);
    invoke<ArchiveStats>("get_archive_stats", {
      archivePath: `${settings.hdd_root}/${settings.archive_dir}`,
    })
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [hdd.connected, settings.hdd_root, settings.archive_dir]);

  const inboxCount = scanResult?.total_files ?? 0;
  const reviewCount = scanResult?.unclassified?.length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf6]">Dashboard</h1>
          <p className="text-sm text-[#565e80] mt-0.5">Arşivinize genel bakış</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={() => void scan()}
          disabled={!hdd.connected}
        >
          INBOX Tara
        </Button>
      </div>

      {/* HDD Banner */}
      <HDDBanner />

      {/* Quick badges */}
      {(inboxCount > 0 || reviewCount > 0) && (
        <div className="flex gap-3">
          {inboxCount > 0 && (
            <button
              onClick={() => navigate("/inbox")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(108,140,255,0.08)] border border-[rgba(108,140,255,0.18)] hover:border-[#6c8cff] transition-colors text-sm"
            >
              <Inbox size={14} className="text-[#6c8cff]" />
              <span className="text-[#e8eaf6] font-medium">{inboxCount}</span>
              <span className="text-[#565e80]">INBOX dosyası</span>
            </button>
          )}
          {reviewCount > 0 && (
            <button
              onClick={() => navigate("/review")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(240,178,58,0.08)] border border-[rgba(240,178,58,0.18)] hover:border-[#f0b23a] transition-colors text-sm"
            >
              <AlertCircle size={14} className="text-[#f0b23a]" />
              <span className="text-[#e8eaf6] font-medium">{reviewCount}</span>
              <span className="text-[#565e80]">inceleme bekliyor</span>
            </button>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass p-5 space-y-3">
              <div className="w-9 h-9 skeleton rounded-lg" />
              <div className="w-16 h-7 skeleton rounded" />
              <div className="w-24 h-3 skeleton rounded" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={<Camera size={18} />}
              label="Toplam Fotoğraf"
              value={stats?.total_photos?.toLocaleString() ?? "—"}
              color="#6c8cff"
            />
            <StatCard
              icon={<Film size={18} />}
              label="Toplam Video"
              value={stats?.total_videos?.toLocaleString() ?? "—"}
              color="#a78bfa"
            />
            <StatCard
              icon={<Archive size={18} />}
              label="Arşiv Boyutu"
              value={formatBytes(stats?.total_size_bytes ?? null)}
              color="#3dd68c"
            />
            <StatCard
              icon={<FolderOpen size={18} />}
              label="Oturum Sayısı"
              value={stats?.folder_count?.toLocaleString() ?? "—"}
              color="#f0b23a"
            />
          </>
        )}
      </div>

      {/* Sessions quick view */}
      {scanResult && scanResult.sessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[#8890b4]">Son Tarama — Tespit Edilen Oturumlar</h2>
            <button
              onClick={() => navigate("/inbox")}
              className="text-xs text-[#6c8cff] hover:underline"
            >
              Tümünü gör →
            </button>
          </div>
          <div className="space-y-2">
            {scanResult.sessions.slice(0, 5).map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/session/${session.id}`)}
                className="w-full text-left glass p-3 hover:border-[#363b60] transition-all flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e8eaf6] truncate">{session.suggested_path}</p>
                  <p className="text-xs text-[#565e80] mt-0.5">
                    {session.files.length} dosya · {session.devices.join(", ")}
                  </p>
                </div>
                <Badge
                  tone={session.confidence === "high" ? "success" : session.confidence === "medium" ? "warning" : "danger"}
                  dot
                >
                  {session.confidence}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {!hdd.connected && (
        <Card className="flex flex-col items-center py-12 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(136,144,180,0.08)] flex items-center justify-center">
            <HardDrive size={28} className="text-[#363b60]" />
          </div>
          <div>
            <p className="text-[#8890b4] font-medium">HDD bağlı değil</p>
            <p className="text-sm text-[#565e80] mt-1">Ayarlar'dan HDD kök yolunu seçin</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate("/settings")}>
            Ayarlara Git
          </Button>
        </Card>
      )}
    </div>
  );
}
