import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Pencil } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useInboxStore } from "../../store/useInboxStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import { useInboxScan } from "../../hooks/useInboxScan";
import Button from "../ui/Button";
import ConfidenceMeter from "../ui/ConfidenceMeter";
import TimeRibbon, { YearRibbons } from "../ui/TimeRibbon";
import ProgressBar from "../ui/ProgressBar";
import OperationProgress from "../ui/OperationProgress";
import { Notice, PageHeader, PathText, inputClass } from "../ui/Page";
import type { AppSettings, FileOpResult, MediaFolderHint, Session } from "../../types";
import { destinationDir, deviceList } from "../../utils/device";
import { formatFileCounts } from "../../utils/formatters";
import { sessionDayLabel } from "../../utils/timeline";

const n = (value: number) => value.toLocaleString("tr-TR");

/** Bir oturumun dosyaları (ve yan dosyaları) için kaynak → hedef çiftleri. */
function buildCopyPairs(settings: AppSettings, targetPath: string, session: Session): [string, string][] {
  const pairs: [string, string][] = [];
  for (const f of session.files) {
    const destDir = destinationDir(settings.hdd_root, targetPath, f);
    pairs.push([f.path, `${destDir}/${f.filename}`]);
    // Yan dosyalar (.aae, .xmp, .thm) asıl dosyayla birlikte gider
    if (f.sidecars?.length) {
      for (const sc of f.sidecars) {
        const scName = sc.split("/").pop() ?? sc.split("\\").pop() ?? sc;
        pairs.push([sc, `${destDir}/${scName}`]);
      }
    }
  }
  return pairs;
}

/** Önce deneme (ayar açıksa), sonra gerçek kopyalama. Hata varsa Error fırlatır. */
async function copySession(settings: AppSettings, pairs: [string, string][]): Promise<FileOpResult> {
  if (settings.operations.dry_run_first) {
    const preview = await invoke<FileOpResult>("copy_files", { files: pairs, dryRun: true });
    if (!preview.success) {
      throw new Error(`Ön kontrol ${preview.failed.length} dosyada takıldı; hiçbir dosya kopyalanmadı.`);
    }
  }
  const result = await invoke<FileOpResult>("copy_files", { files: pairs, dryRun: false });
  if (!result.success) {
    throw new Error(`${result.failed.length} dosya kopyalanamadı.`);
  }
  return result;
}

function PathEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Hedef klasör"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${inputClass} w-full font-mono text-[15px] h-9`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Hedef klasörü düzenle"
      className="group flex items-center gap-2 max-w-full text-left text-[15px] bg-transparent border-0 p-0"
    >
      <PathText path={value} className="truncate" />
      <Pencil size={13} className="shrink-0 text-faint group-hover:text-paper" aria-hidden />
    </button>
  );
}

function SessionRow({
  session,
  onOperationStart,
  onOperationEnd,
}: {
  session: Session;
  onOperationStart: () => void;
  onOperationEnd: () => void;
}) {
  const { approveSession, rejectSession, approvedSessions, rejectedSessions } = useInboxStore();
  const { settings } = useAppStore();
  const navigate = useNavigate();
  const [customPath, setCustomPath] = useState(session.suggested_path);
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isApproved = approvedSessions.has(session.id);
  const isRejected = rejectedSessions.has(session.id);

  const firstFile = session.files[0];
  const firstTarget = firstFile
    ? `${destinationDir(settings.hdd_root, customPath, firstFile)}/${firstFile.filename}`
    : null;

  const approve = async () => {
    if (!settings.hdd_root) return;
    setError(null);

    // Güvenlik: hedef, gelen klasörünün içinde olamaz
    const inboxDir = settings.inbox_dir;
    const inboxPath = inboxDir.startsWith("/")
      ? inboxDir
      : `${settings.hdd_root.replace(/\/$/, "")}/${inboxDir.replace(/^\//, "")}`;
    const destBase = `${settings.hdd_root.replace(/\/$/, "")}/${customPath}`;
    if (destBase.startsWith(inboxPath)) {
      setError("Hedef klasör, gelen klasörünün içinde olamaz. Yolu değiştirip yeniden deneyin.");
      return;
    }

    onOperationStart();
    try {
      const result = await copySession(settings, buildCopyPairs(settings, customPath, session));
      const folders = Array.from(
        new Set(result.moved.map((p) => p.replace(/[\\/][^\\/]+$/, "")).filter(Boolean))
      );
      setCreatedFolders(folders);
      approveSession(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    onOperationEnd();
  };

  const day = sessionDayLabel(session);

  return (
    <li
      id={`oturum-${session.id}`}
      className={`py-6 border-b border-edge last:border-b-0 scroll-mt-4 grid grid-cols-1 md:grid-cols-[112px_minmax(0,1fr)] xl:grid-cols-[112px_minmax(0,1fr)_250px] gap-x-7 gap-y-4 ${
        isRejected ? "opacity-50" : ""
      }`}
    >
      <div>
        <p className="display text-[30px] m-0 whitespace-nowrap">{day.main}</p>
        <p className="text-[13px] text-dim m-0 mt-1">{day.sub}</p>
      </div>

      <div className="min-w-0">
        {isApproved || isRejected ? (
          <PathText path={customPath} className="block truncate text-[15px]" />
        ) : (
          <PathEditor value={customPath} onChange={setCustomPath} />
        )}
        <p className="text-[13px] text-dim m-0 mt-1">
          {formatFileCounts(session.files)}. {deviceList(session.devices)} ile çekildi.
        </p>
        <TimeRibbon files={session.files} marked={isApproved} className="mt-3.5" />
        {!isApproved && !isRejected && firstTarget && (
          <p className="text-xs text-dim m-0 mt-3 truncate" title={firstTarget}>
            İlk dosyanın gideceği yer: <span className="font-mono">{firstTarget}</span>
          </p>
        )}
      </div>

      <div className="md:col-start-2 xl:col-start-3 flex flex-col gap-3">
        <div>
          <ConfidenceMeter level={session.confidence} />
          <p className="text-[13px] text-dim m-0 mt-1">
            {session.has_gps ? "Karelerde konum bilgisi var." : "Karelerde konum bilgisi yok."}
          </p>
        </div>

        {!isApproved && !isRejected && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void approve()}>
                Onayla ve kopyala
              </Button>
              <Button onClick={() => navigate(`/session/${session.id}`)}>Oturumu aç</Button>
              <Button variant="quiet" onClick={() => rejectSession(session.id)}>
                Reddet
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-stop m-0">
                {error}
              </p>
            )}
          </>
        )}

        {isApproved && (
          <div className="text-[13px]">
            <p className="m-0 font-medium">Kopyalandı</p>
            {createdFolders.slice(0, 3).map((folder) => (
              <p key={folder} className="font-mono text-xs text-dim break-all m-0 mt-0.5">
                {folder}
              </p>
            ))}
            {createdFolders.length > 3 && (
              <p className="text-xs text-dim m-0 mt-0.5">ve {createdFolders.length - 3} klasör daha</p>
            )}
          </div>
        )}

        {isRejected && <p className="m-0 text-[13px] text-dim">Reddedildi; dosyalar gelen klasöründe kaldı.</p>}
      </div>
    </li>
  );
}

export default function InboxAnalyzer() {
  const hdd = useHDDStatus();
  const { scan, isScanning } = useInboxScan();
  const { scanResult, scanError, approvedSessions, approveSession } = useInboxStore();
  const { settings, setSettings } = useAppStore();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [folderHints, setFolderHints] = useState<MediaFolderHint[]>([]);
  const [isOperating, setIsOperating] = useState(false);
  const [bulkFailures, setBulkFailures] = useState(0);
  const inboxPath = settings.inbox_dir.startsWith("/")
    ? settings.inbox_dir
    : `${settings.hdd_root.replace(/\/$/, "")}/${settings.inbox_dir.replace(/^\//, "")}`;

  // Disk bağlıysa açılışta kendiliğinden tara
  useEffect(() => {
    if (hdd.connected) {
      void scan();
    }
  }, [hdd.connected, scan]);

  // Tarama sürerken ilerleme çubuğunu oynat (arka uç gerçek yüzde bildirmiyor)
  useEffect(() => {
    if (!isScanning) {
      setProgress(0);
      return;
    }
    setProgress(5);
    const t = setInterval(() => setProgress((p) => Math.min(p + Math.random() * 8, 90)), 400);
    return () => clearInterval(t);
  }, [isScanning]);

  useEffect(() => {
    const loadHints = async () => {
      if (!hdd.connected || !scanResult || scanResult.total_files > 0 || !settings.hdd_root) {
        setFolderHints([]);
        return;
      }

      try {
        // ignoreDirs klasör adı bekler (tam yol değil); mutlak yolsa son parçayı al
        const inboxName = settings.inbox_dir.includes("/")
          ? settings.inbox_dir.replace(/\/$/, "").split("/").pop() ?? settings.inbox_dir
          : settings.inbox_dir;
        const hints = await invoke<MediaFolderHint[]>("get_media_folder_hints", {
          rootPath: settings.hdd_root,
          ignoreDirs: [inboxName, settings.archive_dir, settings.review_dir, settings.edits_dir, settings.staging_dir],
        });
        setFolderHints(hints);
      } catch {
        setFolderHints([]);
      }
    };

    void loadHints();
  }, [hdd.connected, scanResult, settings.hdd_root, settings.inbox_dir, settings.archive_dir, settings.review_dir, settings.edits_dir, settings.staging_dir]);

  const sessions = scanResult?.sessions ?? [];
  const unclassified = scanResult?.unclassified?.length ?? 0;
  const pendingHigh = sessions.filter(
    (s) => s.confidence.toLowerCase() === "high" && !approvedSessions.has(s.id)
  );

  const handleOperationStart = useCallback(() => setIsOperating(true), []);
  const handleOperationEnd = useCallback(() => setIsOperating(false), []);

  const bulkApprove = async () => {
    setIsOperating(true);
    setBulkFailures(0);
    let failures = 0;
    for (const session of pendingHigh) {
      try {
        await copySession(settings, buildCopyPairs(settings, session.suggested_path, session));
        approveSession(session.id);
      } catch (err) {
        console.error("Copy failed:", err);
        failures += 1;
      }
    }
    setBulkFailures(failures);
    setIsOperating(false);
  };

  let status: string;
  if (isScanning) status = "Gelen klasörü taranıyor";
  else if (scanResult)
    status = `${n(scanResult.total_files)} dosya, ${n(sessions.length)} oturum. Her çizgi bir dosyanın çekildiği anı gösterir.`;
  else status = "Henüz taranmadı.";

  return (
    <div className="space-y-6">
      <PageHeader title="Gelen" status={status}>
        {pendingHigh.length > 0 && (
          <Button variant="primary" onClick={() => void bulkApprove()} disabled={isOperating}>
            Yüksek güvenli {n(pendingHigh.length)} oturumu onayla ve kopyala
          </Button>
        )}
        <Button onClick={() => void scan()} disabled={!hdd.connected} loading={isScanning}>
          {isScanning ? "Taranıyor" : "Yeniden tara"}
        </Button>
      </PageHeader>

      {isScanning && <ProgressBar value={progress} label="Tarama ilerlemesi" />}

      {bulkFailures > 0 && (
        <Notice tone="stop" title={`${n(bulkFailures)} oturum kopyalanamadı`}>
          Bu oturumlar listede onaylanmamış olarak duruyor. Tek tek onaylayarak hangi dosyada takıldığını görebilirsiniz.
        </Notice>
      )}

      {unclassified > 0 && (
        <Notice
          title={`${n(unclassified)} dosya sınıflandırılamadı`}
          action={<Button onClick={() => navigate("/review")}>İncelemeye git</Button>}
        >
          Tarih, cihaz veya konum bilgisi yetersiz olduğu için bu dosyalar bir oturuma yerleştirilemedi.
        </Notice>
      )}

      {!hdd.connected && (
        <Notice
          title="Disk bağlı değil"
          action={!settings.hdd_root ? <Button onClick={() => navigate("/settings")}>Disk seç</Button> : undefined}
        >
          {settings.hdd_root
            ? "Diski takın; bağlandığında gelen klasörü kendiliğinden taranır."
            : "Taramak için önce Ayarlar'dan arşiv diskini seçin."}
        </Notice>
      )}

      {hdd.connected && scanError && (
        <Notice tone="stop" title="Tarama yapılamadı">
          <p className="m-0 break-all">{scanError}</p>
          <p className="m-0 mt-2">
            Beklenen gelen klasörü: <span className="font-mono">{inboxPath}</span>
          </p>
        </Notice>
      )}

      {hdd.connected && !isScanning && !scanResult && !scanError && (
        <Notice title="Gelen klasörü henüz taranmadı">Başlamak için "Yeniden tara" düğmesini kullanın.</Notice>
      )}

      {scanResult && sessions.length === 0 && !isScanning && folderHints.length === 0 && (
        <Notice title="Gelen klasörü boş">
          Yeni fotoğraf ve videoları <span className="font-mono">{inboxPath}</span> klasörüne kopyalayıp yeniden tarayın.
        </Notice>
      )}

      {scanResult && scanResult.total_files === 0 && folderHints.length > 0 && (
        <section>
          <Notice title="Gelen klasörü boş, ama diskin kökünde fotoğraf ve video var">
            Tarama yalnızca gelen klasörüne bakar. Aşağıdaki klasörlerden birini gelen klasörü olarak seçebilirsiniz.
          </Notice>
          <ul className="list-none m-0 mt-4 p-0 border-t border-edge">
            {folderHints.slice(0, 5).map((hint) => (
              <li key={hint.path} className="flex items-center justify-between gap-4 py-3 border-b border-edge">
                <div className="min-w-0">
                  <p className="m-0 font-medium truncate">{hint.name}</p>
                  <p className="m-0 font-mono text-xs text-dim truncate">{hint.path}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[13px] text-dim">{n(hint.media_count)} dosya</span>
                  <Button
                    onClick={() => {
                      setSettings({ inbox_dir: hint.path });
                      void scan(hint.path);
                    }}
                  >
                    Gelen klasörü yap
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sessions.length > 0 && <YearRibbons sessions={sessions} />}

      {sessions.length > 0 && (
        <ul className="list-none m-0 p-0">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onOperationStart={handleOperationStart}
              onOperationEnd={handleOperationEnd}
            />
          ))}
        </ul>
      )}

      <OperationProgress active={isOperating} onComplete={handleOperationEnd} />
    </div>
  );
}
