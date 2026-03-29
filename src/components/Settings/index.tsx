import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, Sliders, MapPin, Copy, Save, FileText, FolderPlus } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import Card from "../ui/Card";
import Button from "../ui/Button";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#6c8cff]">{icon}</span>
        <h2 className="text-sm font-semibold text-[#8890b4] uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1a1d2e] last:border-b-0">
      <span className="text-sm text-[#8890b4]">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { settings, setSettings } = useAppStore();
  const [saved, setSaved] = useState(false);
  const [initStatus, setInitStatus] = useState<string | null>(null);

  const pickHDDRoot = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setSettings({ hdd_root: selected });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const save = () => {
    // Settings are already in Zustand (in-memory). Show save confirmation.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf6]">Ayarlar</h1>
          <p className="text-sm text-[#565e80] mt-0.5">Uygulama yapılandırması</p>
        </div>
        <Button
          variant={saved ? "success" : "primary"}
          size="sm"
          icon={<Save size={14} />}
          onClick={save}
        >
          {saved ? "Kaydedildi ✓" : "Kaydet"}
        </Button>
      </div>

      {/* HDD */}
      <Section title="Depolama" icon={<HardDrive size={15} />}>
        <Card>
          <LabeledRow label="HDD Kök Yolu">
            <span className="text-xs text-[#565e80] font-mono truncate max-w-[200px]">
              {settings.hdd_root || "Seçilmedi"}
            </span>
            <Button variant="outline" size="sm" onClick={() => void pickHDDRoot()}>
              Seç
            </Button>
          </LabeledRow>
          <LabeledRow label="ARCHIVE Klasörü">
            <input
              value={settings.archive_dir}
              onChange={(e) => setSettings({ archive_dir: e.target.value })}
              className="bg-[#0d0f18] border border-[#252840] rounded px-2 py-1 text-xs text-[#e8eaf6] outline-none w-28 font-mono"
            />
          </LabeledRow>
          <LabeledRow label="INBOX Klasörü">
            <span className="text-xs text-[#565e80] font-mono truncate max-w-[200px]" title={settings.inbox_dir}>
              {settings.inbox_dir || "Seçilmedi"}
            </span>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const selected = await open({ directory: true, multiple: false });
                if (selected && typeof selected === "string") {
                  setSettings({ inbox_dir: selected });
                }
              } catch (err) { console.error(err); }
            }}>
              Seç
            </Button>
          </LabeledRow>
          <LabeledRow label="REVIEW Klasörü">
            <input
              value={settings.review_dir}
              onChange={(e) => setSettings({ review_dir: e.target.value })}
              className="bg-[#0d0f18] border border-[#252840] rounded px-2 py-1 text-xs text-[#e8eaf6] outline-none w-28 font-mono"
            />
          </LabeledRow>
          <div className="pt-3 border-t border-[#1a1d2e]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#8890b4]">Klasör Yapısını Oluştur</p>
                <p className="text-xs text-[#565e80] mt-0.5">
                  INBOX, ARCHIVE, EDITS, REVIEW, STAGING klasörlerini HDD kökünde oluşturur
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<FolderPlus size={14} />}
                disabled={!settings.hdd_root}
                onClick={async () => {
                  try {
                    const dirs = [
                      settings.inbox_dir.startsWith("/") ? "" : settings.inbox_dir,
                      settings.archive_dir,
                      settings.edits_dir,
                      settings.review_dir,
                      settings.staging_dir,
                    ].filter(Boolean);
                    const created = await invoke<string[]>("init_folder_structure", {
                      hddRoot: settings.hdd_root,
                      dirs,
                    });
                    setInitStatus(
                      created.length > 0
                        ? `${created.length} klasör oluşturuldu ✓`
                        : "Tüm klasörler zaten mevcut ✓"
                    );
                    setTimeout(() => setInitStatus(null), 3000);
                  } catch (err) {
                    setInitStatus(`Hata: ${err}`);
                    setTimeout(() => setInitStatus(null), 4000);
                  }
                }}
              >
                Oluştur
              </Button>
            </div>
            {initStatus && (
              <p className={`text-xs mt-2 ${initStatus.startsWith("Hata") ? "text-red-400" : "text-[#3dd68c]"}`}>
                {initStatus}
              </p>
            )}
          </div>
        </Card>
      </Section>

      {/* Operations */}
      <Section title="İşlem Ayarları" icon={<Sliders size={15} />}>
        <Card>
          <LabeledRow label="Varsayılan İşlem">
            <div className="flex gap-1.5">
              <button
                onClick={() => setSettings({ operations: { ...settings.operations, default_mode: "copy" } })}
                className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
                  settings.operations.default_mode === "copy"
                    ? "bg-[rgba(108,140,255,0.15)] border-[rgba(108,140,255,0.4)] text-[#6c8cff]"
                    : "border-[#252840] text-[#565e80]"
                }`}
              >Kopyala</button>
              <button
                onClick={() => setSettings({ operations: { ...settings.operations, default_mode: "move" } })}
                className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
                  settings.operations.default_mode === "move"
                    ? "bg-[rgba(240,178,58,0.15)] border-[rgba(240,178,58,0.4)] text-[#f0b23a]"
                    : "border-[#252840] text-[#565e80]"
                }`}
              >Taşı</button>
            </div>
          </LabeledRow>
          <LabeledRow label="Ön İzleme Modu">
            <button
              onClick={() => setSettings({ operations: { ...settings.operations, dry_run_first: !settings.operations.dry_run_first } })}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings.operations.dry_run_first ? "bg-[#6c8cff]" : "bg-[#252840]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.operations.dry_run_first ? "left-5" : "left-0.5"}`} />
            </button>
          </LabeledRow>
          <LabeledRow label="Oturum Aralığı (saat)">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={12}
                value={settings.operations.session_gap_hours}
                onChange={(e) => setSettings({ operations: { ...settings.operations, session_gap_hours: Number(e.target.value) } })}
                className="w-24 accent-[#6c8cff]"
              />
              <span className="text-xs text-[#e8eaf6] w-6 text-right">{settings.operations.session_gap_hours}s</span>
            </div>
          </LabeledRow>
        </Card>
      </Section>

      {/* GPS / Location */}
      <Section title="Konum (Giresun)" icon={<MapPin size={15} />}>
        <Card>
          <LabeledRow label="Enlem Aralığı">
            <span className="text-xs text-[#565e80] font-mono">40.85 – 41.15</span>
          </LabeledRow>
          <LabeledRow label="Boylam Aralığı">
            <span className="text-xs text-[#565e80] font-mono">38.25 – 38.55</span>
          </LabeledRow>
          <LabeledRow label="GPS Korelasyon Penceresi">
            <span className="text-xs text-[#565e80] font-mono">±30 dakika</span>
          </LabeledRow>
        </Card>
      </Section>

      {/* Duplicates */}
      <Section title="Kopya Tespiti" icon={<Copy size={15} />}>
        <Card>
          <LabeledRow label="SHA256 Kontrolü">
            <button
              onClick={() => setSettings({ duplicates: { ...settings.duplicates, sha256_check: !settings.duplicates.sha256_check } })}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings.duplicates.sha256_check ? "bg-[#6c8cff]" : "bg-[#252840]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.duplicates.sha256_check ? "left-5" : "left-0.5"}`} />
            </button>
          </LabeledRow>
          <LabeledRow label="Algısal Hash (pHash)">
            <button
              onClick={() => setSettings({ duplicates: { ...settings.duplicates, phash_check: !settings.duplicates.phash_check } })}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings.duplicates.phash_check ? "bg-[#6c8cff]" : "bg-[#252840]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.duplicates.phash_check ? "left-5" : "left-0.5"}`} />
            </button>
          </LabeledRow>
          <LabeledRow label="pHash Eşiği">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={20}
                value={settings.duplicates.phash_threshold}
                onChange={(e) => setSettings({ duplicates: { ...settings.duplicates, phash_threshold: Number(e.target.value) } })}
                className="w-24 accent-[#6c8cff]"
              />
              <span className="text-xs text-[#e8eaf6] w-6 text-right">{settings.duplicates.phash_threshold}</span>
            </div>
          </LabeledRow>
        </Card>
      </Section>

      {/* Log dir */}
      <Section title="Günlük Ayarları" icon={<FileText size={15} />}>
        <Card>
          <LabeledRow label="Log Klasörü">
            <span className="text-xs text-[#565e80] font-mono">{settings.log_dir}</span>
          </LabeledRow>
          <LabeledRow label="Dil">
            <select
              value={settings.ui.language}
              onChange={(e) => setSettings({ ui: { ...settings.ui, language: e.target.value } })}
              className="bg-[#0d0f18] border border-[#252840] rounded px-2 py-1 text-xs text-[#e8eaf6] outline-none"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </LabeledRow>
        </Card>
      </Section>
    </div>
  );
}
