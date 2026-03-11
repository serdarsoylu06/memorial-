import { useState } from "react";
import ReviewFilters from "./ReviewFilters";
import { useInboxStore } from "../../store/useInboxStore";
import { formatBytes, formatDate } from "../../utils/formatters";
import { Image, Film } from "lucide-react";

export default function ReviewQueue() {
  const [filter, setFilter] = useState("all");
  const { scanResult } = useInboxStore();
  const files = scanResult?.unclassified ?? [];

  const filteredFiles = files.filter((f) => {
    if (filter === "all") return true;
    if (filter === "no_exif") return !f.created_at;
    if (filter === "unknown_device") return f.device === "Unknown";
    return true;
  });

  return (
    <div className="space-y-5">
      <ReviewFilters activeFilter={filter} onFilterChange={setFilter} />

      {filteredFiles.length === 0 ? (
        <div className="text-center py-16 text-sm text-[#8b92a9]">
          İnceleme kuyruğu boş. 🎉
        </div>
      ) : (
        <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2e3347]">
                <th className="text-left px-4 py-3 text-[#8b92a9] font-medium">Dosya</th>
                <th className="text-left px-4 py-3 text-[#8b92a9] font-medium">Cihaz</th>
                <th className="text-left px-4 py-3 text-[#8b92a9] font-medium">Tarih</th>
                <th className="text-right px-4 py-3 text-[#8b92a9] font-medium">Boyut</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((f) => (
                <tr key={f.path} className="border-b border-[#2e3347] last:border-0 hover:bg-[#242736] transition-colors">
                  <td className="px-4 py-3 flex items-center gap-2">
                    {f.kind === "video" ? (
                      <Film size={14} className="text-[#6c8cff] shrink-0" />
                    ) : (
                      <Image size={14} className="text-[#8b92a9] shrink-0" />
                    )}
                    <span className="text-[#e8eaf0] truncate max-w-[200px]">{f.filename}</span>
                  </td>
                  <td className="px-4 py-3 text-[#8b92a9]">{f.device}</td>
                  <td className="px-4 py-3 text-[#8b92a9]">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3 text-right text-[#8b92a9]">{formatBytes(f.size_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
