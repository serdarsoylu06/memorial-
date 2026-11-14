/**
 * Örnek veri modu: uygulamayı disk ve Tauri olmadan tarayıcıda açmak için.
 * Yalnızca `npm run dev:demo` ile (VITE_DEMO=1) yüklenir; gerçek derlemeye girmez.
 */
import { mockIPC } from "@tauri-apps/api/mocks";
import { useAppStore } from "../store/useAppStore";
import { useInboxStore } from "../store/useInboxStore";
import type {
  ArchiveFolder,
  ArchiveStats,
  DuplicatePair,
  FileOpResult,
  MediaFile,
  MediaFolderHint,
  ScanResult,
  Session,
} from "../types";

const ROOT = "/Volumes/ARSIV-HDD";

function swatch(seed: number): string {
  const tones = ["#6d7f86", "#8a7d68", "#59665a", "#9a8f86", "#4f5b6b", "#7b6f62"];
  const a = tones[seed % tones.length];
  const b = tones[(seed * 7 + 3) % tones.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><rect width="60" height="40" fill="${a}"/><rect y="${22 + (seed % 9)}" width="60" height="40" fill="${b}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function stamp(base: string, minutes: number): string {
  const d = new Date(new Date(base).getTime() + minutes * 60_000);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function files(opts: {
  folder: string;
  count: number;
  prefix: string;
  ext: string;
  device: string;
  date: string;
  gps?: boolean;
  video?: boolean;
  thumbs?: boolean;
  start?: number;
  /** Dosyaların yayıldığı süre, dakika; verilmezse hepsi aynı anda çekilmiş olur. */
  spread?: number;
}): MediaFile[] {
  return Array.from({ length: opts.count }, (_, i) => {
    const num = String((opts.start ?? 1) + i).padStart(4, "0");
    const filename = `${opts.prefix}${num}.${opts.ext}`;
    return {
      path: `${ROOT}/INBOX/${opts.folder}/${filename}`,
      filename,
      size_bytes: opts.video ? 480_000_000 : 31_000_000,
      created_at: stamp(opts.date, opts.spread ? (opts.spread * i) / Math.max(1, opts.count - 1) : 0),
      device: opts.device,
      has_gps: !!opts.gps,
      gps_lat: opts.gps ? 40.5601 + i * 0.0003 : null,
      gps_lon: opts.gps ? 38.4412 + i * 0.0002 : null,
      kind: opts.video ? "video" : "photo",
      sidecars: [],
      thumbnail: opts.thumbs ? swatch(i + opts.count) : undefined,
    };
  });
}

const sessions: Session[] = [
  {
    id: "s1",
    files: [
      ...files({ folder: "kumbet", count: 38, prefix: "DSC0", ext: "ARW", device: "Sony_a6700", date: "2024-06-14T09:12:00", spread: 95 }),
      ...files({ folder: "kumbet", count: 9, prefix: "IMG_", ext: "HEIC", device: "iPhone", date: "2024-06-14T14:50:00", gps: true, spread: 170 }),
      ...files({ folder: "kumbet", count: 4, prefix: "C", ext: "MP4", device: "Sony_a6700", date: "2024-06-14T12:05:00", video: true, spread: 20 }),
    ],
    date_start: "2024-06-14T09:12:00",
    date_end: "2024-06-14T17:48:00",
    devices: ["Sony_a6700", "iPhone"],
    confidence: "high",
    suggested_path: "ARCHIVE/2024/2024-06-14_Kumbet-Yaylasi",
    has_gps: true,
  },
  {
    id: "s2",
    files: files({ folder: "haziran", count: 23, prefix: "IMG_", ext: "JPG", device: "iPhone", date: "2024-06-03T18:20:00", gps: true, thumbs: true, start: 4410, spread: 8800 }),
    date_start: "2024-06-03T18:20:00",
    date_end: "2024-06-09T21:02:00",
    devices: ["iPhone"],
    confidence: "high",
    suggested_path: "ARCHIVE/2024/EVERYDAY/2024-06",
    has_gps: true,
  },
  {
    id: "s3",
    files: [
      ...files({ folder: "istanbul", count: 112, prefix: "IMG_", ext: "CR2", device: "Canon_6D", date: "2024-08-14T11:00:00", start: 7001, spread: 3300 }),
      ...files({ folder: "istanbul", count: 6, prefix: "MVI_", ext: "MOV", device: "Canon_6D", date: "2024-08-15T15:30:00", video: true, start: 7200, spread: 60 }),
    ],
    date_start: "2024-08-14T11:00:00",
    date_end: "2024-08-16T19:30:00",
    devices: ["Canon_6D"],
    confidence: "medium",
    suggested_path: "ARCHIVE/2024/2024-08-14_Istanbul-Yemek-Festivali",
    has_gps: false,
  },
  {
    id: "s4",
    files: files({ folder: "eski-kart", count: 5, prefix: "P10", ext: "JPG", device: "Unknown_Device", date: "2019-01-01T00:00:00", start: 201 }),
    date_start: "2019-01-01T00:00:00",
    date_end: "2019-01-01T00:00:00",
    devices: ["Unknown_Device"],
    confidence: "low",
    suggested_path: "ARCHIVE/2019/EVERYDAY/2019-01",
    has_gps: false,
  },
];

const unclassified: MediaFile[] = [
  { path: `${ROOT}/INBOX/taramalar/scan_0012.png`, filename: "scan_0012.png", size_bytes: 2_400_000, created_at: null, device: "Unknown", has_gps: false, gps_lat: null, gps_lon: null, kind: "photo", sidecars: [] },
  { path: `${ROOT}/INBOX/eski/VID_20180811.mp4`, filename: "VID_20180811.mp4", size_bytes: 184_000_000, created_at: "2018-08-11T14:02:00", device: "Unknown", has_gps: false, gps_lat: null, gps_lon: null, kind: "video", sidecars: [] },
  { path: `${ROOT}/INBOX/eski/IMG_2291.JPG`, filename: "IMG_2291.JPG", size_bytes: 5_100_000, created_at: null, device: "Samsung_Note8", has_gps: true, gps_lat: 40.91, gps_lon: 38.39, kind: "photo", sidecars: [] },
];

const scan: ScanResult = {
  total_files: sessions.reduce((sum, s) => sum + s.files.length, 0) + unclassified.length,
  sessions,
  unclassified,
};

const stats: ArchiveStats = {
  total_photos: 12480,
  total_videos: 932,
  total_size_bytes: 1_420_000_000_000,
  folder_count: 214,
};

function folder(name: string, parent: string, file_count: number, children: ArchiveFolder[] = [], extra: Partial<ArchiveFolder> = {}): ArchiveFolder {
  return { name, path: `${parent}/${name}`, children, file_count, has_manifest: false, has_edits: false, ...extra };
}

const A = `${ROOT}/ARCHIVE`;
const tree: ArchiveFolder = {
  name: "ARCHIVE",
  path: A,
  file_count: 0,
  has_manifest: false,
  has_edits: false,
  children: [
    folder("2023", A, 0, [
      folder("EVERYDAY", `${A}/2023`, 0, [
        folder("2023-11", `${A}/2023/EVERYDAY`, 184),
        folder("2023-12", `${A}/2023/EVERYDAY`, 96),
      ]),
      folder("2023-10-29_Cumhuriyet-Bayrami", `${A}/2023`, 412, [], { has_manifest: true }),
    ]),
    folder("2024", A, 0, [
      folder("EVERYDAY", `${A}/2024`, 0, [
        folder("2024-04", `${A}/2024/EVERYDAY`, 143),
        folder("2024-05", `${A}/2024/EVERYDAY`, 201),
      ]),
      folder("2024-05-19_Giresun-Adasi", `${A}/2024`, 268, [], { has_manifest: true, has_edits: true }),
      folder("2024-04-06_Kumbet-Yaylasi", `${A}/2024`, 157, [], { has_manifest: true }),
    ]),
  ],
};

const duplicates: DuplicatePair[] = [
  { original: `${A}/2024/2024-05-19_Giresun-Adasi/Photos/Sony_a6700/DSC00412.ARW`, duplicate: `${A}/2024/EVERYDAY/2024-05/Photos/Sony_a6700/DSC00412.ARW`, match_type: "exact", similarity: 1 },
  { original: `${A}/2023/2023-10-29_Cumhuriyet-Bayrami/Photos/iPhone/IMG_3381.HEIC`, duplicate: `${A}/2023/EVERYDAY/2023-11/Photos/iPhone/IMG_3381_edit.JPG`, match_type: "perceptual", similarity: 0.94 },
];

const hints: MediaFolderHint[] = [];

export function installDemo() {
  const params = new URLSearchParams(location.search);

  // Disk seçilmemişse örnek diski seç; ?theme=light ile açık tema denenebilir
  const app = useAppStore.getState();
  if (!app.settings.hdd_root) app.setSettings({ hdd_root: ROOT });
  const theme = params.get("theme");
  if (theme === "light" || theme === "dark") {
    app.setSettings({ ui: { ...app.settings.ui, theme } });
  }

  // ?scanned ile açılırsa tarama yapılmış gibi başlar (oturum sayfalarına doğrudan girmek için)
  if (params.has("scanned")) {
    useInboxStore.getState().setScanResult(scan);
    if (params.get("scanned") === "approved") useInboxStore.getState().approveSession("s2");
  }

  mockIPC(
    (cmd, payload) => {
      const args = (payload ?? {}) as Record<string, unknown>;
      switch (cmd) {
        case "check_path_exists":
          return true;
        case "get_disk_usage":
          return { total_bytes: 2_000_000_000_000, free_bytes: 580_000_000_000, used_bytes: 1_420_000_000_000 };
        case "get_folder_size":
          return 9_800_000_000;
        case "get_archive_stats":
          return stats;
        case "scan_inbox":
          return scan;
        case "get_media_folder_hints":
          return hints;
        case "get_review_files":
          return unclassified;
        case "get_archive_tree":
          return tree;
        case "check_duplicates":
          return duplicates;
        case "get_thumbnails": {
          // Örnek modda RAW dışındaki karelere renkli bir yer tutucu verilir.
          const paths = (args.paths as string[]) ?? [];
          return paths.map((path, i) => (/\.(arw|cr2)$/i.test(path) ? null : swatch(path.length + i)));
        }
        case "delete_file":
          return null;
        case "init_folder_structure":
          return [];
        case "copy_files":
        case "move_files": {
          const pairs = (args.files as [string, string][]) ?? [];
          const result: FileOpResult = {
            success: true,
            moved: pairs.map(([, dst]) => dst),
            failed: [],
            dry_run: !!args.dryRun,
          };
          return result;
        }
        case "plugin:dialog|open":
          return ROOT;
        default:
          console.warn("[demo] karşılığı olmayan komut:", cmd, args);
          return null;
      }
    },
    { shouldMockEvents: true }
  );
}
