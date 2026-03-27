use serde::{Deserialize, Serialize};

use super::analyzer::{device_type_name, DeviceType, MediaFile};
use super::utils::ascii_value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassifyResult {
    pub device: DeviceType,
    pub is_everyday: bool,
    pub suggested_folder: String,
    pub confidence: String,
}

/// Classify a single media file by device using EXIF Make/Model.
#[tauri::command]
pub async fn classify_file(file: MediaFile) -> Result<ClassifyResult, String> {
    tokio::task::spawn_blocking(move || {
        use exif::{In, Reader as ExifReader, Tag};
        use std::fs::File;
        use std::io::BufReader;

        let path = std::path::Path::new(&file.path);
        let mut make: Option<String> = None;
        let mut model: Option<String> = None;

        if let Ok(f) = File::open(path) {
            let mut br = BufReader::new(f);
            if let Ok(exif_data) = ExifReader::new().read_from_container(&mut br) {
                make = exif_data
                    .get_field(Tag::Make, In::PRIMARY)
                    .and_then(|f| ascii_value(f));
                model = exif_data
                    .get_field(Tag::Model, In::PRIMARY)
                    .and_then(|f| ascii_value(f));
            }
        }

        let (device, is_everyday, confidence) = match (make.as_deref(), model.as_deref()) {
            (Some(mk), Some(md)) => {
                let mk_l = mk.to_lowercase();
                let md_l = md.to_lowercase();
                if mk_l.contains("sony") && md_l.contains("ilce-6700") {
                    (DeviceType::SonyA6700, false, "high")
                } else if mk_l.contains("canon") && md_l.contains("60d") {
                    (DeviceType::Canon60D, false, "high")
                } else if mk_l.contains("canon") && md_l.contains("6d") {
                    (DeviceType::Canon6D, false, "high")
                } else if mk_l.contains("apple") && md_l.contains("iphone") {
                    (DeviceType::IPhone, true, "high")
                } else if mk_l.contains("samsung") && md_l.contains("sm-n950") {
                    (DeviceType::SamsungNote8, true, "high")
                } else if mk_l.contains("sony")
                    || mk_l.contains("canon")
                    || mk_l.contains("apple")
                    || mk_l.contains("samsung")
                {
                    (DeviceType::Unknown, false, "medium")
                } else {
                    (DeviceType::Unknown, false, "low")
                }
            }
            (Some(_), None) => (DeviceType::Unknown, false, "medium"),
            _ => (DeviceType::Unknown, false, "low"),
        };

        let suggested_folder = device_type_name(&device).to_string();

        Ok(ClassifyResult {
            device,
            is_everyday,
            suggested_folder,
            confidence: confidence.to_string(),
        })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
