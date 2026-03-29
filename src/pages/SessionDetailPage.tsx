import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, MapPin, Camera, Film, Copy, Move, CheckCheck } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useInboxStore } from "../store/useInboxStore";
import { useAppStore } from "../store/useAppStore";
import Badge, { confidenceTone } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import type { Session, FileOpResult } from "../types";
import { deviceFolderSegment } from "../utils/device";

const DEVICE_COLORS: Record<string, string> = {
  "Sony α6700": "#6c8cff",
  "Canon 6D": "#f0b23a",
  "Canon 60D": "#f09a3a",
  "iPhone": "#3dd68c",
  "Samsung Note8": "#a78bfa",
  "Unknown": "#565e80",
};

function FileGrid({ session }: { session: Session }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const paged = session.files.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(session.files.length / PAGE_SIZE);

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {paged.map((file, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-[#1a1d2e] border border-[#252840] overflow-hidden flex items-center justify-center group"
            title={file.filename}
          >
            {file.kind === "photo" ? (
              <Camera size={20} className="text-[#363b60] group-hover:text-[#6c8cff] transition-colors" />
            ) : (
              <Film size={20} className="text-[#363b60] group-hover:text-[#a78bfa] transition-colors" />
            )}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2 mt-3 justify-center">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Önceki</Button>
          <span className="text-xs text-[#565e80] flex items-center">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages - 1} onClick={() => setPage((p) => p + 1)}>Sonraki →</Button>
        </div>
      )}
    </div>
  );
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scanResult } = useInboxStore();
  const { settings } = useAppStore();
  const [useMove, setUseMove] = useState(false);
  const [result, setResult] = useState<FileOpResult | null>(null);
  const [running, setRunning] = useState(false);
  const [customPath, setCustomPath] = useState("");

  const session: Session | undefined = scanResult?.sessions.find((s) => s.id === id);

  useEffect(() => {
    if (session) setCustomPath(session.suggested_path);
  }, [session]);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#565e80] gap-4">
        <p>Oturum bulunamadı.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/inbox")}>← Geri Dön</Button>
      </div>
    );
  }

  // Device distribution for pie chart
  const deviceCounts: Record<string, number> = {};
  session.files.forEach((f) => {
    deviceCounts[f.device] = (deviceCounts[f.device] ?? 0) + 1;
  });
  const pieData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value }));

  const photoCount = session.files.filter((f) => f.kind === "photo").length;
  const videoCount = session.files.filter((f) => f.kind === "video").length;
  const previewTargets = session.files.slice(0, 3).map((f) =>
    `${settings.hdd_root}/${customPath}/${f.kind === "video" ? "Videos" : "Photos"}/${deviceFolderSegment(f.device)}/${f.filename}`
  );

  const runOperation = async () => {
    if (!settings.hdd_root) return;
    setRunning(true);
    const command = useMove ? "move_files" : "copy_files";
    const pairs = session.files.map((f) => [
      f.path,
      `${settings.hdd_root}/${customPath}/${f.kind === "video" ? "Videos" : "Photos"}/${deviceFolderSegment(f.device)}/${f.filename}`,
    ] as [string, string]);
    try {
      if (settings.operations.dry_run_first) {
        const preview = await invoke<FileOpResult>(command, {
          files: pairs,
          dryRun: true,
        });
        if (!preview.success) {
          setResult(preview);
          return;
        }
      }

      const res = await invoke<FileOpResult>(command, {
        files: pairs,
        dryRun: false,
      });
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate("/inbox")}>
          Geri
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-[#e8eaf6] truncate">{session.suggested_path}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-[#565e80]">
              {session.date_start?.slice(0, 10)} {session.date_end && session.date_end !== session.date_start ? `→ ${session.date_end.slice(0, 10)}` : ""}
            </span>
            <Badge tone={confidenceTone(session.confidence)} dot>{session.confidence}</Badge>
            {session.has_gps && <Badge tone="accent"><MapPin size={10} className="inline" /> GPS</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: files */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Toplam", value: session.files.length },
              { label: "Fotoğraf", value: photoCount },
              { label: "Video", value: videoCount },
            ].map(({ label, value }) => (
              <Card key={label} className="text-center py-3">
                <p className="text-2xl font-semibold text-[#e8eaf6]">{value}</p>
                <p className="text-xs text-[#565e80] mt-0.5">{label}</p>
              </Card>
            ))}
          </div>

          {/* File grid */}
          <Card>
            <h3 className="text-sm font-medium text-[#8890b4] mb-3">Dosyalar</h3>
            <FileGrid session={session} />
          </Card>
        </div>

        {/* Right: metadata + actions */}
        <div className="space-y-4">
          {/* Device chart */}
          {pieData.length > 0 && (
            <Card>
              <h3 className="text-sm font-medium text-[#8890b4] mb-3">Cihaz Dağılımı</h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={DEVICE_COLORS[entry.name] ?? "#565e80"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#13161f", border: "1px solid #252840", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DEVICE_COLORS[d.name] ?? "#565e80" }} />
                    <span className="text-[#8890b4] flex-1">{d.name}</span>
                    <span className="text-[#565e80]">{d.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* GPS info */}
          {session.has_gps && (
            <Card>
              <h3 className="text-sm font-medium text-[#8890b4] mb-2">Konum</h3>
              {session.files.find((f) => f.has_gps) ? (
                <div className="text-xs text-[#565e80] space-y-1">
                  {session.files.filter((f) => f.has_gps).slice(0, 3).map((f, i) => (
                    <div key={i} className="font-mono">
                      {f.gps_lat?.toFixed(5)}, {f.gps_lon?.toFixed(5)}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          )}

          {/* Target path editor */}
          <Card>
            <h3 className="text-sm font-medium text-[#8890b4] mb-2">Hedef Yol</h3>
            <input
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className="w-full bg-[#0d0f18] border border-[#252840] focus:border-[#6c8cff] rounded px-3 py-1.5 text-xs text-[#e8eaf6] outline-none font-mono"
            />
            {previewTargets.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-[#8a91b1]">Ornek hedefler (ilk 3 dosya):</p>
                {previewTargets.map((target, idx) => (
                  <p key={`${target}-${idx}`} className="text-[11px] text-[#7a82a3] font-mono break-all">
                    {idx + 1}. {target}
                  </p>
                ))}
              </div>
            )}
          </Card>

          {/* Move vs Copy toggle */}
          <Card padded={false} className="p-4">
            <h3 className="text-sm font-medium text-[#8890b4] mb-3">İşlem Türü</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setUseMove(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                  !useMove ? "bg-[rgba(108,140,255,0.15)] border-[rgba(108,140,255,0.4)] text-[#6c8cff]" : "border-[#252840] text-[#565e80] hover:border-[#363b60]"
                }`}
              >
                <Copy size={12} /> Kopyala
              </button>
              <button
                onClick={() => setUseMove(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                  useMove ? "bg-[rgba(240,178,58,0.15)] border-[rgba(240,178,58,0.4)] text-[#f0b23a]" : "border-[#252840] text-[#565e80] hover:border-[#363b60]"
                }`}
              >
                <Move size={12} /> Taşı
              </button>
            </div>
            {settings.operations.dry_run_first && (
              <p className="text-xs text-[#565e80] mt-2 text-center">⚠ Ön izleme modu aktif</p>
            )}
          </Card>

          {/* Execute */}
          <Button
            variant="primary"
            className="w-full"
            icon={useMove ? <Move size={14} /> : <Copy size={14} />}
            loading={running}
            disabled={running || !settings.hdd_root}
            onClick={() => void runOperation()}
          >
            {settings.operations.dry_run_first ? (useMove ? "Onizleme + Tasi" : "Onizleme + Kopyala") : useMove ? "Taşı" : "Kopyala"}
          </Button>

          {/* Result */}
          {result && (
            <Card className={result.success ? "border-[rgba(61,214,140,0.35)]" : "border-[rgba(224,82,82,0.35)]"}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCheck size={14} className={result.success ? "text-[#3dd68c]" : "text-[#e05252]"} />
                <span className="text-sm font-medium text-[#e8eaf6]">
                  {result.dry_run ? "Simülasyon" : result.success ? "Başarılı" : "Bazı Hatalar"}
                </span>
              </div>
              <p className="text-xs text-[#565e80]">{result.moved.length} işlendi, {result.failed.length} hata</p>
              {result.success && result.moved.length > 0 && (
                <div className="mt-2 rounded-md border border-[rgba(61,214,140,0.22)] bg-[rgba(61,214,140,0.08)] px-2 py-2">
                  <p className="text-[11px] text-[#9dddbf] mb-1">Olusturulan klasorler:</p>
                  {Array.from(
                    new Set(result.moved.map((p) => p.replace(/[\\/][^\\/]+$/, "")).filter(Boolean))
                  )
                    .slice(0, 5)
                    .map((folder, idx) => (
                      <p key={`${folder}-${idx}`} className="text-[11px] text-[#7fd0ab] font-mono break-all">
                        {idx + 1}. {folder}
                      </p>
                    ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
