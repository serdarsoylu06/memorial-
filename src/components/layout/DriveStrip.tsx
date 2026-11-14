import { Link } from "react-router-dom";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import { useAppStore } from "../../store/useAppStore";
import { useInboxStore } from "../../store/useInboxStore";
import { formatBytes } from "../../utils/device";

/**
 * Her ekranın üstünde duran sürücü şeridi: uygulamadaki her şey diske bağlı
 * olduğu için diskin durumu her zaman görünür.
 */
export default function DriveStrip() {
  const hdd = useHDDStatus();
  const root = useAppStore((s) => s.settings.hdd_root);
  const scanResult = useInboxStore((s) => s.scanResult);
  const waiting = scanResult?.total_files ?? 0;

  const hasUsage = hdd.total_bytes !== null && hdd.free_bytes !== null && hdd.total_bytes > 0;
  const used = hasUsage ? hdd.total_bytes! - hdd.free_bytes! : 0;
  const usedPct = hasUsage ? Math.round((used / hdd.total_bytes!) * 100) : 0;

  return (
    <header className="h-12 shrink-0 flex items-center gap-4 px-8 border-b border-edge text-[13px]">
      {hdd.connected ? (
        <>
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-done shrink-0" aria-hidden />
            <span className="font-mono truncate" title={hdd.path ?? undefined}>
              {hdd.label ?? "Disk"}
            </span>
            <span className="sr-only">bağlı</span>
          </span>

          {hasUsage && (
            <span className="flex items-center gap-3 text-dim min-w-0">
              <span
                className="w-32 h-1.5 rounded-full bg-well overflow-hidden shrink-0"
                role="img"
                aria-label={`Diskin yüzde ${usedPct} kadarı dolu`}
              >
                <span className="block h-full bg-paper" style={{ width: `${usedPct}%` }} />
              </span>
              <span className="truncate">
                {formatBytes(used)} dolu, {formatBytes(hdd.free_bytes)} boş
              </span>
            </span>
          )}
        </>
      ) : (
        <span className="flex items-center gap-2 min-w-0 text-dim">
          <span className="w-2 h-2 rounded-full border border-edge-strong shrink-0" aria-hidden />
          {root ? (
            <span className="truncate">
              <span className="font-mono text-paper">{root}</span> bağlı değil
            </span>
          ) : (
            <span>Disk seçilmedi</span>
          )}
        </span>
      )}

      <span className="flex-1" />

      {!hdd.connected && !root && (
        <Link to="/settings" className="underline underline-offset-4 hover:text-paper text-dim">
          Disk seç
        </Link>
      )}
      {hdd.connected && waiting > 0 && (
        <Link to="/inbox" className="underline underline-offset-4 decoration-edge-strong hover:decoration-paper">
          {waiting.toLocaleString("tr-TR")} dosya bekliyor
        </Link>
      )}
    </header>
  );
}
