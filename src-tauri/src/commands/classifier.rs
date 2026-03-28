use serde::{Deserialize, Serialize};
use super::analyzer::{DeviceType, MediaFile};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassifyResult {
    pub device: DeviceType,
    pub is_everyday: bool,
    pub suggested_folder: String,
    pub confidence: String,
}

const GIRESUN_LAT_MIN: f64 = 40.85;
const GIRESUN_LAT_MAX: f64 = 41.15;
const GIRESUN_LON_MIN: f64 = 38.25;
const GIRESUN_LON_MAX: f64 = 38.55;

fn is_in_giresun(lat: f64, lon: f64) -> bool {
    lat >= GIRESUN_LAT_MIN
        && lat <= GIRESUN_LAT_MAX
        && lon >= GIRESUN_LON_MIN
        && lon <= GIRESUN_LON_MAX
}

/// Classify a single media file by device and location.
#[tauri::command]
pub async fn classify_file(file: MediaFile) -> Result<ClassifyResult, String> {
    let is_everyday = match (file.gps_lat, file.gps_lon) {
        (Some(lat), Some(lon)) => is_in_giresun(lat, lon),
        _ => false,
    };

    let confidence = if file.has_gps {
        "high"
    } else {
        "none"
    };

    let device_folder = file.device.folder_name();
    let suggested_folder = if is_everyday {
        format!("EVERYDAY/{}", device_folder)
    } else {
        format!("REVIEW/{}", device_folder)
    };

    Ok(ClassifyResult {
        device: file.device,
        is_everyday,
        suggested_folder,
        confidence: confidence.to_string(),
    })
}
