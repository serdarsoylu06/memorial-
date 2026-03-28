import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScanLine, Trash2, CheckCheck, Camera, Film } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Spinner from "../ui/Spinner";
import ProgressBar from "../ui/ProgressBar";
import type { DuplicatePair } from "../../types";


function PairCard({
  pair,
  onDelete,
}: {
  pair: DuplicatePair;
  onDelete: (path: string) => void;
}) {
  const pct = Math.round(pair.similarity * 100);

  function FileInfo({ path }: { path: string }) {
    const name = path.split("/").pop() ?? path;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const isImg = ["jpg", "jpeg", "png", "heic"].includes(ext);
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-full aspect-square rounded-lg bg-[#1a1d2e] border border-[#252840] flex items-center justify-center max-w-[80px]">
          {isImg ? <Camera size={24} className="text-[#363b60]" /> : <Film size={24} className="text-[#363b60]" />}
        </div>
        <p className="text-xs text-[#8890b4] truncate max-w-[120px]">{name}</p>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Badge tone={pair.match_type === "exact" ? "danger" : "warning"} dot>
          {pair.match_type === "exact" ? "Tam Kopya" : "Benzer"}
        </Badge>
        <span className="text-xs text-[#565e80]">{pct}% eşleşme</span>
        <div className="flex-1">
          <ProgressBar value={pct} color={pair.match_type === "exact" ? "#e05252" : "#f0b23a"} />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-xs text-[#565e80] mb-1.5">Orijinal</p>
          <FileInfo path={pair.original} />
        </div>
        <div className="w-px bg-[#252840]" />
        <div className="flex-1">
          <p className="text-xs text-[#565e80] mb-1.5">Kopya</p>
          <FileInfo path={pair.duplicate} />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="ghost" size="sm" className="flex-1">Orijinali Tut</Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          icon={<Trash2 size={12} />}
          onClick={() => onDelete(pair.duplicate)}
        >
          Kopyayı Sil
        </Button>
      </div>
    </Card>
  );
}

export default function DuplicateManager() {
  const { settings } = useAppStore();
  const hdd = useHDDStatus();
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const startScan = async () => {
    if (!settings.hdd_root) return;
    setLoading(true);
    setProgress(10);
    const pt = setInterval(() => setProgress((p) => Math.min(p + 5, 85)), 400);
    try {
      // Scan ARCHIVE + INBOX for duplicates
      const archivePath = `${settings.hdd_root}/${settings.archive_dir}`;
      const result = await invoke<DuplicatePair[]>("check_duplicates", {
        filePaths: [archivePath],
        phashThreshold: settings.duplicates.phash_threshold,
      });
      setPairs(result);
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(pt);
      setProgress(100);
      setLoading(false);
    }
  };

  const deleteDuplicate = async (path: string) => {
    try {
      await invoke("delete_file", { path });
      setPairs((prev) => prev.filter((p) => p.duplicate !== path));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf6]">Kopya Yöneticisi</h1>
          <p className="text-sm text-[#565e80] mt-0.5">
            {pairs.length > 0 ? `${pairs.length} kopya çifti tespit edildi` : "ARCHIVE taranmadı"}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={loading ? <Spinner size={14} /> : <ScanLine size={14} />}
          onClick={() => void startScan()}
          disabled={!hdd.connected || loading}
          loading={loading}
        >
          {loading ? "Taranıyor…" : "Kopyaları Tara"}
        </Button>
      </div>

      {(loading || progress > 0) && (
        <ProgressBar value={progress} color={loading ? "#6c8cff" : "#3dd68c"} />
      )}

      {!loading && pairs.length === 0 && progress === 100 && (
        <Card className="text-center py-12">
          <CheckCheck size={28} className="text-[#3dd68c] mx-auto mb-2" />
          <p className="text-[#8890b4]">Kopya bulunamadı 🎉</p>
        </Card>
      )}

      {!hdd.connected && (
        <Card className="text-center py-12 text-[#565e80]">
          HDD bağlı değil.
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {pairs.map((pair, i) => (
          <PairCard key={i} pair={pair} onDelete={(p) => void deleteDuplicate(p)} />
        ))}
      </div>
    </div>
  );
}
