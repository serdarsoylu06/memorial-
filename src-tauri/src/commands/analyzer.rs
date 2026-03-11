use serde::{Deserialize, Serialize};

/// Detected device type from EXIF or filename patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeviceType {
    SonyA6700,
    Canon6D,
    Canon60D,
    IPhone,
    SamsungNote8,
    Unknown,
}

/// Location confidence signal level
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Manifest stored in each archive event folder
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

/// Scan the INBOX directory and detect sessions/files.
///
/// Signal layers applied:
///   Layer 1 → Own EXIF metadata
///   Layer 2 → Folder name parsing
///   Layer 3 → Neighbour file GPS (iPhone photo from same session)
///   Layer 4 → Time correlation (GPS from files within ±30 min)
///   Layer 5 → Device behaviour pattern
#[tauri::command]
pub async fn scan_inbox(inbox_path: String) -> Result<ScanResult, String> {
    // TODO: Walk inbox_path with walkdir
    // TODO: For each file, read EXIF via kamadak-exif
    // TODO: Group files into sessions by time gap (default: 2 hours)
    // TODO: Apply multi-signal detection layers
    // TODO: Calculate confidence score for each session
    // TODO: Build suggested archive path for each session
    let _ = inbox_path;
    Ok(ScanResult {
        total_files: 0,
        sessions: vec![],
        unclassified: vec![],
    })
}
