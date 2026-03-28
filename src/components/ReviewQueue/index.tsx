import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Filter, FileX, Cpu, Copy } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import type { MediaFile } from "../../types";

type FilterKind = "all" | "no_exif" | "unknown_device" | "duplicate";

export default function ReviewQueue() {
  const { settings } = useAppStore();
  const hdd = useHDDStatus();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!hdd.connected || !settings.hdd_root) return;
    setLoading(true);
    invoke<MediaFile[]>("get_review_files", {
      reviewPath: `${settings.hdd_root}/${settings.review_dir}`,
    })
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hdd.connected, settings.hdd_root, settings.review_dir]);

  const filtered = files.filter((f) => {
    if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "no_exif") return !f.created_at;
    if (filter === "unknown_device") return f.device === "Unknown";
    return true;
  });

  const toggleSelect = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const deleteSelected = async () => {
    for (const path of selected) {
      try { await invoke("delete_file", { path }); } catch { /* skip */ }
    }
    setFiles((f) => f.filter((x) => !selected.has(x.path)));
    setSelected(new Set());
  };

  const filterTabs: { key: FilterKind; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "Tümü", icon: <Filter size={12} /> },
    { key: "no_exif", label: "EXIF Yok", icon: <FileX size={12} /> },
    { key: "unknown_device", label: "Bilinmeyen", icon: <Cpu size={12} /> },
    { key: "duplicate", label: "Kopya Şüphesi", icon: <Copy size={12} /> },
  ];

  function formatBytes(b: number) {
    if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
    return `${(b / 1e6).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf6]">İnceleme Kuyruğu</h1>
          <p className="text-sm text-[#565e80] mt-0.5">{files.length} dosya inceleme bekliyor</p>
        </div>
        {selected.size > 0 && (
          <Button variant="danger" size="sm" onClick={() => void deleteSelected()}>
            {selected.size} Dosyayı Sil
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === t.key
                ? "bg-[rgba(108,140,255,0.15)] border-[rgba(108,140,255,0.4)] text-[#6c8cff]"
                : "border-[#252840] text-[#565e80] hover:border-[#363b60] hover:text-[#8890b4]"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="flex-1 flex items-center gap-2 bg-[#13161f] border border-[#252840] rounded-lg px-3 py-1.5 min-w-[180px]">
          <Search size={12} className="text-[#565e80] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dosya ara…"
            className="bg-transparent text-xs text-[#e8eaf6] outline-none w-full placeholder:text-[#565e80]"
          />
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Spinner size={28} /></div>}

      {!loading && filtered.length === 0 && (
        <Card className="text-center py-12 text-[#565e80]">
          {files.length === 0 ? "REVIEW klasörü boş 🎉" : "Filtreyle eşleşen dosya yok."}
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((file) => (
          <div
            key={file.path}
            onClick={() => toggleSelect(file.path)}
            className={`glass p-3 flex items-center gap-3 cursor-pointer hover:border-[#363b60] transition-all ${
              selected.has(file.path) ? "border-[rgba(108,140,255,0.4)] bg-[rgba(108,140,255,0.04)]" : ""
            }`}
          >
            <div
              className={`w-4 h-4 rounded border-2 shrink-0 transition-all ${
                selected.has(file.path)
                  ? "bg-[#6c8cff] border-[#6c8cff]"
                  : "border-[#363b60]"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#e8eaf6] font-medium truncate">{file.filename}</p>
              <p className="text-xs text-[#565e80] mt-0.5">
                {formatBytes(file.size_bytes)} · {file.kind}
                {file.created_at ? ` · ${file.created_at.slice(0, 10)}` : ""}
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {!file.created_at && <Badge tone="warning">EXIF Yok</Badge>}
              {file.device === "Unknown" && <Badge tone="muted">Bilinmeyen</Badge>}
              {file.has_gps && <Badge tone="accent">GPS</Badge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
