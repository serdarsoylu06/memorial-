import fs from "node:fs";
import path from "node:path";

const dist = path.join(process.cwd(), "dist");
const manifestPath = path.join(dist, ".vite", "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json not found. Run: npx vite build --manifest");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const fileSize = (f) => fs.statSync(path.join(dist, f)).size;

const collect = (key, seen = new Set()) => {
  if (seen.has(key) || !manifest[key]) return seen;
  seen.add(key);
  const m = manifest[key];
  for (const i of m.imports || []) collect(i, seen);
  return seen;
};

const sizeFromKeys = (keys) =>
  keys.reduce((total, k) => total + fileSize(manifest[k].file), 0);

const entryKey =
  Object.keys(manifest).find(
    (k) => manifest[k].isEntry && k.endsWith("src/main.tsx")
  ) || Object.keys(manifest).find((k) => k.includes("index.html"));

const coreSet = collect(entryKey);

const pages = [
  "src/pages/DashboardPage.tsx",
  "src/pages/InboxPage.tsx",
  "src/pages/SessionDetailPage.tsx",
  "src/pages/ReviewPage.tsx",
  "src/pages/ArchivePage.tsx",
  "src/pages/DuplicatesPage.tsx",
  "src/pages/SettingsPage.tsx",
];

// Pre-optimization baseline from earlier single-bundle production build.
const baselineKb = 596.43;
const baselineBytes = baselineKb * 1024;

const rows = [];
for (const pageKey of pages) {
  const pageSet = collect(pageKey);
  const combined = new Set([...coreSet, ...pageSet]);
  const bytes = sizeFromKeys([...combined]);
  const gainBytes = baselineBytes - bytes;

  rows.push({
    page: pageKey.split("/").pop().replace(".tsx", ""),
    payloadKb: Number((bytes / 1024).toFixed(2)),
    gainKb: Number((gainBytes / 1024).toFixed(2)),
    gainPct: Number(((gainBytes / baselineBytes) * 100).toFixed(2)),
  });
}

rows.sort((a, b) => b.gainKb - a.gainKb);

const result = {
  baselineKb,
  coreShellKb: Number((sizeFromKeys([...coreSet]) / 1024).toFixed(2)),
  rows,
};

console.log(JSON.stringify(result, null, 2));
