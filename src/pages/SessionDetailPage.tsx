import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft } from "lucide-react";
import { useInboxStore } from "../store/useInboxStore";
import { useAppStore } from "../store/useAppStore";
import Button from "../components/ui/Button";
import ConfidenceMeter from "../components/ui/ConfidenceMeter";
import { Frame } from "../components/ui/ContactStrip";
import { Notice, Segmented, inputClass } from "../components/ui/Page";
import type { Session, FileOpResult } from "../types";
import { deviceFolderSegment, deviceLabel, deviceList } from "../utils/device";
import { formatDateRange, formatFileCounts } from "../utils/formatters";

const n = (value: number) => value.toLocaleString("tr-TR");
const PAGE_SIZE = 40;

function ContactSheet({ session }: { session: Session }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(session.files.length / PAGE_SIZE);
  const offset = page * PAGE_SIZE;
  const paged = session.files.slice(offset, offset + PAGE_SIZE);

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-2 gap-y-3">
        {paged.map((file, i) => (
          <Frame key={file.path} file={file} number={offset + i + 1} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-5">
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Önceki sayfa
          </Button>
          <span className="condensed text-[13px] text-dim">
            {page + 1} / {totalPages}
          </span>
          <Button disabled={page === totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Sonraki sayfa
          </Button>
        </div>
      )}
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-5 border-b border-edge first:pt-0 last:border-b-0">
      <h2 className="text-[13px] font-medium text-dim m-0 mb-2.5">{title}</h2>
      {children}
    </section>
  );
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scanResult } = useInboxStore();
  const { settings } = useAppStore();
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [result, setResult] = useState<FileOpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [customPath, setCustomPath] = useState("");

  const session: Session | undefined = scanResult?.sessions.find((s) => s.id === id);

  useEffect(() => {
    if (session) setCustomPath(session.suggested_path);
  }, [session]);

  if (!session) {
    return (
      <Notice
        title="Bu oturum artık listede yok"
        action={<Button onClick={() => navigate("/inbox")}>Gelen'e dön</Button>}
      >
        Gelen klasörü yeniden tarandığında oturumlar baştan oluşturulur.
      </Notice>
    );
  }

  const useMove = mode === "move";
  const verb = useMove ? "taşı" : "kopyala";

  const deviceCounts: Record<string, number> = {};
  session.files.forEach((f) => {
    deviceCounts[f.device] = (deviceCounts[f.device] ?? 0) + 1;
  });
  const deviceRows = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]);

  const targetFor = (f: Session["files"][number]) =>
    `${settings.hdd_root}/${customPath}/${f.kind === "video" ? "Videos" : "Photos"}/${deviceFolderSegment(f.device)}/${f.filename}`;
  const previewTargets = session.files.slice(0, 3).map(targetFor);
  const gpsFiles = session.files.filter((f) => f.has_gps);

  const runOperation = async () => {
    if (!settings.hdd_root) return;
    setRunning(true);
    setError(null);
    const command = useMove ? "move_files" : "copy_files";
    const pairs = session.files.map((f) => [f.path, targetFor(f)] as [string, string]);
    try {
      if (settings.operations.dry_run_first) {
        const preview = await invoke<FileOpResult>(command, { files: pairs, dryRun: true });
        if (!preview.success) {
          setResult(preview);
          return;
        }
      }
      const res = await invoke<FileOpResult>(command, { files: pairs, dryRun: false });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const createdFolders = result?.success
    ? Array.from(new Set(result.moved.map((p) => p.replace(/[\\/][^\\/]+$/, "")).filter(Boolean)))
    : [];

  return (
    <div>
      <Button variant="quiet" icon={<ArrowLeft size={14} />} onClick={() => navigate("/inbox")} className="-ml-3">
        Gelen
      </Button>

      <div className="flex items-end justify-between gap-6 pt-3 pb-5 border-b border-edge">
        <div className="min-w-0">
          <h1 className="display text-[30px] m-0 break-words">
            {customPath.split("/").filter(Boolean).pop() ?? "Oturum"}
          </h1>
          <p className="text-dim mt-1.5 mb-0">
            {formatDateRange(session.date_start, session.date_end)}, {formatFileCounts(session.files)}.{" "}
            {deviceList(session.devices)} ile çekildi.
          </p>
        </div>
        <ConfidenceMeter level={session.confidence} className="mb-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-10 pt-6">
        <ContactSheet session={session} />

        <aside>
          <SideSection title="Hedef klasör">
            <input
              aria-label="Hedef klasör"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className={`${inputClass} w-full font-mono`}
            />
            {previewTargets.length > 0 && (
              <div className="mt-2.5">
                <p className="text-xs text-dim m-0">İlk dosyaların gideceği yer:</p>
                {previewTargets.map((target) => (
                  <p key={target} className="font-mono text-xs text-dim break-all m-0 mt-1">
                    {target}
                  </p>
                ))}
              </div>
            )}
          </SideSection>

          <SideSection title="Cihazlar">
            <ul className="list-none m-0 p-0 space-y-2">
              {deviceRows.map(([device, count]) => (
                <li key={device} className="text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span>{deviceLabel(device)}</span>
                    <span className="condensed text-dim">{n(count)}</span>
                  </div>
                  <div className="h-1 mt-1 bg-well rounded-full overflow-hidden">
                    <div
                      className="h-full bg-paper"
                      style={{ width: `${(count / session.files.length) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </SideSection>

          {gpsFiles.length > 0 && (
            <SideSection title="Konum">
              <p className="text-[13px] m-0">{n(gpsFiles.length)} dosyada konum bilgisi var.</p>
              {gpsFiles.slice(0, 3).map((f) => (
                <p key={f.path} className="font-mono text-xs text-dim m-0 mt-1">
                  {f.gps_lat?.toFixed(5)}, {f.gps_lon?.toFixed(5)}
                </p>
              ))}
            </SideSection>
          )}

          <SideSection title="İşlem">
            <Segmented
              label="İşlem türü"
              value={mode}
              onChange={setMode}
              options={[
                { value: "copy", label: "Kopyala" },
                { value: "move", label: "Taşı" },
              ]}
            />
            <p className="text-xs text-dim m-0 mt-2.5">
              {useMove
                ? "Dosyalar gelen klasöründen silinip arşive taşınır."
                : "Dosyalar arşive kopyalanır; gelen klasöründekiler yerinde kalır."}
              {settings.operations.dry_run_first && " Önce bir ön kontrol yapılır."}
            </p>
            <Button
              variant="primary"
              size="md"
              className="w-full mt-4"
              loading={running}
              disabled={!settings.hdd_root}
              onClick={() => void runOperation()}
            >
              {n(session.files.length)} dosyayı {verb}
            </Button>

            {error && (
              <p role="alert" className="text-[13px] text-stop m-0 mt-3 break-words">
                Dosyalar {useMove ? "taşınamadı" : "kopyalanamadı"}: {error}
              </p>
            )}

            {result && (
              <div
                role="status"
                className={`mt-4 border-l-2 pl-3 text-[13px] ${result.success ? "border-done" : "border-stop"}`}
              >
                <p className={`font-medium m-0 ${result.success ? "" : "text-stop"}`}>
                  {result.dry_run
                    ? `Ön kontrol ${n(result.failed.length)} dosyada takıldı; hiçbir dosyaya dokunulmadı.`
                    : result.success
                    ? `${n(result.moved.length)} dosya ${useMove ? "taşındı" : "kopyalandı"}`
                    : `${n(result.failed.length)} dosya ${useMove ? "taşınamadı" : "kopyalanamadı"}, ${n(result.moved.length)} dosya tamamlandı`}
                </p>
                {createdFolders.slice(0, 5).map((folder) => (
                  <p key={folder} className="font-mono text-xs text-dim break-all m-0 mt-1">
                    {folder}
                  </p>
                ))}
                {!result.success &&
                  result.failed.slice(0, 5).map((f) => (
                    <p key={f} className="font-mono text-xs text-dim break-all m-0 mt-1">
                      {f}
                    </p>
                  ))}
              </div>
            )}
          </SideSection>
        </aside>
      </div>
    </div>
  );
}
