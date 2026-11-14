import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * Oturum boyunca saklanan küçük resimler: yol → veri adresi, ya da üretilemediyse null.
 * Kalıcı önbellek arka uçta, diskte tutulur; burası yalnızca aynı kareyi iki kez istememek için.
 */
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<void>>();
const BATCH = 24;

async function load(paths: string[]): Promise<void> {
  const wanted = paths.filter((p) => !cache.has(p) && !pending.has(p));
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const request = invoke<(string | null)[]>("get_thumbnails", { paths: batch })
      .then((urls) => {
        batch.forEach((path, index) => cache.set(path, urls[index] ?? null));
      })
      .catch(() => {
        // Bir sonraki istekte yeniden denenebilsin diye önbelleğe yazılmaz.
      })
      .finally(() => {
        batch.forEach((path) => pending.delete(path));
      });
    batch.forEach((path) => pending.set(path, request));
  }
  await Promise.all(paths.map((p) => pending.get(p)).filter(Boolean));
}

/**
 * Verilen dosyaların küçük resimlerini ister ve geldikçe döndürür.
 * Yalnızca ekranda görünen kareleri verin; her kare diskten okunur.
 */
export function useThumbnails(paths: string[]): Record<string, string | null | undefined> {
  const key = paths.join("\n");
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (paths.length === 0) return;
    let alive = true;
    void load(paths).then(() => {
      if (alive) setVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
    // `key`, `paths` dizisinin içeriğini temsil eder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const result: Record<string, string | null | undefined> = {};
  for (const path of paths) result[path] = cache.get(path);
  return result;
}
