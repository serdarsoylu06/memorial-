// ─── Core Media Types ──────────────────────────────────────────────────────────

export type DeviceType =
  | "Sony_a6700"
  | "Canon_6D"
  | "Canon_60D"
  | "iPhone"
  | "Samsung_Note8"
  | "Unknown";

export type Confidence = "high" | "medium" | "low" | "none" | "High" | "Medium" | "Low" | "None";

export type FileKind = "photo" | "video" | "unknown";

export interface MediaFile {
  path: string;
  filename: string;
  size_bytes: number;
  created_at: string | null;
  device: DeviceType;
  has_gps: boolean;
  gps_lat: number | null;
  gps_lon: number | null;
  kind: FileKind;
  thumbnail?: string; // base64 data URL
}

// ─── Session Types ──────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  files: MediaFile[];
  date_start: string | null;
  date_end: string | null;
  devices: string[];
  confidence: Confidence;
  suggested_path: string;
  has_gps: boolean;
}

export interface ScanResult {
  total_files: number;
  sessions: Session[];
  unclassified: MediaFile[];
}

// ─── Manifest & Source Link ─────────────────────────────────────────────────────

export interface Manifest {
  event: string;
  date: string;
  devices: string[];
  photo_count: number;
  video_count: number;
  location_source: string;
  confidence: string;
  created_at: string;
}

export interface SourceLink {
  archive_path: string;
  edited_files: string[];
}

// ─── Duplicate Types ────────────────────────────────────────────────────────────

export type MatchType = "exact" | "perceptual";

export interface DuplicatePair {
  original: string;
  duplicate: string;
  match_type: MatchType;
  similarity: number;
}

// ─── File Operations ────────────────────────────────────────────────────────────

export interface FileOpResult {
  success: boolean;
  moved: string[];
  failed: string[];
  dry_run: boolean;
}

// ─── Archive Stats ───────────────────────────────────────────────────────────────

export interface ArchiveStats {
  total_photos: number;
  total_videos: number;
  total_size_bytes: number;
  folder_count: number;
}

// ─── Archive Browser ────────────────────────────────────────────────────────────

export interface ArchiveFolder {
  name: string;
  path: string;
  children: ArchiveFolder[];
  file_count: number;
  has_manifest: boolean;
  has_edits: boolean;
}

// ─── App Settings ───────────────────────────────────────────────────────────────

export interface AppSettings {
  hdd_root: string;
  archive_dir: string;
  edits_dir: string;
  inbox_dir: string;
  review_dir: string;
  staging_dir: string;
  log_dir: string;
  operations: {
    default_mode: "copy" | "move";
    dry_run_first: boolean;
    session_gap_hours: number;
    max_files_per_folder: number;
  };
  duplicates: {
    sha256_check: boolean;
    phash_check: boolean;
    phash_threshold: number;
  };
  ui: {
    theme: "dark" | "light";
    language: string;
  };
}

// ─── UI State ────────────────────────────────────────────────────────────────────

export interface HDDStatus {
  connected: boolean;
  path: string | null;
  label: string | null;
  total_bytes: number | null;
  free_bytes: number | null;
}

export interface SessionLog {
  id: string;
  date: string;
  operations: number;
  files_moved: number;
  files_copied: number;
  errors: number;
}
