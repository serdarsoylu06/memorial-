import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import Button from "../ui/Button";
import ProgressBar from "../ui/ProgressBar";
import { Notice, PageHeader } from "../ui/Page";
import { useThumbnails } from "../../hooks/useThumbnails";
import type { DuplicatePair } from "../../types";

function splitPath(path: string): { name: string; dir: string } {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? { name: path.slice(idx + 1), dir: path.slice(0, idx) } : { name: path, dir: "" };
}

function FileSide({ role, path, thumbnail }: { role: string; path: string; thumbnail?: string | null }) {
  const { name, dir } = splitPath(path);
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "";
  return (
    <div className="flex gap-3 min-w-0">
      <div className="w-[120px] shrink-0 aspect-[3/2] rounded-[2px] bg-well border border-edge overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="condensed text-[11px] text-faint">{ext}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-dim m-0">{role}</p>
        <p className="font-mono text-[13px] truncate m-0" title={name}>
          {name}
        </p>
        <p className="font-mono text-xs text-dim truncate m-0" title={dir}>
          {dir}
        </p>
      </div>
    </div>
  );
}

function PairRow({
  pair,
  onDelete,
  onKeepBoth,
}: {
  pair: DuplicatePair;
  onDelete: () => void;
  onKeepBoth: () => void;
}) {
  const pct = Math.round(pair.similarity * 100);
  const thumbs = useThumbnails([pair.original, pair.duplicate]);
  return (
    <li className="py-5 border-b border-edge">
      <p className="m-0 mb-3 text-[13px]">
        <span className="font-medium">{pair.match_type === "exact" ? "Birebir aynı dosya" : "Benzer görüntü"}</span>
        <span className="text-dim">, %{pct} eşleşme</span>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
        <FileSide role="Asıl dosya" path={pair.original} thumbnail={thumbs[pair.original]} />
        <FileSide role="Kopya" path={pair.duplicate} thumbnail={thumbs[pair.duplicate]} />
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="danger" onClick={onDelete}>
          Kopyayı sil
        </Button>
        <Button variant="quiet" onClick={onKeepBoth}>
          İkisini de tut
        </Button>
      </div>
    </li>
  );
}

export default function DuplicateManager() {
  const { settings } = useAppStore();
  const hdd = useHDDStatus();
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startScan = async () => {
    if (!settings.hdd_root) return;
    setLoading(true);
    setError(null);
    setProgress(10);
    const pt = setInterval(() => setProgress((p) => Math.min(p + 5, 85)), 400);
    try {
      const archivePath = `${settings.hdd_root}/${settings.archive_dir}`;
      const result = await invoke<DuplicatePair[]>("check_duplicates", {
        filePaths: [archivePath],
        phashThreshold: settings.duplicates.phash_threshold,
        sha256Check: settings.duplicates.sha256_check,
        phashCheck: settings.duplicates.phash_check,
      });
      setPairs(result);
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      clearInterval(pt);
      setLoading(false);
    }
  };

  const deleteDuplicate = async (path: string) => {
    try {
      await invoke("delete_file", { path });
      setPairs((prev) => prev.filter((p) => p.duplicate !== path));
    } catch (err) {
      setError(`Dosya silinemedi: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  let status: string;
  if (loading) status = "Arşiv taranıyor";
  else if (!scanned) status = "Arşiv henüz kopyalar için taranmadı.";
  else if (pairs.length === 0) status = "Arşivde kopya bulunamadı.";
  else status = `${pairs.length.toLocaleString("tr-TR")} kopya çifti bulundu.`;

  return (
    <div className="space-y-6">
      <PageHeader title="Kopyalar" status={status}>
        <Button variant="primary" onClick={() => void startScan()} disabled={!hdd.connected} loading={loading}>
          {loading ? "Taranıyor" : scanned ? "Yeniden tara" : "Kopyaları tara"}
        </Button>
      </PageHeader>

      {loading && <ProgressBar value={progress} label="Kopya taraması ilerlemesi" />}

      {error && (
        <Notice tone="stop" title="İşlem tamamlanamadı">
          <span className="break-all">{error}</span>
        </Notice>
      )}

      {!hdd.connected && <Notice title="Disk bağlı değil">Kopyaları taramak için diski takın.</Notice>}

      {hdd.connected && !loading && !scanned && !error && (
        <Notice title="Tarama, arşivdeki her dosyayı karşılaştırır">
          Birebir aynı dosyalar ve birbirine çok benzeyen görüntüler çiftler hâlinde listelenir. Büyük arşivlerde
          uzun sürebilir.
        </Notice>
      )}

      {pairs.length > 0 && (
        <ul className="list-none m-0 p-0 border-t border-edge">
          {pairs.map((pair) => (
            <PairRow
              key={`${pair.original}|${pair.duplicate}`}
              pair={pair}
              onDelete={() => void deleteDuplicate(pair.duplicate)}
              onKeepBoth={() =>
                setPairs((prev) =>
                  prev.filter((p) => !(p.original === pair.original && p.duplicate === pair.duplicate))
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
