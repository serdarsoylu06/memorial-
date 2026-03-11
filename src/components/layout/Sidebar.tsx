import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  GitMerge,
  FolderOpen,
  Copy,
  Settings,
  HardDrive,
} from "lucide-react";
import { useHDDStatus } from "../../hooks/useHDDStatus";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inbox", icon: Inbox, label: "INBOX" },
  { to: "/review", icon: GitMerge, label: "Review" },
  { to: "/archive", icon: FolderOpen, label: "Arşiv" },
  { to: "/duplicates", icon: Copy, label: "Kopyalar" },
  { to: "/settings", icon: Settings, label: "Ayarlar" },
];

export default function Sidebar() {
  const hdd = useHDDStatus();

  return (
    <aside className="w-16 lg:w-56 flex flex-col bg-[#1a1d27] border-r border-[#2e3347] shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#2e3347]">
        <span className="text-[#6c8cff] font-bold text-lg hidden lg:block">Memorial</span>
        <span className="text-[#6c8cff] font-bold text-lg lg:hidden">M</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[#6c8cff]/15 text-[#6c8cff] font-medium"
                  : "text-[#8b92a9] hover:bg-[#242736] hover:text-[#e8eaf0]"
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* HDD Status */}
      <div className="px-3 py-4 border-t border-[#2e3347]">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className={hdd.connected ? "text-[#4caf82]" : "text-[#8b92a9]"} />
          <span className="hidden lg:block text-xs text-[#8b92a9] truncate">
            {hdd.connected ? hdd.label ?? "Bağlı" : "HDD Bağlı Değil"}
          </span>
        </div>
      </div>
    </aside>
  );
}
