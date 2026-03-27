use std::path::Path;

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

/// Write a `_manifest.json` to the given archive folder.
#[tauri::command]
pub async fn write_manifest(folder_path: String, manifest: Manifest) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let dir = Path::new(&folder_path);
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory: {e}"))?;
        let json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("Serialization error: {e}"))?;
        std::fs::write(dir.join("_manifest.json"), json)
            .map_err(|e| format!("Write error: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

/// Read the `_manifest.json` from an archive folder.
#[tauri::command]
pub async fn read_manifest(folder_path: String) -> Result<Option<Manifest>, String> {
    tokio::task::spawn_blocking(move || {
        let path = Path::new(&folder_path).join("_manifest.json");
        if !path.exists() {
            return Ok(None);
        }
        let contents = std::fs::read_to_string(&path)
            .map_err(|e| format!("Read error: {e}"))?;
        let manifest: Manifest = serde_json::from_str(&contents)
            .map_err(|e| format!("Deserialize error: {e}"))?;
        Ok(Some(manifest))
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

// Suppress unused import warning – Utc is used in tests / future callers
const _: fn() = || {
    let _ = Utc::now();
};
