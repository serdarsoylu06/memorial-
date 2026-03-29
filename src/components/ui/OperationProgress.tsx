import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import ProgressBar from "./ProgressBar";
import { CheckCheck, AlertTriangle, Copy, ShieldCheck } from "lucide-react";

interface FileProgress {
  current: number;
  total: number;
  filename: string;
  status: "copying" | "verifying" | "done" | "failed";
}

interface OperationProgressProps {
  active: boolean;
  onComplete?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  copying: "Kopyalanıyor…",
  verifying: "Doğrulanıyor…",
  done: "Tamamlandı",
  failed: "Hata",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  copying: <Copy size={13} className="text-[#6c8cff]" />,
  verifying: <ShieldCheck size={13} className="text-[#f0a830]" />,
  done: <CheckCheck size={13} className="text-[#3dd68c]" />,
  failed: <AlertTriangle size={13} className="text-[#e05252]" />,
};

export default function OperationProgress({ active, onComplete }: OperationProgressProps) {
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!active) {
      setProgress(null);
      setFailedFiles([]);
      setFinished(false);
      return;
    }

    const unlisten = listen<FileProgress>("file-progress", (event) => {
      const p = event.payload;
      setProgress(p);

      if (p.status === "failed") {
        setFailedFiles((prev) => [...prev, p.filename]);
      }

      if (p.current === p.total && (p.status === "done" || p.status === "failed")) {
        setFinished(true);
        setTimeout(() => onComplete?.(), 1500);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [active, onComplete]);

  if (!active && !finished) return null;
  if (!progress) return null;

  const pct = Math.round((progress.current / progress.total) * 100);
  const barColor = failedFiles.length > 0 ? "#e05252" : finished ? "#3dd68c" : "#6c8cff";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 bg-[#141621] border border-[#2e3347] rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          {STATUS_ICONS[progress.status]}
          <h3 className="text-sm font-semibold text-[#e8eaf6]">
            {finished ? "İşlem Tamamlandı" : "Dosyalar İşleniyor"}
          </h3>
        </div>

        {/* Progress bar */}
        <ProgressBar value={pct} color={barColor} className="mb-3" />

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-[#8b92a9] mb-3">
          <span>
            {progress.current} / {progress.total} dosya
          </span>
          <span className="font-mono">{pct}%</span>
        </div>

        {/* Current file */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d0f18] border border-[#1e2133]">
          {STATUS_ICONS[progress.status]}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#e8eaf6] truncate">{progress.filename}</p>
            <p className="text-[11px] text-[#565e80]">{STATUS_LABELS[progress.status]}</p>
          </div>
        </div>

        {/* Failed files */}
        {failedFiles.length > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-[rgba(224,82,82,0.08)] border border-[rgba(224,82,82,0.2)]">
            <p className="text-xs text-[#e05252] font-medium mb-1">
              {failedFiles.length} dosya başarısız
            </p>
            {failedFiles.slice(0, 3).map((f, i) => (
              <p key={`${f}-${i}`} className="text-[11px] text-[#e79a9a] truncate">{f}</p>
            ))}
            {failedFiles.length > 3 && (
              <p className="text-[11px] text-[#e79a9a]">+{failedFiles.length - 3} daha…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
