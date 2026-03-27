use serde::{Deserialize, Serialize};
use super::utils::ascii_value;

/// Detected device type from EXIF or filename patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeviceType {
    #[serde(rename = "Sony_a6700")]
    SonyA6700,
    #[serde(rename = "Canon_6D")]
    Canon6D,
    #[serde(rename = "Canon_60D")]
    Canon60D,
    #[serde(rename = "iPhone")]
    IPhone,
    #[serde(rename = "Samsung_Note8")]
    SamsungNote8,
    #[serde(rename = "Unknown")]
    Unknown,
}

/// Location confidence signal level
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    High,
    Medium,
    Low,
    None,
}

/// Represents a media file with its metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFile {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: Option<String>,
    pub device: DeviceType,
    pub has_gps: bool,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,
    pub kind: String,
    pub thumbnail: Option<String>,
}

/// A detected session: group of files captured within the same time window
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

/// Result of an INBOX scan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_files: usize,
    pub sessions: Vec<Session>,
    pub unclassified: Vec<MediaFile>,
}

/// File operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOpResult {
    pub success: bool,
    pub moved: Vec<String>,
    pub failed: Vec<String>,
    pub dry_run: bool,
}

/// Duplicate detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicatePair {
    pub original: String,
    pub duplicate: String,
    pub match_type: String,
    pub similarity: f32,
}

// ── EXIF helpers ────────────────────────────────────────────────────────────

fn rational_to_f64(r: &exif::Rational) -> f64 {
    r.num as f64 / r.denom as f64
}

fn dms_to_decimal(field: &exif::Field) -> Option<f64> {
    if let exif::Value::Rational(ref v) = field.value {
        if v.len() >= 3 {
            let deg = rational_to_f64(&v[0]);
            let min = rational_to_f64(&v[1]);
            let sec = rational_to_f64(&v[2]);
            return Some(deg + min / 60.0 + sec / 3600.0);
        }
    }
    None
}

fn detect_device(make: Option<&str>, model: Option<&str>) -> DeviceType {
    match (make, model) {
        (Some(mk), Some(md)) => {
            let mk = mk.to_lowercase();
            let md = md.to_lowercase();
            if mk.contains("sony") && md.contains("ilce-6700") {
                DeviceType::SonyA6700
            } else if mk.contains("canon") && md.contains("60d") {
                DeviceType::Canon60D
            } else if mk.contains("canon") && md.contains("6d") {
                DeviceType::Canon6D
            } else if mk.contains("apple") && md.contains("iphone") {
                DeviceType::IPhone
            } else if mk.contains("samsung") && md.contains("sm-n950") {
                DeviceType::SamsungNote8
            } else {
                DeviceType::Unknown
            }
        }
        _ => DeviceType::Unknown,
    }
}

pub fn device_type_name(device: &DeviceType) -> &'static str {
    match device {
        DeviceType::SonyA6700 => "Sony_a6700",
        DeviceType::Canon6D => "Canon_6D",
        DeviceType::Canon60D => "Canon_60D",
        DeviceType::IPhone => "iPhone",
        DeviceType::SamsungNote8 => "Samsung_Note8",
        DeviceType::Unknown => "Unknown",
    }
}

fn build_session(files: Vec<(chrono::NaiveDateTime, MediaFile)>) -> Session {
    let has_gps = files.iter().any(|(_, f)| f.has_gps);
    let confidence = if has_gps {
        Confidence::High
    } else {
        Confidence::Medium
    };

    let mut devices: Vec<String> = Vec::new();
    for (_, f) in &files {
        let name = device_type_name(&f.device).to_string();
        if !devices.contains(&name) {
            devices.push(name);
        }
    }

    let event_date = files
        .first()
        .map(|(dt, _)| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default();
    let year = files
        .first()
        .map(|(dt, _)| dt.format("%Y").to_string())
        .unwrap_or_default();
    let device_slug = devices.first().cloned().unwrap_or_else(|| "unknown".to_string());

    let date_start = files
        .first()
        .map(|(dt, _)| dt.format("%Y-%m-%dT%H:%M:%S").to_string());
    let date_end = files
        .last()
        .map(|(dt, _)| dt.format("%Y-%m-%dT%H:%M:%S").to_string());

    let id = format!("{event_date}-{device_slug}");
    let suggested_path = format!("ARCHIVE/{year}/{event_date}");
    let media_files: Vec<MediaFile> = files.into_iter().map(|(_, f)| f).collect();

    Session {
        id,
        files: media_files,
        date_start,
        date_end,
        devices,
        confidence,
        suggested_path,
        has_gps,
    }
}

// ── Command ──────────────────────────────────────────────────────────────────

/// Scan the INBOX directory and detect sessions/files.
#[tauri::command]
pub async fn scan_inbox(inbox_path: String) -> Result<ScanResult, String> {
    tokio::task::spawn_blocking(move || scan_inbox_sync(&inbox_path))
        .await
        .map_err(|e| format!("Task join error: {e}"))?
}

fn scan_inbox_sync(inbox_path: &str) -> Result<ScanResult, String> {
    use chrono::NaiveDateTime;
    use exif::{In, Reader as ExifReader, Tag};
    use std::fs::File;
    use std::io::BufReader;
    use walkdir::WalkDir;

    const SUPPORTED: &[&str] = &[
        "jpg", "jpeg", "png", "arw", "cr2", "cr3", "mp4", "mov", "heic",
    ];

    let mut timed: Vec<(NaiveDateTime, MediaFile)> = Vec::new();
    let mut unclassified: Vec<MediaFile> = Vec::new();

    for entry in WalkDir::new(inbox_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !SUPPORTED.contains(&ext.as_str()) {
            continue;
        }

        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let kind = if ext == "mp4" || ext == "mov" {
            "video"
        } else {
            "photo"
        };

        let mut datetime: Option<NaiveDateTime> = None;
        let mut device = DeviceType::Unknown;
        let mut gps_lat: Option<f64> = None;
        let mut gps_lon: Option<f64> = None;
        let mut has_gps = false;

        if let Ok(file) = File::open(path) {
            let mut br = BufReader::new(file);
            if let Ok(exif_data) = ExifReader::new().read_from_container(&mut br) {
                // DateTime
                if let Some(field) = exif_data.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
                    if let Some(s) = ascii_value(field) {
                        datetime = NaiveDateTime::parse_from_str(&s, "%Y:%m:%d %H:%M:%S").ok();
                    }
                }

                // Device
                let make = exif_data
                    .get_field(Tag::Make, In::PRIMARY)
                    .and_then(|f| ascii_value(f));
                let model = exif_data
                    .get_field(Tag::Model, In::PRIMARY)
                    .and_then(|f| ascii_value(f));
                device = detect_device(make.as_deref(), model.as_deref());

                // GPS
                let lat_f = exif_data.get_field(Tag::GPSLatitude, In::PRIMARY);
                let lat_ref = exif_data.get_field(Tag::GPSLatitudeRef, In::PRIMARY);
                let lon_f = exif_data.get_field(Tag::GPSLongitude, In::PRIMARY);
                let lon_ref = exif_data.get_field(Tag::GPSLongitudeRef, In::PRIMARY);

                if let (Some(lf), Some(lof)) = (lat_f, lon_f) {
                    if let (Some(lat), Some(lon)) = (dms_to_decimal(lf), dms_to_decimal(lof)) {
                        let south = lat_ref
                            .and_then(|f| ascii_value(f))
                            .map(|s| s.starts_with('S'))
                            .unwrap_or(false);
                        let west = lon_ref
                            .and_then(|f| ascii_value(f))
                            .map(|s| s.starts_with('W'))
                            .unwrap_or(false);
                        gps_lat = Some(if south { -lat } else { lat });
                        gps_lon = Some(if west { -lon } else { lon });
                        has_gps = true;
                    }
                }
            }
        }

        let mf = MediaFile {
            path: path.to_string_lossy().to_string(),
            filename: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size_bytes: metadata.len(),
            created_at: datetime.map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string()),
            device,
            has_gps,
            gps_lat,
            gps_lon,
            kind: kind.to_string(),
            thumbnail: None,
        };

        if let Some(dt) = datetime {
            timed.push((dt, mf));
        } else {
            unclassified.push(mf);
        }
    }

    timed.sort_by_key(|(dt, _)| *dt);
    let total_files = timed.len() + unclassified.len();

    // Group into sessions: gap > 2 hours → new session
    let mut sessions: Vec<Session> = Vec::new();
    let mut current: Vec<(NaiveDateTime, MediaFile)> = Vec::new();

    for (dt, mf) in timed {
        if let Some((last_dt, _)) = current.last() {
            let gap = (dt - *last_dt).num_seconds();
            if gap > 2 * 3600 {
                sessions.push(build_session(std::mem::take(&mut current)));
            }
        }
        current.push((dt, mf));
    }
    if !current.is_empty() {
        sessions.push(build_session(current));
    }

    Ok(ScanResult {
        total_files,
        sessions,
        unclassified,
    })
}
