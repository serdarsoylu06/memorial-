import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import ProgressBar from "./ProgressBar";

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

const STATUS_LABELS: Record<FileProgress["status"], string> = {
  copying: "Kopyalanıyor",
  verifying: "Doğrulanıyor",
  done: "Kopyalandı",
  failed: "Kopyalanamadı",
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
  const tone = failedFiles.length > 0 ? "stop" : finished ? "done" : "paper";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="op-progress-title"
        className="w-full max-w-md mx-4 bg-table border border-edge-strong rounded-sm p-6 shadow-2xl"
      >
        <h2 id="op-progress-title" className="display text-xl m-0">
          {finished ? "Kopyalama bitti" : "Dosyalar kopyalanıyor"}
        </h2>

        <div className="flex items-baseline justify-between mt-4 mb-2 text-[13px] text-dim">
          <span>
            {progress.current.toLocaleString("tr-TR")} / {progress.total.toLocaleString("tr-TR")} dosya
          </span>
          <span className="condensed text-paper">%{pct}</span>
        </div>
        <ProgressBar value={pct} tone={tone} label="Kopyalama ilerlemesi" />

        <p className="font-mono text-[13px] truncate mt-4 mb-0">{progress.filename}</p>
        <p className="text-[13px] text-dim m-0">{STATUS_LABELS[progress.status]}</p>

        {failedFiles.length > 0 && (
          <div role="alert" className="mt-4 border-l-2 border-stop pl-3">
            <p className="text-[13px] text-stop font-medium m-0">
              {failedFiles.length} dosya kopyalanamadı
            </p>
            {failedFiles.slice(0, 3).map((f, i) => (
              <p key={`${f}-${i}`} className="font-mono text-xs text-dim truncate m-0">
                {f}
              </p>
            ))}
            {failedFiles.length > 3 && (
              <p className="text-xs text-dim m-0">ve {failedFiles.length - 3} dosya daha</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
