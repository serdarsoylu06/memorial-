import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import { Notice, PageHeader, Segmented, inputClass } from "../ui/Page";
import { deviceLabel, formatBytes } from "../../utils/device";
import { formatDate } from "../../utils/formatters";
import type { MediaFile } from "../../types";

type FilterKind = "all" | "no_exif" | "unknown_device" | "duplicate";

const KIND_LABELS: Record<string, string> = { photo: "Fotoğraf", video: "Video", unknown: "Bilinmeyen tür" };

/** Dosyanın neden incelemede olduğunu düz cümleyle söyler. */
function reasons(file: MediaFile): string {
  const list: string[] = [];
  if (!file.created_at) list.push("çekim tarihi yok");
  if (file.device === "Unknown") list.push("cihaz tanınmadı");
  if (!file.has_gps) list.push("konum yok");
  return list.join(", ");
}

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
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const deleteSelected = async () => {
    for (const path of selected) {
      try { await invoke("delete_file", { path }); } catch { /* skip */ }
    }
    setFiles((f) => f.filter((x) => !selected.has(x.path)));
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="İnceleme"
        status={
          files.length > 0
            ? `${files.length.toLocaleString("tr-TR")} dosya bir oturuma yerleştirilemedi.`
            : "Otomatik yerleştirilemeyen dosyalar burada toplanır."
        }
      >
        {selected.size > 0 && (
          <Button variant="danger" onClick={() => void deleteSelected()}>
            Seçili {selected.size.toLocaleString("tr-TR")} dosyayı sil
          </Button>
        )}
      </PageHeader>

      <div className="flex gap-3 flex-wrap items-center">
        <Segmented
          label="Filtre"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tümü" },
            { value: "no_exif", label: "Tarihi olmayanlar" },
            { value: "unknown_device", label: "Cihazı bilinmeyenler" },
            { value: "duplicate", label: "Kopya şüphesi" },
          ]}
        />
        <input
          type="search"
          aria-label="Dosya adında ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Dosya adında ara"
          className={`${inputClass} flex-1 min-w-[180px]`}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size={24} />
        </div>
      )}

      {!hdd.connected && <Notice title="Disk bağlı değil">İnceleme klasörünü görmek için diski takın.</Notice>}

      {hdd.connected && !loading && filtered.length === 0 && (
        <Notice title={files.length === 0 ? "İncelenecek dosya yok" : "Bu filtreye uyan dosya yok"}>
          {files.length === 0
            ? "Taramada sınıflandırılamayan dosyalar olursa burada görünür."
            : "Filtreyi veya aramayı değiştirin."}
        </Notice>
      )}

      {filtered.length > 0 && (
        <ul className="list-none m-0 p-0 border-t border-edge">
          {filtered.map((file) => {
            const isSelected = selected.has(file.path);
            return (
              <li key={file.path} className="border-b border-edge">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggleSelect(file.path)}
                  className="text-left flex items-center gap-3.5 py-2.5 -mx-3 px-3 w-[calc(100%+1.5rem)] rounded-sm hover:bg-table/50 transition-colors"
                >
                  <span
                    aria-hidden
                    className={`w-4 h-4 rounded-[2px] shrink-0 flex items-center justify-center ${
                      isSelected ? "bg-mark text-on-mark" : "border border-edge-strong"
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-[13px] truncate">{file.filename}</span>
                    <span className="block text-xs text-dim mt-0.5">
                      {KIND_LABELS[file.kind] ?? file.kind}, {formatBytes(file.size_bytes)}
                      {file.created_at ? `, ${formatDate(file.created_at)}` : ""}
                      {file.device !== "Unknown" ? `, ${deviceLabel(file.device)}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-dim text-right shrink-0">{reasons(file)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
