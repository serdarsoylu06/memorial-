import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { useInboxStore } from "../../store/useInboxStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import { useInboxScan } from "../../hooks/useInboxScan";
import Button from "../ui/Button";
import ConfidenceMeter from "../ui/ConfidenceMeter";
import ContactStrip from "../ui/ContactStrip";
import { PathText } from "../ui/Page";
import { deviceList, formatBytes } from "../../utils/device";
import { formatDateRange, formatFileCounts } from "../../utils/formatters";
import type { ArchiveStats } from "../../types";

const n = (value: number) => value.toLocaleString("tr-TR");

export default function Dashboard() {
  const { settings } = useAppStore();
  const { scanResult, approvedSessions } = useInboxStore();
  const hdd = useHDDStatus();
  const { scan, isScanning } = useInboxScan();
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hdd.connected || !settings.hdd_root) {
      setStats(null);
      return;
    }
    invoke<ArchiveStats>("get_archive_stats", {
      archivePath: `${settings.hdd_root}/${settings.archive_dir}`,
    })
      .then(setStats)
      .catch(console.error);
  }, [hdd.connected, settings.hdd_root, settings.archive_dir]);

  const sessions = scanResult?.sessions ?? [];
  const inboxCount = scanResult?.total_files ?? 0;
  const reviewCount = scanResult?.unclassified?.length ?? 0;
  const highCount = sessions.filter((s) => s.confidence.toLowerCase() === "high").length;

  // Ekranın en üstünde tek bir cümle durur: şu an sizi ne bekliyor.
  let headline: string;
  let detail: string;
  if (!hdd.connected) {
    headline = settings.hdd_root ? "Disk bağlı değil" : "Önce arşiv diskini seçin";
    detail = settings.hdd_root
      ? "Diski takın; bağlandığında burası kendiliğinden güncellenir."
      : "Memorial, fotoğraf ve videoları seçtiğiniz diskteki arşive yerleştirir.";
  } else if (isScanning) {
    headline = "Gelen klasörü taranıyor";
    detail = "Dosyalar tarihe, cihaza ve konuma göre oturumlara ayrılıyor.";
  } else if (!scanResult) {
    headline = "Gelen klasörü henüz taranmadı";
    detail = "Tarama, yeni dosyaları oturumlara ayırır ve her biri için bir arşiv klasörü önerir.";
  } else if (inboxCount === 0) {
    headline = "Gelen klasörü boş";
    detail = "Dosyalanmayı bekleyen fotoğraf veya video yok.";
  } else {
    headline = `${n(inboxCount)} dosya dosyalanmayı bekliyor`;
    detail = `${n(sessions.length)} oturum bulundu. Yüksek güvenli oturum sayısı ${n(highCount)}.`;
  }

  return (
    <div className="space-y-10">
      <section className="pb-8 border-b border-edge">
        <h1 className="display text-[44px] m-0 max-w-[18ch]">{headline}</h1>
        <p className="text-dim mt-3 mb-0 max-w-[60ch] text-base">{detail}</p>
        <div className="flex items-center gap-2 mt-5">
          {!hdd.connected && !settings.hdd_root && (
            <Button variant="primary" size="md" onClick={() => navigate("/settings")}>
              Disk seç
            </Button>
          )}
          {hdd.connected && inboxCount > 0 && (
            <Button variant="primary" size="md" onClick={() => navigate("/inbox")}>
              Oturumları gözden geçir
            </Button>
          )}
          {hdd.connected && (
            <Button
              variant={inboxCount > 0 ? "secondary" : "primary"}
              size="md"
              loading={isScanning}
              onClick={() => void scan()}
            >
              {isScanning ? "Taranıyor" : scanResult ? "Yeniden tara" : "Gelen klasörünü tara"}
            </Button>
          )}
        </div>
      </section>

      {hdd.connected && stats && (
        <section aria-label="Arşiv özeti">
          <p className="m-0 max-w-[62ch] text-base">
            Arşivde <strong className="font-semibold">{n(stats.total_photos)} fotoğraf</strong> ve{" "}
            <strong className="font-semibold">{n(stats.total_videos)} video</strong> var.{" "}
            <span className="text-dim">
              {n(stats.folder_count)} klasörde {formatBytes(stats.total_size_bytes)} yer tutuyor.
            </span>
          </p>
          {reviewCount > 0 && (
            <p className="mt-2 mb-0">
              <Link to="/review" className="underline underline-offset-4 decoration-edge-strong hover:decoration-paper">
                {n(reviewCount)} dosya sınıflandırılamadı
              </Link>
              <span className="text-dim">; elle bakmanız gerekiyor.</span>
            </p>
          )}
        </section>
      )}

      {sessions.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="display text-xl m-0">Son taramada bulunan oturumlar</h2>
            {sessions.length > 5 && (
              <Link to="/inbox" className="text-[13px] text-dim underline underline-offset-4 hover:text-paper">
                {n(sessions.length)} oturumun hepsini gör
              </Link>
            )}
          </div>
          <ul className="list-none m-0 p-0">
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id} className="border-b border-edge last:border-b-0">
                <button
                  type="button"
                  onClick={() => navigate(`/session/${session.id}`)}
                  className="w-[calc(100%+1.5rem)] text-left py-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 hover:bg-table/50 -mx-3 px-3 rounded-sm transition-colors"
                >
                  <div className="min-w-0">
                    <PathText path={session.suggested_path} className="block truncate" />
                    <p className="text-[13px] text-dim m-0 mt-0.5 truncate">
                      {formatDateRange(session.date_start, session.date_end)}, {formatFileCounts(session.files)},{" "}
                      {deviceList(session.devices)}
                    </p>
                  </div>
                  <ConfidenceMeter level={session.confidence} className="self-start" />
                  <ContactStrip
                    files={session.files}
                    marked={approvedSessions.has(session.id)}
                    className="col-span-2"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
