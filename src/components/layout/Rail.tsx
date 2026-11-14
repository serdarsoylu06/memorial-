import { NavLink } from "react-router-dom";
import { LayoutGrid, Inbox, CircleHelp, FolderOpen, Copy, Settings } from "lucide-react";
import { useInboxStore } from "../../store/useInboxStore";

export default function Rail() {
  const scanResult = useInboxStore((s) => s.scanResult);
  const inboxCount = scanResult?.total_files ?? 0;
  const reviewCount = scanResult?.unclassified?.length ?? 0;

  const items = [
    { to: "/", icon: LayoutGrid, label: "Genel bakış", count: 0 },
    { to: "/inbox", icon: Inbox, label: "Gelen", count: inboxCount },
    { to: "/review", icon: CircleHelp, label: "İnceleme", count: reviewCount },
    { to: "/archive", icon: FolderOpen, label: "Arşiv", count: 0 },
    { to: "/duplicates", icon: Copy, label: "Kopyalar", count: 0 },
    { to: "/settings", icon: Settings, label: "Ayarlar", count: 0 },
  ];

  return (
    <aside className="w-14 lg:w-48 shrink-0 flex flex-col border-r border-edge">
      <div className="h-12 flex items-center px-4 border-b border-edge">
        <span className="display text-xl hidden lg:block">Memorial</span>
        <span className="display text-xl lg:hidden" aria-hidden>
          M
        </span>
      </div>

      <nav aria-label="Bölümler" className="flex-1 py-3 px-2 space-y-0.5">
        {items.map(({ to, icon: Icon, label, count }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            className={({ isActive }) =>
              `flex items-center gap-3 h-9 px-2.5 rounded-sm transition-colors ${
                isActive
                  ? "bg-table text-paper font-medium"
                  : "text-dim hover:text-paper hover:bg-table/60"
              }`
            }
          >
            <Icon size={17} strokeWidth={1.75} className="shrink-0" />
            <span className="hidden lg:block flex-1">{label}</span>
            {count > 0 && (
              <span className="hidden lg:block condensed text-[13px] text-dim">
                {count.toLocaleString("tr-TR")}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
