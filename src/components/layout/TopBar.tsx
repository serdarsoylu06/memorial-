import { useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { useInboxStore } from "../../store/useInboxStore";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "INBOX Analizi",
  "/review": "İnceleme Kuyruğu",
  "/archive": "Arşiv Tarayıcısı",
  "/duplicates": "Kopya Yönetimi",
  "/settings": "Ayarlar",
};

export default function TopBar() {
  const { pathname } = useLocation();
  const { scanResult } = useInboxStore();
  const inboxCount = scanResult?.total_files ?? 0;

  const title =
    Object.entries(pageTitles).find(([path]) =>
      path === "/" ? pathname === "/" : pathname.startsWith(path)
    )?.[1] ?? "Memorial";

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-[#1a1d27] border-b border-[#2e3347] shrink-0">
      <h1 className="text-sm font-semibold text-[#e8eaf0]">{title}</h1>

      <div className="flex items-center gap-3">
        {inboxCount > 0 && (
          <span className="text-xs bg-[#6c8cff]/20 text-[#6c8cff] px-2 py-0.5 rounded-full font-medium">
            {inboxCount} dosya bekliyor
          </span>
        )}
        <button
          type="button"
          className="p-2 rounded-lg text-[#8b92a9] hover:bg-[#242736] hover:text-[#e8eaf0] transition-colors relative"
          aria-label="Bildirimler"
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
