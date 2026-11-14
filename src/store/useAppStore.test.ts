import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("restores settings after reload without restoring runtime HDD state", async () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  const { useAppStore } = await import("./useAppStore");
  const settings = useAppStore.getState().settings;
  useAppStore.getState().setSettings({ hdd_root: "/Volumes/Media", operations: { ...settings.operations, session_gap_hours: 5 } });
  useAppStore.getState().setHDDStatus({ connected: true, path: "/Volumes/Media", label: "Media", free_bytes: null, total_bytes: null });
  vi.resetModules();
  const reloaded = (await import("./useAppStore")).useAppStore.getState();
  expect(reloaded.settings.hdd_root).toBe("/Volumes/Media");
  expect(reloaded.settings.operations.session_gap_hours).toBe(5);
  expect(reloaded.hddStatus.connected).toBe(false);
});
