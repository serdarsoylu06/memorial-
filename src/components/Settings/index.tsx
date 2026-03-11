import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../store/useAppStore";
import DeviceRulesEditor from "./DeviceRulesEditor";
import LocationEditor from "./LocationEditor";
import LogViewer from "./LogViewer";
import { FolderOpen } from "lucide-react";

export default function SettingsPanel() {
  const { settings, setSettings } = useAppStore();
  const [saved, setSaved] = useState(false);

  const pickHddRoot = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setSettings({ hdd_root: selected });
    }
  };

  const handleSave = () => {
    // TODO: Persist settings via Tauri FS or store
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* HDD Path */}
      <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#e8eaf0] mb-1">HDD Kök Dizini</p>
        <p className="text-xs text-[#8b92a9] mb-3">exFAT HDD'nizin bağlandığı dizini seçin</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.hdd_root}
            onChange={(e) => setSettings({ hdd_root: e.target.value })}
            placeholder="/Volumes/MyHDD"
            className="flex-1 bg-[#242736] border border-[#2e3347] text-[#e8eaf0] text-xs rounded-lg px-3 py-2 outline-none focus:border-[#6c8cff]/50"
          />
          <button
            type="button"
            onClick={() => void pickHddRoot()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] hover:text-[#e8eaf0] transition-colors text-xs"
          >
            <FolderOpen size={13} />
            Gözat
          </button>
        </div>
      </div>

      {/* Operations */}
      <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-[#e8eaf0]">İşlem Ayarları</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8b92a9] mb-1">Varsayılan Mod</label>
            <select
              value={settings.operations.default_mode}
              onChange={(e) =>
                setSettings({ operations: { ...settings.operations, default_mode: e.target.value as "copy" | "move" } })
              }
              className="w-full bg-[#242736] border border-[#2e3347] text-[#e8eaf0] text-xs rounded-lg px-3 py-2 outline-none"
            >
              <option value="copy">Kopyala</option>
              <option value="move">Taşı</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#8b92a9] mb-1">Oturum Boşluğu (saat)</label>
            <input
              type="number"
              min={1}
              max={24}
              value={settings.operations.session_gap_hours}
              onChange={(e) =>
                setSettings({ operations: { ...settings.operations, session_gap_hours: Number(e.target.value) } })
              }
              className="w-full bg-[#242736] border border-[#2e3347] text-[#e8eaf0] text-xs rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.operations.dry_run_first}
            onChange={(e) =>
              setSettings({ operations: { ...settings.operations, dry_run_first: e.target.checked } })
            }
            className="accent-[#6c8cff]"
          />
          <span className="text-xs text-[#e8eaf0]">
            İşlemden önce önizle (Dry Run)
          </span>
        </label>
      </div>

      {/* Device rules */}
      <DeviceRulesEditor />

      {/* Location editor */}
      <LocationEditor />

      {/* Log viewer */}
      <LogViewer />

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6c8cff] text-white hover:bg-[#5a7aff] transition-colors"
        >
          {saved ? "Kaydedildi ✓" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
