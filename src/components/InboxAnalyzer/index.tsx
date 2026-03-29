import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { ScanLine, CheckCheck, XCircle, Send, FolderEdit, Layers } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useInboxStore } from "../../store/useInboxStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import { useInboxScan } from "../../hooks/useInboxScan";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge, { confidenceTone } from "../ui/Badge";
import Spinner from "../ui/Spinner";
import ProgressBar from "../ui/ProgressBar";
import OperationProgress from "../ui/OperationProgress";
import type { FileOpResult, MediaFolderHint, Session } from "../../types";
import { deviceColor, deviceFolderSegment, deviceLabel } from "../../utils/device";

function DeviceChip({ device }: { device: string }) {
  const color = deviceColor(device);
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        color,
        background: `${color}18`,
        borderColor: `${color}30`,
      }}
    >
      {deviceLabel(device)}
    </span>
  );
}

function PathEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onChange(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onChange(draft); setEditing(false); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="flex-1 bg-[#0d0f18] border border-[#6c8cff] rounded px-2 py-1 text-xs text-[#e8eaf6] outline-none"
        />
      </div>
    );
  }
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="mt-1 text-xs text-[#565e80] font-mono hover:text-[#6c8cff] transition-colors truncate block max-w-full"
      title="Tıkla düzenle"
    >
      <FolderEdit size={11} className="inline mr-1 opacity-50" />
      {value || "—"}
    </button>
  );
}

function SessionCard({ session, onOperationStart, onOperationEnd }: { session: Session; onOperationStart: () => void; onOperationEnd: () => void }) {
  const { approveSession, rejectSession, approvedSessions, rejectedSessions } = useInboxStore();
  const { settings } = useAppStore();
  const navigate = useNavigate();
  const [customPath, setCustomPath] = useState(session.suggested_path);
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const isApproved = approvedSessions.has(session.id);
  const isRejected = rejectedSessions.has(session.id);

  const photoCount = session.files.filter((f) => f.kind === "photo").length;
  const videoCount = session.files.filter((f) => f.kind === "video").length;
  const previewTargets = session.files.slice(0, 3).map((f) =>
    `${settings.hdd_root}/${customPath}/${f.kind === "video" ? "Videos" : "Photos"}/${deviceFolderSegment(f.device)}/${f.filename}`
  );

  const approve = async () => {
    if (!settings.hdd_root) return;

    // Safeguard: destination must NOT be inside INBOX
    const inboxDir = settings.inbox_dir;
    const inboxPath = inboxDir.startsWith("/")
      ? inboxDir
      : `${settings.hdd_root.replace(/\/$/, "")}/${inboxDir.replace(/^\//, "")}`;
    const destBase = `${settings.hdd_root.replace(/\/$/, "")}/${customPath}`;
    if (destBase.startsWith(inboxPath)) {
      console.error("Hedef yol INBOX içinde olamaz:", destBase);
      return;
    }

    onOperationStart();
    const pairs = session.files.map((f) => [
      f.path,
      `${settings.hdd_root}/${customPath}/${f.kind === "video" ? "Videos" : "Photos"}/${deviceFolderSegment(f.device)}/${f.filename}`,
    ] as [string, string]);
    try {
      if (settings.operations.dry_run_first) {
        const preview = await invoke<FileOpResult>("copy_files", { files: pairs, dryRun: true });
        if (!preview.success) {
          console.error("Dry run failed:", preview.failed);
          onOperationEnd();
          return;
        }
      }

      const result = await invoke<FileOpResult>("copy_files", { files: pairs, dryRun: false });
      if (result.success) {
        const folders = Array.from(
          new Set(
            result.moved
              .map((p) => p.replace(/[\\/][^\\/]+$/, ""))
              .filter(Boolean)
          )
        );
        setCreatedFolders(folders);
        approveSession(session.id);
      } else {
        console.error("Copy failed:", result.failed);
      }
    } catch (err) {
      console.error("Copy failed:", err);
    }
    onOperationEnd();
  };

  return (
    <Card
      padded={false}
      hover
      className={`transition-all ${isApproved ? "border-[rgba(61,214,140,0.35)] bg-[rgba(61,214,140,0.03)]" : isRejected ? "border-[rgba(224,82,82,0.25)] opacity-60" : ""}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => navigate(`/session/${session.id}`)}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#565e80]">
                {session.date_start?.slice(0, 10) ?? "—"}
                {session.date_end && session.date_end !== session.date_start
                  ? ` → ${session.date_end.slice(0, 10)}`
                  : ""}
              </span>
              <Badge tone={confidenceTone(session.confidence)} dot>
                {session.confidence}
              </Badge>
              {session.has_gps && (
                <Badge tone="accent">GPS</Badge>
              )}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {session.devices.map((d) => <DeviceChip key={d} device={d} />)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold text-[#e8eaf6]">{session.files.length}</p>
            <p className="text-xs text-[#565e80]">dosya</p>
          </div>
        </div>

        {/* File type row */}
        <div className="flex gap-3 mt-2 text-xs text-[#565e80]">
          {photoCount > 0 && <span>📷 {photoCount}</span>}
          {videoCount > 0 && <span>🎬 {videoCount}</span>}
        </div>

        {/* Suggested path */}
        <PathEditor value={customPath} onChange={setCustomPath} />
        {previewTargets.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-[#8a91b1]">Ornek hedefler (ilk 3 dosya):</p>
            {previewTargets.map((target, idx) => (
              <p key={`${target}-${idx}`} className="text-[11px] text-[#7a82a3] font-mono truncate" title={target}>
                {idx + 1}. {target}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isApproved && !isRejected && (
        <div
          className="flex gap-2 px-4 pb-4 pt-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="success" size="sm" icon={<CheckCheck size={13} />} onClick={approve}>
            Onayla
          </Button>
          <Button variant="outline" size="sm" icon={<Send size={13} />} onClick={() => navigate(`/session/${session.id}`)}>
            Detay
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<XCircle size={13} />}
            onClick={() => rejectSession(session.id)}
          >
            Reddet
          </Button>
        </div>
      )}
      {isApproved && (
        <div className="px-4 pb-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-[#3dd68c]">
            <CheckCheck size={13} /> Onaylandı
          </div>
          {createdFolders.length > 0 && (
            <div className="rounded-md border border-[rgba(61,214,140,0.22)] bg-[rgba(61,214,140,0.08)] px-2 py-2">
              <p className="text-[11px] text-[#9dddbf] mb-1">Olusturulan klasorler:</p>
              {createdFolders.slice(0, 3).map((folder, idx) => (
                <p key={`${folder}-${idx}`} className="text-[11px] text-[#7fd0ab] font-mono truncate" title={folder}>
                  {idx + 1}. {folder}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      {isRejected && (
        <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-[#e05252]">
          <XCircle size={13} /> Reddedildi
        </div>
      )}
    </Card>
  );
}

export default function InboxAnalyzer() {
  const hdd = useHDDStatus();
  const { scan, isScanning } = useInboxScan();
  const { scanResult, scanError, approvedSessions, approveSession } = useInboxStore();
  const { settings, setSettings } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [folderHints, setFolderHints] = useState<MediaFolderHint[]>([]);
  const [isOperating, setIsOperating] = useState(false);
  const inboxPath = settings.inbox_dir.startsWith("/")
    ? settings.inbox_dir
    : `${settings.hdd_root.replace(/\/$/, "")}/${settings.inbox_dir.replace(/^\//, "")}`;

  // Auto-scan on mount if HDD connected
  useEffect(() => {
    if (hdd.connected) {
      void scan();
    }
  }, [hdd.connected]);

  // Simulate progress animation during scan
  useEffect(() => {
    if (!isScanning) { setProgress(0); return; }
    setProgress(5);
    const t = setInterval(() => setProgress((p) => Math.min(p + Math.random() * 8, 90)), 400);
    return () => clearInterval(t);
  }, [isScanning]);

  useEffect(() => {
    if (!isScanning && scanResult) setProgress(100);
  }, [isScanning, scanResult]);

  useEffect(() => {
    const loadHints = async () => {
      if (!hdd.connected || !scanResult || scanResult.total_files > 0 || !settings.hdd_root) {
        setFolderHints([]);
        return;
      }

      try {
        // ignoreDirs expects folder names (not full paths); extract last segment if absolute
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

  const highConfidence = scanResult?.sessions.filter((s) => s.confidence.toLowerCase() === "high") ?? [];

  const handleOperationStart = useCallback(() => setIsOperating(true), []);
  const handleOperationEnd = useCallback(() => setIsOperating(false), []);

  const bulkApprove = async () => {
    setIsOperating(true);
    for (const session of highConfidence) {
      if (!approvedSessions.has(session.id)) {
        const pairs = session.files.map((f) => [
          f.path,
          `${settings.hdd_root}/${session.suggested_path}/${f.kind === "video" ? "Videos" : "Photos"}/${deviceFolderSegment(f.device)}/${f.filename}`,
        ] as [string, string]);
        try {
          if (settings.operations.dry_run_first) {
            const preview = await invoke<FileOpResult>("copy_files", { files: pairs, dryRun: true });
            if (!preview.success) {
              console.error("Dry run failed:", preview.failed);
              continue;
            }
          }

          const result = await invoke<FileOpResult>("copy_files", { files: pairs, dryRun: false });
          if (result.success) {
            approveSession(session.id);
          } else {
            console.error("Copy failed:", result.failed);
          }
        } catch { /* continue */ }
      }
    }
    setIsOperating(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf6]">INBOX Analizörü</h1>
          <p className="text-sm text-[#565e80] mt-0.5">
            {scanResult
              ? `${scanResult.total_files} dosya tarandı · ${scanResult.sessions.length} oturum tespit edildi`
              : "Hazır"}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={isScanning ? <Spinner size={14} /> : <ScanLine size={14} />}
          onClick={() => void scan()}
          disabled={!hdd.connected || isScanning}
          loading={isScanning}
        >
          {isScanning ? "Taranıyor…" : "Yeniden Tara"}
        </Button>
      </div>

      {/* Progress */}
      {(isScanning || progress > 0) && (
        <div className="space-y-1.5">
          <ProgressBar value={isScanning ? progress : 100} color={isScanning ? "#6c8cff" : "#3dd68c"} />
          <p className="text-xs text-[#565e80]">
            {isScanning ? "INBOX taranıyor…" : "Tarama tamamlandı"}
          </p>
        </div>
      )}

      {/* Bulk approve */}
      {highConfidence.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[rgba(61,214,140,0.07)] border border-[rgba(61,214,140,0.18)]">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-[#3dd68c]" />
            <span className="text-sm text-[#e8eaf6]">
              <span className="font-semibold">{highConfidence.length}</span>
              <span className="text-[#565e80] ml-1">yüksek güven skorlu oturum otomatik onaylanabilir (EXIF/GPS/tarih sinyali güçlü)</span>
            </span>
          </div>
          <Button variant="success" size="sm" onClick={() => void bulkApprove()}>
            Tümünü Onayla
          </Button>
        </div>
      )}

      {/* Unclassified warning */}
      {(scanResult?.unclassified?.length ?? 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[rgba(240,178,58,0.07)] border border-[rgba(240,178,58,0.18)]">
          <p className="text-sm text-[#e8eaf6]">
            <span className="font-semibold text-[#f0b23a]">{scanResult!.unclassified.length}</span>
            <span className="text-[#565e80] ml-1">dosya sınıflandırılamadı — REVIEW'e gönderildi</span>
          </p>
        </div>
      )}

      {/* No HDD */}
      {!hdd.connected && (
        <Card className="text-center py-12 text-[#565e80]">
          HDD bağlı değil. Ayarlar'dan yol seçin.
        </Card>
      )}

      {/* Scan error */}
      {hdd.connected && scanError && (
        <Card className="py-6 border border-[rgba(224,82,82,0.28)] bg-[rgba(224,82,82,0.06)]">
          <p className="text-sm text-[#f2c2c2] font-medium">Tarama basarisiz</p>
          <p className="text-xs text-[#e79a9a] mt-1 break-all">{scanError}</p>
          <p className="text-xs text-[#d9b2b2] mt-3">
            Beklenen INBOX yolu: <span className="font-mono">{inboxPath}</span>
          </p>
        </Card>
      )}

      {/* Not yet scanned */}
      {hdd.connected && !isScanning && !scanResult && !scanError && (
        <Card className="text-center py-12 text-[#565e80]">
          INBOX taranmadı. Yukarıdan Tara butonuna tıklayın.
        </Card>
      )}

      {/* Session cards */}
      {scanResult && scanResult.sessions.length === 0 && !isScanning && (
        <Card className="text-center py-12 text-[#565e80]">
          INBOX boş — işlenecek dosya yok.
        </Card>
      )}

      {scanResult && scanResult.total_files === 0 && folderHints.length > 0 && (
        <Card className="py-4 border border-[rgba(240,178,58,0.28)] bg-[rgba(240,178,58,0.06)]">
          <p className="text-sm text-[#f3cd8a] font-medium">INBOX boş ama kök klasörde medya bulundu</p>
          <p className="text-xs text-[#ceb281] mt-1">Tarama sadece INBOX klasörünü analiz eder. Aşağıdaki klasörlerden birini INBOX olarak ayarlayabilirsiniz.</p>
          <div className="mt-3 space-y-2">
            {folderHints.slice(0, 5).map((hint) => (
              <div key={hint.path} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-[rgba(13,15,24,0.45)] border border-[rgba(240,178,58,0.18)]">
                <div className="min-w-0">
                  <p className="text-sm text-[#e8eaf6] truncate">{hint.name}</p>
                  <p className="text-xs text-[#7e85a7] truncate">{hint.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#f0b23a] font-medium">{hint.media_count} dosya</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSettings({ inbox_dir: hint.path });
                      void scan(hint.path);
                    }}
                  >
                    INBOX Yap
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {scanResult?.sessions.map((session) => (
          <SessionCard key={session.id} session={session} onOperationStart={handleOperationStart} onOperationEnd={handleOperationEnd} />
        ))}
      </div>

      <OperationProgress active={isOperating} onComplete={handleOperationEnd} />
    </div>
  );
}
