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
  mode?: "copy" | "move";
  onComplete?: () => void;
}

const WORDS = {
  copy: { doing: "Kopyalanıyor", done: "Kopyalandı", failed: "kopyalanamadı", title: "Dosyalar kopyalanıyor", end: "Kopyalama bitti", bar: "Kopyalama ilerlemesi" },
  move: { doing: "Taşınıyor", done: "Taşındı", failed: "taşınamadı", title: "Dosyalar taşınıyor", end: "Taşıma bitti", bar: "Taşıma ilerlemesi" },
};

export default function OperationProgress({ active, mode = "copy", onComplete }: OperationProgressProps) {
  const words = WORDS[mode];
  const statusLabel: Record<FileProgress["status"], string> = {
    copying: words.doing,
    verifying: "Doğrulanıyor",
    done: words.done,
    failed: words.failed.charAt(0).toUpperCase() + words.failed.slice(1),
  };
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
          {finished ? words.end : words.title}
        </h2>

        <div className="flex items-baseline justify-between mt-4 mb-2 text-[13px] text-dim">
          <span>
            {progress.current.toLocaleString("tr-TR")} / {progress.total.toLocaleString("tr-TR")} dosya
          </span>
          <span className="condensed text-paper">%{pct}</span>
        </div>
        <ProgressBar value={pct} tone={tone} label={words.bar} />

        <p className="font-mono text-[13px] truncate mt-4 mb-0">{progress.filename}</p>
        <p className="text-[13px] text-dim m-0">{statusLabel[progress.status]}</p>

        {failedFiles.length > 0 && (
          <div role="alert" className="mt-4 border-l-2 border-stop pl-3">
            <p className="text-[13px] text-stop font-medium m-0">
              {failedFiles.length} dosya {words.failed}
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
