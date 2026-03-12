import { useState } from "react";
import type { Session } from "../../types";
import FileGrid from "./FileGrid";
import DeviceChart from "./DeviceChart";
import { confidenceColor, confidenceLabel, formatDate } from "../../utils/formatters";
import { Edit2, Check } from "lucide-react";

interface SessionDetailProps {
  session: Session;
}

export default function SessionDetail({ session }: SessionDetailProps) {
  const [path, setPath] = useState(session.suggested_path);
  const [editing, setEditing] = useState(false);
  const [tempPath, setTempPath] = useState(path);

  const handleSave = () => {
    setPath(tempPath);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-[#8b92a9] mb-1">
              {formatDate(session.date_start)}
              {session.date_end && session.date_end !== session.date_start
                ? ` – ${formatDate(session.date_end)}`
                : ""}
            </p>
            <p className="text-sm text-[#8b92a9]">{session.files.length} dosya</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColor(session.confidence)}`}>
            {confidenceLabel(session.confidence)}
          </span>
        </div>

        {/* Editable path */}
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="text"
                value={tempPath}
                onChange={(e) => setTempPath(e.target.value)}
                className="flex-1 text-xs bg-[#242736] border border-[#6c8cff]/50 text-[#e8eaf0] rounded-lg px-3 py-1.5 outline-none"
              />
              <button type="button" onClick={handleSave} className="p-1.5 rounded-lg bg-[#4caf82]/10 text-[#4caf82] hover:bg-[#4caf82]/20 transition-colors">
                <Check size={14} />
              </button>
            </>
          ) : (
            <>
              <code className="flex-1 text-xs text-[#6c8cff] bg-[#6c8cff]/10 px-3 py-1.5 rounded-lg truncate">{path || "—"}</code>
              <button type="button" onClick={() => { setTempPath(path); setEditing(true); }} className="p-1.5 rounded-lg bg-[#242736] text-[#8b92a9] hover:bg-[#2e3347] hover:text-[#e8eaf0] transition-colors">
                <Edit2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Device chart + file grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
          <DeviceChart files={session.files} />
        </div>
        <div className="lg:col-span-2 bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
          <p className="text-xs text-[#8b92a9] uppercase tracking-wider mb-3">Dosyalar</p>
          <FileGrid files={session.files} />
        </div>
      </div>
    </div>
  );
}
