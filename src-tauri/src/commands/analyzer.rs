use chrono::{DateTime, Duration, NaiveDateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;
use walkdir::WalkDir;

// ─── YAML Device Rules ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct DeviceRule {
    pub exif_model: Option<Vec<String>>,
    pub exif_make: Option<Vec<String>>,
    pub filename_prefix: Option<Vec<String>>,
    pub video_codec: Option<Vec<String>>,
    pub color_profile: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DevicesConfig {
    pub devices: HashMap<String, DeviceRule>,
}

/// Detect device by matching EXIF / filename against YAML rules.
/// Priority: exif_model → exif_make → filename_prefix.
fn detect_device(
    rules: &HashMap<String, DeviceRule>,
    make: &str,
    model: &str,
    filename: &str,
) -> String {
    let make_lc = make.to_lowercase();
    let model_lc = model.to_lowercase();
    let fname_lc = filename.to_lowercase();

    // Pass 1: exif_model match (most specific)
    for (key, rule) in rules {
        if let Some(models) = &rule.exif_model {
            for m in models {
                if model_lc.contains(&m.to_lowercase()) {
                    return key.clone();
                }
            }
        }
    }

    // Pass 2: exif_make match
    for (key, rule) in rules {
        if let Some(makes) = &rule.exif_make {
            for m in makes {
                if make_lc.contains(&m.to_lowercase()) {
                    return key.clone();
                }
            }
        }
    }

    // Pass 3: filename_prefix match (only if EXIF was empty)
    if make.is_empty() && model.is_empty() {
        for (key, rule) in rules {
            if let Some(prefixes) = &rule.filename_prefix {
                for p in prefixes {
                    if fname_lc.starts_with(&p.to_lowercase()) {
                        return key.clone();
                    }
                }
            }
        }
    }

    "Unknown_Device".to_string()
}

/// Helper: does this device name likely carry GPS? (phone-class devices)
fn device_carries_gps(device: &str) -> bool {
    let d = device.to_lowercase();
    d.contains("iphone") || d.contains("samsung")
}

// ─── Confidence ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum Confidence {
    High,
    Medium,
    Low,
    None,
}

// ─── Data Structures ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFile {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: Option<String>,
    pub device: String,
    pub has_gps: bool,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub kind: String, // "photo" | "video" | "unknown"
    pub sidecars: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub files: Vec<MediaFile>,
    pub date_start: Option<String>,
    pub date_end: Option<String>,
    pub devices: Vec<String>,
    pub confidence: Confidence,
    pub suggested_path: String,
    pub has_gps: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_files: usize,
    pub sessions: Vec<Session>,
    pub unclassified: Vec<MediaFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub event: String,
    pub date: String,
    pub devices: Vec<String>,
    pub photo_count: u32,
    pub video_count: u32,
    pub location_source: String,
    pub confidence: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOpResult {
    pub success: bool,
    pub moved: Vec<String>,
    pub failed: Vec<String>,
    pub dry_run: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicatePair {
    pub original: String,
    pub duplicate: String,
    pub match_type: String,
    pub similarity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveStats {
    pub total_photos: u64,
    pub total_videos: u64,
    pub total_size_bytes: u64,
    pub folder_count: u64,
}

// ─── EXIF Helpers ───────────────────────────────────────────────────────────────

static PHOTO_EXTS: &[&str] = &["jpg", "jpeg", "heic", "png", "cr2", "arw", "nef", "dng", "tiff", "tif"];
static VIDEO_EXTS: &[&str] = &["mp4", "mov", "avi", "mts", "m2ts", "mkv", "m4v"];

fn file_kind(ext: &str) -> &'static str {
    let ext = ext.to_lowercase();
    if PHOTO_EXTS.iter().any(|e| *e == ext.as_str()) {
        "photo"
    } else if VIDEO_EXTS.iter().any(|e| *e == ext.as_str()) {
        "video"
    } else {
        "unknown"
    }
}

fn is_media_file(ext: &str) -> bool {
    let ext = ext.to_lowercase();
    PHOTO_EXTS.iter().any(|e| *e == ext.as_str())
        || VIDEO_EXTS.iter().any(|e| *e == ext.as_str())
}

/// Convert GPS rational values (degrees, minutes, seconds) to decimal degrees.
fn gps_rational_to_decimal(deg: f64, min: f64, sec: f64, ref_char: char) -> f64 {
    let mut decimal = deg + min / 60.0 + sec / 3600.0;
    if ref_char == 'S' || ref_char == 'W' {
        decimal = -decimal;
    }
    decimal
}

fn parse_gps_coord(value: &exif::Value) -> Option<(f64, f64, f64)> {
    if let exif::Value::Rational(rats) = value {
        if rats.len() >= 3 {
            let deg = rats[0].num as f64 / rats[0].denom as f64;
            let min = rats[1].num as f64 / rats[1].denom as f64;
            let sec = rats[2].num as f64 / rats[2].denom as f64;
            return Some((deg, min, sec));
        }
    }
    None
}

fn parse_datetime(s: &str) -> Option<DateTime<Utc>> {
    // EXIF format: "2024:06:14 15:30:00"
    NaiveDateTime::parse_from_str(s, "%Y:%m:%d %H:%M:%S")
        .ok()
        .map(|ndt| Utc.from_utc_datetime(&ndt))
}

// ─── YAML Location Rules ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct GpsBbox {
    pub lat: [f64; 2],
    pub lon: [f64; 2],
}

#[derive(Debug, Clone, Deserialize)]
pub struct LocationRule {
    pub gps_bbox: GpsBbox,
    pub label: Option<String>,
    #[serde(default)]
    pub adaptive_split: HashMap<String, u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LocationsConfig {
    pub everyday_locations: HashMap<String, LocationRule>,
    #[serde(default)]
    pub correlation: HashMap<String, serde_yaml::Value>,
}

fn match_gps_location(
    locations: &HashMap<String, LocationRule>,
    lat: f64,
    lon: f64,
) -> Option<String> {
    for (name, rule) in locations {
        let bb = &rule.gps_bbox;
        if lat >= bb.lat[0] && lat <= bb.lat[1] && lon >= bb.lon[0] && lon <= bb.lon[1] {
            return Some(name.clone());
        }
    }
    None
}

// ─── Camera Noise Folder Detection ──────────────────────────────────────────────

/// Returns true if a folder name is camera/system-generated noise that
/// should NOT be treated as an event name.
fn is_noise_folder(name: &str) -> bool {
    let n = name.to_uppercase();
    // Well-known camera/system folders
    let known_noise = [
        "DCIM", "PRIVATE", "AVCHD", "BDMV", "STREAM", "CLIPINF",
        "BACKUP", "MISC", "CANONMSC", "SONYCARD", "MP_ROOT",
        "AVF_INFO", "__MACOSX", ".TRASHES", ".SPOTLIGHT-V100",
        "INBOX", "STAGING", "REVIEW",
    ];
    if known_noise.iter().any(|k| n == *k) {
        return true;
    }
    // Camera roll folders: 3+ digits followed by letters (100CANON, 101MSDCF, 100ANDRO, etc.)
    if n.len() >= 4 {
        let digits: usize = n.chars().take_while(|c| c.is_ascii_digit()).count();
        if digits >= 3 && digits < n.len() {
            return true;
        }
    }
    // Purely numeric folders
    if name.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }
    false
}

/// Parse a single media file from disk, extracting metadata and EXIF.
fn parse_media_file(path: &Path, rules: &HashMap<String, DeviceRule>) -> Option<MediaFile> {
    let ext = path.extension()?.to_str()?;
    if !is_media_file(ext) {
        return None;
    }

    let metadata = std::fs::metadata(path).ok()?;
    let size_bytes = metadata.len();
    let filename = path.file_name()?.to_str()?.to_string();
    let kind = file_kind(ext).to_string();

    let mut created_at: Option<String> = None;
    let mut make_str = String::new();
    let mut model_str = String::new();
    let mut gps_lat: Option<f64> = None;
    let mut gps_lon: Option<f64> = None;

    // Only attempt EXIF for photo formats
    if PHOTO_EXTS.iter().any(|e| *e == ext.to_lowercase().as_str()) {
        if let Ok(file) = std::fs::File::open(path) {
            let mut bufreader = std::io::BufReader::new(file);
            if let Ok(exif_reader) = exif::Reader::new().read_from_container(&mut bufreader) {
                // DateTimeOriginal
                if let Some(field) = exif_reader.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY) {
                    created_at = Some(field.display_value().to_string());
                }
                // Make + Model
                make_str = exif_reader
                    .get_field(exif::Tag::Make, exif::In::PRIMARY)
                    .map(|f| f.display_value().to_string())
                    .unwrap_or_default();
                model_str = exif_reader
                    .get_field(exif::Tag::Model, exif::In::PRIMARY)
                    .map(|f| f.display_value().to_string())
                    .unwrap_or_default();

                // GPS
                let lat_ref = exif_reader
                    .get_field(exif::Tag::GPSLatitudeRef, exif::In::PRIMARY)
                    .map(|f| f.display_value().to_string().chars().next().unwrap_or('N'));
                let lon_ref = exif_reader
                    .get_field(exif::Tag::GPSLongitudeRef, exif::In::PRIMARY)
                    .map(|f| f.display_value().to_string().chars().next().unwrap_or('E'));

                let lat_coord = exif_reader
                    .get_field(exif::Tag::GPSLatitude, exif::In::PRIMARY)
                    .and_then(|f| parse_gps_coord(&f.value));
                let lon_coord = exif_reader
                    .get_field(exif::Tag::GPSLongitude, exif::In::PRIMARY)
                    .and_then(|f| parse_gps_coord(&f.value));

                if let (Some((dlat, mlat, slat)), Some(lref)) = (lat_coord, lat_ref) {
                    gps_lat = Some(gps_rational_to_decimal(dlat, mlat, slat, lref));
                }
                if let (Some((dlon, mlon, slon)), Some(lref)) = (lon_coord, lon_ref) {
                    gps_lon = Some(gps_rational_to_decimal(dlon, mlon, slon, lref));
                }
            }
        }
    }

    // Detect device using YAML rules (EXIF + filename fallback)
    let device = detect_device(rules, &make_str, &model_str, &filename);

    // Timestamp fallback from filesystem
    if created_at.is_none() {
        if let Ok(modified) = metadata.modified() {
            let dt: DateTime<Utc> = modified.into();
            created_at = Some(dt.format("%Y:%m:%d %H:%M:%S").to_string());
        }
    }

    // Find sidecar files (.aae, .xmp, .thm) with the same stem
    let sidecars = {
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        let sidecar_exts: &[&str] = &["aae", "xmp", "thm"];
        let mut found: Vec<String> = Vec::new();
        if let Some(parent) = path.parent() {
            if let Ok(entries) = std::fs::read_dir(parent) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let ep = entry.path();
                    if !ep.is_file() {
                        continue;
                    }
                    let e_stem = ep.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                    let e_ext = ep.extension().and_then(|s| s.to_str()).unwrap_or("");
                    if e_stem == stem
                        && sidecar_exts.iter().any(|sx| sx.eq_ignore_ascii_case(e_ext))
                    {
                        found.push(ep.to_string_lossy().to_string());
                    }
                }
            }
        }
        found
    };

    Some(MediaFile {
        path: path.to_string_lossy().to_string(),
        filename,
        size_bytes,
        created_at,
        device,
        has_gps: gps_lat.is_some() && gps_lon.is_some(),
        gps_lat,
        gps_lon,
        kind,
        sidecars,
    })
}

// ─── Session Grouping ───────────────────────────────────────────────────────────

/// Walk up from the file's parent directory to find a meaningful (non-noise)
/// event folder name. Returns None if only noise/INBOX folders are found.
fn find_meaningful_folder(file_path: &str, inbox_root: &Path) -> Option<String> {
    let mut cur = Path::new(file_path).parent()?;
    // Walk up until we hit INBOX root or filesystem root
    while cur.starts_with(inbox_root) && cur != inbox_root {
        let name = cur.file_name()?.to_str()?;
        if !is_noise_folder(name) {
            return Some(name.to_string());
        }
        cur = cur.parent()?;
    }
    None
}

/// Extract a date string (YYYY-MM-DD) from a file's created_at timestamp.
fn file_date_key(file: &MediaFile) -> String {
    file.created_at
        .as_deref()
        .and_then(|s| parse_datetime(s))
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "unknown-date".to_string())
}

fn group_into_sessions(
    files: Vec<MediaFile>,
    session_gap_hours: i64,
    inbox_root: &Path,
) -> Vec<Session> {
    if files.is_empty() {
        return vec![];
    }

    // Step 1: Build a composite grouping key per file.
    // - If file lives in a meaningful event folder → key = folder name
    // - Otherwise → key = calendar date (YYYY-MM-DD)
    // This ensures files from named folders stay together,
    // while loose/camera-dump files are split by date.
    let mut groups: HashMap<String, Vec<MediaFile>> = HashMap::new();
    for file in files {
        let folder = find_meaningful_folder(&file.path, inbox_root);
        let key = match folder {
            Some(ref name) => format!("folder::{}", name),
            None => format!("date::{}", file_date_key(&file)),
        };
        groups.entry(key).or_default().push(file);
    }

    // Step 2: Within each group, sort by timestamp and split by time gap.
    let gap = Duration::hours(session_gap_hours);
    let mut all_sessions: Vec<Session> = Vec::new();

    for (_, mut group_files) in groups {
        group_files.sort_by(|a, b| {
            a.created_at
                .as_deref()
                .unwrap_or("")
                .cmp(b.created_at.as_deref().unwrap_or(""))
        });

        let mut chunks: Vec<Vec<MediaFile>> = vec![vec![group_files.remove(0)]];

        for file in group_files {
            let last_chunk = chunks.last_mut().unwrap();
            let last_ts = last_chunk.last().and_then(|f| {
                f.created_at.as_deref().and_then(|s| parse_datetime(s))
            });
            let curr_ts = file.created_at.as_deref().and_then(|s| parse_datetime(s));

            // Split by time gap OR by different calendar day
            let should_split = match (last_ts, curr_ts) {
                (Some(lt), Some(ct)) => {
                    ct - lt > gap || lt.date_naive() != ct.date_naive()
                }
                _ => false,
            };

            if should_split {
                chunks.push(vec![file]);
            } else {
                last_chunk.push(file);
            }
        }

        for chunk in chunks {
            all_sessions.push(build_session(chunk, inbox_root));
        }
    }

    // Sort sessions by date for consistent display order
    all_sessions.sort_by(|a, b| {
        a.date_start
            .as_deref()
            .unwrap_or("")
            .cmp(b.date_start.as_deref().unwrap_or(""))
    });

    all_sessions
}

fn build_session(files: Vec<MediaFile>, inbox_root: &Path) -> Session {
    let id = Uuid::new_v4().to_string();

    let date_start = files
        .iter()
        .filter_map(|f| f.created_at.as_deref())
        .min()
        .map(String::from);
    let date_end = files
        .iter()
        .filter_map(|f| f.created_at.as_deref())
        .max()
        .map(String::from);

    // Collect unique device names
    let mut device_set: Vec<String> = files
        .iter()
        .map(|f| f.device.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    device_set.sort();

    // GPS: borrow from iPhone/Samsung if available (Layer 3/4)
    let representative_gps = files
        .iter()
        .filter(|f| f.has_gps && device_carries_gps(&f.device))
        .map(|f| (f.gps_lat, f.gps_lon))
        .next();

    let has_gps = files.iter().any(|f| f.has_gps)
        || representative_gps.is_some();

    // Load locations for GPS matching
    let locations = load_locations();

    // Determine confidence + suggested path
    let (confidence, suggested_path) =
        calculate_confidence_and_path(&files, representative_gps, date_start.as_deref(), inbox_root, &locations);

    Session {
        id,
        files,
        date_start,
        date_end,
        devices: device_set,
        confidence,
        suggested_path,
        has_gps,
    }
}

fn load_locations() -> HashMap<String, LocationRule> {
    let yaml_str = include_str!("../../../rules/locations.yaml");
    serde_yaml::from_str::<LocationsConfig>(yaml_str)
        .map(|c| c.everyday_locations)
        .unwrap_or_default()
}

// ─── Confidence + Path Logic ────────────────────────────────────────────────────

fn calculate_confidence_and_path(
    files: &[MediaFile],
    _borrowed_gps: Option<(Option<f64>, Option<f64>)>,
    date_start: Option<&str>,
    inbox_root: &Path,
    locations: &HashMap<String, LocationRule>,
) -> (Confidence, String) {
    // Check own GPS on any file
    let own_gps = files.iter().find(|f| f.has_gps);
    // Check iPhone/phone GPS borrow
    let phone_gps = files
        .iter()
        .find(|f| f.has_gps && device_carries_gps(&f.device));

    // Derive event name from folder structure (smart extraction)
    let folder_event = files
        .first()
        .and_then(|f| find_meaningful_folder(&f.path, inbox_root));

    // Resolve GPS location name from YAML
    let gps_file = own_gps.or(phone_gps);
    let location_name = gps_file.and_then(|f| {
        match (f.gps_lat, f.gps_lon) {
            (Some(lat), Some(lon)) => match_gps_location(locations, lat, lon),
            _ => None,
        }
    });

    let confidence = if gps_file.is_some() && folder_event.is_some() {
        Confidence::High
    } else if gps_file.is_some() {
        if own_gps.is_some() { Confidence::High } else { Confidence::Medium }
    } else if folder_event.is_some() {
        Confidence::Low
    } else {
        Confidence::None
    };

    let path = build_suggested_path(
        date_start,
        location_name.as_deref(),
        folder_event.as_deref(),
    );

    (confidence, path)
}

/// Strip leading date patterns from an event name to prevent duplication.
/// "2026-03-15_Wedding" → "Wedding"
/// "2026-03-Wedding" → "Wedding"
/// "Wedding" → "Wedding"
fn strip_date_prefix(name: &str) -> &str {
    // Pattern: YYYY-MM-DD_ or YYYY-MM-DD- or YYYY-MM_ or YYYY-MM-
    let bytes = name.as_bytes();
    // Try YYYY-MM-DD_ (11 chars)
    if bytes.len() > 11 && bytes[4] == b'-' && bytes[7] == b'-' {
        if let Some(rest) = name.get(10..) {
            let rest = rest.trim_start_matches(|c: char| c == '_' || c == '-');
            if !rest.is_empty() {
                return rest;
            }
        }
    }
    // Try YYYY-MM_ (8 chars)
    if bytes.len() > 8 && bytes[4] == b'-' {
        if let Some(rest) = name.get(7..) {
            let rest = rest.trim_start_matches(|c: char| c == '_' || c == '-');
            if !rest.is_empty() {
                return rest;
            }
        }
    }
    name
}

fn build_suggested_path(
    date_start: Option<&str>,
    location_name: Option<&str>,
    event_name: Option<&str>,
) -> String {
    let date = date_start
        .and_then(|s| parse_datetime(s))
        .unwrap_or_else(Utc::now);

    let yyyy = date.format("%Y").to_string();
    let yyyy_mm_dd = date.format("%Y-%m-%d").to_string();

    // Clean event name: strip any leading date to prevent "2026-03-15-2026-03-15_Wedding"
    let clean_event = event_name.map(|e| strip_date_prefix(e));

    // Priority: event name > GPS location > bare date
    match (clean_event, location_name) {
        (Some(event), Some(loc)) => {
            // Both event folder + GPS location
            format!("ARCHIVE/{}/{}_{}-{}", yyyy, yyyy_mm_dd, loc, event)
        }
        (Some(event), None) => {
            // Event folder, no GPS
            format!("ARCHIVE/{}/{}_{}", yyyy, yyyy_mm_dd, event)
        }
        (None, Some(loc)) => {
            // GPS location only, no event folder
            format!("ARCHIVE/{}/{}_{}", yyyy, yyyy_mm_dd, loc)
        }
        (None, None) => {
            // Nothing — just date
            format!("ARCHIVE/{}/{}", yyyy, yyyy_mm_dd)
        }
    }
}

// ─── GPS Borrow: Layer 3/4 ──────────────────────────────────────────────────────

/// After initial session building, retroactively fill GPS on non-GPS devices
/// by borrowing from GPS-capable devices in the same session (±30 min).
fn apply_gps_borrow(sessions: &mut Vec<Session>) {
    for session in sessions.iter_mut() {
        // Find all GPS coordinates from GPS-capable devices
        let gps_sources: Vec<(f64, f64, Option<DateTime<Utc>>)> = session
            .files
            .iter()
            .filter(|f| f.has_gps && device_carries_gps(&f.device))
            .filter_map(|f| {
                let ts = f.created_at.as_deref().and_then(|s| parse_datetime(s));
                Some((f.gps_lat?, f.gps_lon?, ts))
            })
            .collect();

        if gps_sources.is_empty() {
            continue;
        }

        // For each non-GPS file, find nearest GPS source in time
        for file in session.files.iter_mut() {
            if file.has_gps {
                continue;
            }
            let file_ts = file.created_at.as_deref().and_then(|s| parse_datetime(s));
            let best = gps_sources.iter().min_by_key(|(_, _, ts)| {
                match (file_ts, ts) {
                    (Some(ft), Some(st)) => (ft - *st).num_seconds().abs(),
                    _ => i64::MAX,
                }
            });
            if let Some((lat, lon, ts)) = best {
                let within_window = match (file_ts, ts) {
                    (Some(ft), Some(st)) => (ft - *st).num_minutes().abs() <= 30,
                    _ => true,
                };
                if within_window {
                    file.gps_lat = Some(*lat);
                    file.gps_lon = Some(*lon);
                    file.has_gps = true;
                }
            }
        }
        // Update session GPS flag
        session.has_gps = session.files.iter().any(|f| f.has_gps);
    }
}

// ─── Tauri Commands ─────────────────────────────────────────────────────────────

/// Scan the INBOX directory and detect sessions/files.
#[tauri::command]
pub async fn scan_inbox(
    inbox_path: String,
    session_gap_hours: Option<i64>,
) -> Result<ScanResult, String> {
    let gap_hours = session_gap_hours.unwrap_or(2);
    let root = Path::new(&inbox_path);

    if !root.exists() {
        return Err(format!("INBOX path does not exist: {inbox_path}"));
    }

    // Load device rules from embedded YAML
    let yaml_str = include_str!("../../../rules/devices.yaml");
    let devices_config: DevicesConfig =
        serde_yaml::from_str(yaml_str).map_err(|e| format!("devices.yaml parse error: {e}"))?;
    let rules = &devices_config.devices;

    // Walk directory, parse all media files
    let mut media_files: Vec<MediaFile> = Vec::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        // Skip hidden files and macOS noise
        let fname = entry.file_name().to_str().unwrap_or("");
        if fname.starts_with('.') || fname.starts_with("__MACOSX") {
            continue;
        }
        if let Some(file) = parse_media_file(entry.path(), rules) {
            media_files.push(file);
        }
    }

    let total_files = media_files.len();

    // Group into sessions
    let mut sessions = group_into_sessions(media_files, gap_hours, root);

    // Apply GPS borrow across sessions
    apply_gps_borrow(&mut sessions);

    // Load location rules for GPS matching
    let loc_yaml = include_str!("../../../rules/locations.yaml");
    let locations: HashMap<String, LocationRule> = serde_yaml::from_str::<LocationsConfig>(loc_yaml)
        .map(|c| c.everyday_locations)
        .unwrap_or_default();

    // Rebuild session confidence/path after GPS borrow
    for session in sessions.iter_mut() {
        let borrowed_gps = session
            .files
            .iter()
            .find(|f| f.has_gps && device_carries_gps(&f.device))
            .map(|f| (f.gps_lat, f.gps_lon));
        let (conf, path) = calculate_confidence_and_path(
            &session.files,
            borrowed_gps,
            session.date_start.as_deref(),
            root,
            &locations,
        );
        session.confidence = conf;
        session.suggested_path = path;
    }

    // Separate sessions with no confidence AND no date → unclassified.
    // Sessions with at least a valid date get promoted to Low confidence.
    for session in sessions.iter_mut() {
        if session.confidence == Confidence::None && session.date_start.is_some() {
            session.confidence = Confidence::Low;
        }
    }

    let (classified, unclassified_sessions): (Vec<_>, Vec<_>) = sessions
        .into_iter()
        .partition(|s| s.confidence != Confidence::None);

    let unclassified: Vec<MediaFile> = unclassified_sessions
        .into_iter()
        .flat_map(|s| s.files)
        .collect();

    Ok(ScanResult {
        total_files,
        sessions: classified,
        unclassified,
    })
}

/// Get statistics about the ARCHIVE directory.
#[tauri::command]
pub async fn get_archive_stats(archive_path: String) -> Result<ArchiveStats, String> {
    let root = Path::new(&archive_path);
    if !root.exists() {
        return Ok(ArchiveStats {
            total_photos: 0,
            total_videos: 0,
            total_size_bytes: 0,
            folder_count: 0,
        });
    }

    let mut total_photos: u64 = 0;
    let mut total_videos: u64 = 0;
    let mut total_size_bytes: u64 = 0;
    let mut folder_count: u64 = 0;

    for entry in WalkDir::new(root).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_dir() {
            folder_count += 1;
            continue;
        }
        let fname = entry.file_name().to_str().unwrap_or("");
        if fname.starts_with('.') {
            continue;
        }
        if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
            let kind = file_kind(ext);
            if kind == "photo" {
                total_photos += 1;
            } else if kind == "video" {
                total_videos += 1;
            }
            if let Ok(meta) = entry.metadata() {
                total_size_bytes += meta.len();
            }
        }
    }

    Ok(ArchiveStats {
        total_photos,
        total_videos,
        total_size_bytes,
        folder_count: folder_count.saturating_sub(1), // exclude root itself
    })
}
