use serde::{Deserialize, Serialize};

use super::analyzer::{DeviceType, MediaFile};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassifyResult {
    pub device: DeviceType,
    pub is_everyday: bool,
    pub suggested_folder: String,
    pub confidence: String,
}

/// Classify a single media file by device and location.
///
/// Uses:
///   - EXIF model/make fields
///   - Filename prefix patterns from devices.yaml
///   - GPS bbox matching against locations.yaml
#[tauri::command]
pub async fn classify_file(file: MediaFile) -> Result<ClassifyResult, String> {
    // TODO: Load devices.yaml rules
    // TODO: Match file EXIF model against device rules
    // TODO: Match GPS coordinates against location bboxes
    // TODO: Fall back to filename prefix matching
    // TODO: Return confidence score
    let _ = file;
    Ok(ClassifyResult {
        device: DeviceType::Unknown,
        is_everyday: false,
        suggested_folder: String::new(),
        confidence: "none".to_string(),
    })
}
