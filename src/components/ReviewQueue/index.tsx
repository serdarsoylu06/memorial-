import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import { useThumbnails } from "../../hooks/useThumbnails";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import { Notice, PageHeader, Segmented, inputClass } from "../ui/Page";
import { destinationDir, deviceLabel, formatBytes } from "../../utils/device";
import { formatDate } from "../../utils/formatters";
import type { DuplicatePair, FileOpResult, MediaFile } from "../../types";

type FilterKind = "all" | "no_exif" | "unknown_device" | "duplicate";

const KIND_LABELS: Record<string, string> = { photo: "Fotoğraf", video: "Video", unknown: "Bilinmeyen tür" };
const PAGE_SIZE = 60;

const n = (value: number) => value.toLocaleString("tr-TR");
const isUnknownDevice = (device: string) => !device || device === "Unknown" || device === "Unknown_Device";

/** Dosyanın neden incelemede olduğunu düz cümleyle söyler. */
function reasons(file: MediaFile): string {
  const list: string[] = [];
  if (!file.created_at) list.push("çekim tarihi yok");
  if (isUnknownDevice(file.device)) list.push("cihaz tanınmadı");
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const [target, setTarget] = useState("");
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  // Shift ile aralık seçmek için son tıklanan dosya.
  const lastClicked = useRef<string | null>(null);
  // Kopya taraması pahalıdır; yalnızca o filtre ilk seçildiğinde yapılır.
  const [duplicates, setDuplicates] = useState<Set<string> | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const reviewPath = `${settings.hdd_root}/${settings.review_dir}`;

  useEffect(() => {
    if (!hdd.connected || !settings.hdd_root) return;
    setLoading(true);
    invoke<MediaFile[]>("get_review_files", { reviewPath })
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hdd.connected, settings.hdd_root, reviewPath]);

  useEffect(() => {
    if (filter !== "duplicate" || duplicates !== null || !hdd.connected) return;
    setCheckingDuplicates(true);
    invoke<DuplicatePair[]>("check_duplicates", {
      filePaths: [reviewPath],
      phashThreshold: settings.duplicates.phash_threshold,
      sha256Check: settings.duplicates.sha256_check,
      phashCheck: settings.duplicates.phash_check,
    })
      .then((pairs) => setDuplicates(new Set(pairs.flatMap((p) => [p.original, p.duplicate]))))
      .catch(() => setDuplicates(new Set()))
      .finally(() => setCheckingDuplicates(false));
  }, [filter, duplicates, hdd.connected, reviewPath, settings.duplicates]);

  const filtered = files.filter((f) => {
    if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "no_exif") return !f.created_at;
    if (filter === "unknown_device") return isUnknownDevice(f.device);
    if (filter === "duplicate") return duplicates?.has(f.path) ?? false;
    return true;
  });
  const visible = filtered.slice(0, shown);
  const thumbs = useThumbnails(visible.map((f) => f.path));

  const toggleSelect = (path: string, range: boolean) => {
    setConfirmingTrash(false);
    const anchor = lastClicked.current;
    lastClicked.current = path;
    setSelected((prev) => {
      const next = new Set(prev);
      const from = range && anchor ? visible.findIndex((f) => f.path === anchor) : -1;
      const to = visible.findIndex((f) => f.path === path);
      if (from >= 0 && to >= 0) {
        // Shift ile tıklama: son tıklanan dosyadan buraya kadar hepsini seçer.
        for (const f of visible.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(f.path);
      } else if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.path));
  const toggleAll = () => {
    setConfirmingTrash(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of filtered) {
        if (allSelected) next.delete(f.path);
        else next.add(f.path);
      }
      return next;
    });
  };

  const forget = (paths: Set<string>) => {
    setFiles((f) => f.filter((x) => !paths.has(x.path)));
    setSelected((prev) => new Set([...prev].filter((p) => !paths.has(p))));
    setDuplicates(null);
  };

  const trashSelected = async () => {
    setConfirmingTrash(false);
    const removed = new Set<string>();
    for (const path of selected) {
      try {
        await invoke("trash_file", { path });
        removed.add(path);
      } catch {
        /* Çöp Kutusu'na atılamayan dosya listede kalır */
      }
    }
    const left = selected.size - removed.size;
    forget(removed);
    setMessage(
      left > 0
        ? {
            ok: false,
            text: `${n(removed.size)} dosya Çöp Kutusu'na atıldı, ${n(left)} dosya atılamadı ve yerinde duruyor.`,
          }
        : { ok: true, text: `${n(removed.size)} dosya Çöp Kutusu'na atıldı. Oradan geri alabilirsiniz.` }
    );
  };

  const moveSelected = async () => {
    const folder = target.trim().replace(/^\/+|\/+$/g, "");
    if (!folder) {
      setMessage({ ok: false, text: "Önce dosyaların taşınacağı klasörü yazın." });
      return;
    }
    const root = settings.hdd_root.replace(/\/$/, "");
    if (`${root}/${folder}/`.startsWith(`${reviewPath}/`)) {
      setMessage({ ok: false, text: "Hedef klasör, inceleme klasörünün içinde olamaz." });
      return;
    }

    const chosen = files.filter((f) => selected.has(f.path));
    const pairs = chosen.map((f) => [f.path, `${destinationDir(root, folder, f)}/${f.filename}`] as [string, string]);
    setMoving(true);
    setMessage(null);
    try {
      if (settings.operations.dry_run_first) {
        const preview = await invoke<FileOpResult>("move_files", { files: pairs, dryRun: true });
        if (!preview.success) {
          setMessage({
            ok: false,
            text: `Ön kontrol ${n(preview.failed.length)} dosyada takıldı; hiçbir dosya taşınmadı. ${preview.failed[0] ?? ""}`,
          });
          return;
        }
      }
      const result = await invoke<FileOpResult>("move_files", { files: pairs, dryRun: false });
      const moved = new Set(pairs.filter(([, dst]) => result.moved.includes(dst)).map(([src]) => src));
      forget(moved);
      setMessage(
        result.success
          ? { ok: true, text: `${n(moved.size)} dosya ${folder} klasörüne taşındı.` }
          : { ok: false, text: `${n(moved.size)} dosya taşındı, ${n(result.failed.length)} dosya taşınamadı.` }
      );
    } catch (err) {
      setMessage({ ok: false, text: `Dosyalar taşınamadı: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="İnceleme"
        status={
          files.length > 0
            ? `${n(files.length)} dosya bir oturuma yerleştirilemedi. Seçip elle bir klasöre taşıyabilirsiniz.`
            : "Otomatik yerleştirilemeyen dosyalar burada toplanır."
        }
      />

      <div className="flex gap-3 flex-wrap items-center">
        <Segmented
          label="Filtre"
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setShown(PAGE_SIZE);
          }}
          options={[
            { value: "all", label: "Bütün dosyalar" },
            { value: "no_exif", label: "Tarihi olmayanlar" },
            { value: "unknown_device", label: "Cihazı bilinmeyenler" },
            { value: "duplicate", label: "Kendi içinde kopyalar" },
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

      {selected.size > 0 && (
        <div className="bg-table border border-edge rounded-sm p-4 space-y-3">
          <p className="m-0 font-medium">{n(selected.size)} dosya seçildi</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[260px]">
              <span className="block text-[13px] text-dim mb-1">Taşınacak klasör, diskin köküne göre</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`${settings.archive_dir}/2024/2024-06-14_Etkinlik-Adi`}
                className={`${inputClass} w-full font-mono`}
              />
            </label>
            <Button variant="primary" loading={moving} onClick={() => void moveSelected()}>
              Seçili {n(selected.size)} dosyayı taşı
            </Button>
            {confirmingTrash ? (
              <>
                <Button variant="danger" disabled={moving} onClick={() => void trashSelected()}>
                  Evet, {n(selected.size)} dosyayı Çöp Kutusu'na at
                </Button>
                <Button variant="quiet" onClick={() => setConfirmingTrash(false)}>
                  Vazgeç
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" disabled={moving} onClick={() => setConfirmingTrash(true)}>
                  Seçili {n(selected.size)} dosyayı Çöp Kutusu'na at
                </Button>
                <Button
                  variant="quiet"
                  disabled={moving}
                  onClick={() => {
                    setSelected(new Set());
                    setConfirmingTrash(false);
                  }}
                >
                  Seçimi kaldır
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-dim m-0">
            Taşınan dosyalar klasörün içinde tür ve cihaza göre alt klasörlere yerleşir (örneğin Photos/iPhone).
            Çöp Kutusu'na atılan dosya diskten silinmez; Çöp Kutusu'nu boşaltana kadar geri alabilirsiniz.
          </p>
        </div>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[13px] m-0 ${message.ok ? "text-done" : "text-stop"}`}>
          {message.text}
        </p>
      )}

      {(loading || checkingDuplicates) && (
        <div className="flex items-center gap-3 py-6 text-dim">
          <Spinner size={20} />
          {checkingDuplicates && <span>İnceleme klasöründeki dosyalar birbiriyle karşılaştırılıyor</span>}
        </div>
      )}

      {!hdd.connected && <Notice title="Disk bağlı değil">İnceleme klasörünü görmek için diski takın.</Notice>}

      {hdd.connected && !loading && !checkingDuplicates && filtered.length === 0 && (
        <Notice title={files.length === 0 ? "İncelenecek dosya yok" : "Bu filtreye uyan dosya yok"}>
          {files.length === 0
            ? "Taramada sınıflandırılamayan dosyalar olursa burada görünür."
            : "Filtreyi veya aramayı değiştirin."}
        </Notice>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            role="checkbox"
            aria-checked={allSelected}
            onClick={toggleAll}
            className="flex items-center gap-3.5 text-[13px] font-medium bg-transparent border-0 p-0"
          >
            <span
              aria-hidden
              className={`w-4 h-4 rounded-[2px] shrink-0 flex items-center justify-center ${
                allSelected ? "bg-mark text-on-mark" : "border border-edge-strong"
              }`}
            >
              {allSelected && <Check size={12} strokeWidth={3} />}
            </span>
            {allSelected ? "Seçimi kaldır" : `Listedeki ${n(filtered.length)} dosyanın hepsini seç`}
          </button>
          <span className="text-xs text-dim">Bir aralığı seçmek için ilk dosyaya, sonra Shift ile son dosyaya tıklayın.</span>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="list-none m-0 p-0 border-t border-edge">
          {visible.map((file) => {
            const isSelected = selected.has(file.path);
            const thumb = thumbs[file.path];
            return (
              <li key={file.path} className="border-b border-edge">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={(e) => toggleSelect(file.path, e.shiftKey)}
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
                  <span className="w-[66px] shrink-0 aspect-[3/2] rounded-[2px] bg-well border border-edge overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="condensed text-[11px] text-faint">
                        {file.filename.includes(".") ? file.filename.split(".").pop()!.toUpperCase() : ""}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-[13px] truncate">{file.filename}</span>
                    <span className="block text-xs text-dim mt-0.5">
                      {KIND_LABELS[file.kind] ?? file.kind}, {formatBytes(file.size_bytes)}
                      {file.created_at ? `, ${formatDate(file.created_at)}` : ""}
                      {!isUnknownDevice(file.device) ? `, ${deviceLabel(file.device)}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-dim text-right shrink-0">{reasons(file)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > shown && (
        <Button onClick={() => setShown((count) => count + PAGE_SIZE)}>
          {n(Math.min(PAGE_SIZE, filtered.length - shown))} dosya daha göster
        </Button>
      )}
    </div>
  );
}
