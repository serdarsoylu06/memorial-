import { useEffect, useState } from "react";
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
import type { Session } from "../../types";
import { deviceColor, deviceLabel } from "../../utils/device";

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

function SessionCard({ session }: { session: Session }) {
  const { approveSession, rejectSession, approvedSessions, rejectedSessions } = useInboxStore();
  const { settings } = useAppStore();
  const navigate = useNavigate();
  const [customPath, setCustomPath] = useState(session.suggested_path);
  const isApproved = approvedSessions.has(session.id);
  const isRejected = rejectedSessions.has(session.id);

  const photoCount = session.files.filter((f) => f.kind === "photo").length;
  const videoCount = session.files.filter((f) => f.kind === "video").length;

  const approve = async () => {
    if (!settings.hdd_root) return;
    const pairs = session.files.map((f) => [
      f.path,
      `${settings.hdd_root}/${customPath}/${f.device}/${f.filename}`,
    ] as [string, string]);
    try {
      await invoke("copy_files", { files: pairs, dryRun: settings.operations.dry_run_first });
      approveSession(session.id);
    } catch (err) {
      console.error("Copy failed:", err);
    }
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
        <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-[#3dd68c]">
          <CheckCheck size={13} /> Onaylandı
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
  const { scan } = useInboxScan();
  const { scanResult, scanError, isScanning, approvedSessions, approveSession } = useInboxStore();
  const { settings } = useAppStore();
  const [progress, setProgress] = useState(0);
  const inboxPath = `${settings.hdd_root.replace(/\/$/, "")}/${settings.inbox_dir.replace(/^\//, "")}`;

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

  const highConfidence = scanResult?.sessions.filter((s) => s.confidence.toLowerCase() === "high") ?? [];

  const bulkApprove = async () => {
    for (const session of highConfidence) {
      if (!approvedSessions.has(session.id)) {
        const pairs = session.files.map((f) => [
          f.path,
          `${settings.hdd_root}/${session.suggested_path}/${f.device}/${f.filename}`,
        ] as [string, string]);
        try {
          await invoke("copy_files", { files: pairs, dryRun: settings.operations.dry_run_first });
          approveSession(session.id);
        } catch { /* continue */ }
      }
    }
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
              <span className="text-[#565e80] ml-1">yüksek güvenlikli oturum otomatik onaylanabilir</span>
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

      <div className="grid gap-4">
        {scanResult?.sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
