use chrono::Utc;
use serde::{Deserialize, Serialize};

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

/// Write a _manifest.json to the given archive folder.
#[tauri::command]
pub async fn write_manifest(folder_path: String, manifest: Manifest) -> Result<(), String> {
    // TODO: Serialize manifest to JSON
    // TODO: Write to folder_path/_manifest.json
    // TODO: Also append entry to ROOT/.memorial_logs/YYYY-MM-DD_session.json
    let _ = (folder_path, manifest);
    Ok(())
}

/// Read the _manifest.json from an archive folder.
#[tauri::command]
pub async fn read_manifest(folder_path: String) -> Result<Option<Manifest>, String> {
    // TODO: Check if folder_path/_manifest.json exists
    // TODO: Read and deserialize JSON
    // TODO: Return None if file is missing
    let _ = folder_path;
    Ok(Some(Manifest {
        event: String::new(),
        date: String::new(),
        devices: vec![],
        photo_count: 0,
        video_count: 0,
        location_source: String::new(),
        confidence: String::new(),
        created_at: Utc::now().to_rfc3339(),
    }))
}
