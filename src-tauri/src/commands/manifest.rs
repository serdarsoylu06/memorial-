use serde::{Deserialize, Serialize};
use std::path::Path;

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
pub struct SourceLink {
    pub archive_path: String,
    pub edited_files: Vec<String>,
}

/// Write a _manifest.json to the given archive folder.
#[tauri::command]
pub async fn write_manifest(folder_path: String, manifest: Manifest) -> Result<(), String> {
    let dir = Path::new(&folder_path);
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Cannot create folder {folder_path}: {e}"))?;

    let manifest_path = dir.join("_manifest.json");
    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Serialization error: {e}"))?;
    std::fs::write(&manifest_path, json)
        .map_err(|e| format!("Write error: {e}"))?;

    Ok(())
}

/// Read the _manifest.json from an archive folder.
#[tauri::command]
pub async fn read_manifest(folder_path: String) -> Result<Option<Manifest>, String> {
    let manifest_path = Path::new(&folder_path).join("_manifest.json");
    if !manifest_path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Read error: {e}"))?;
    let manifest: Manifest =
        serde_json::from_str(&content).map_err(|e| format!("Parse error: {e}"))?;
    Ok(Some(manifest))
}

/// Write a _source.json to an EDITS event folder, linking back to the ARCHIVE source.
#[tauri::command]
pub async fn write_source_json(folder_path: String, source: SourceLink) -> Result<(), String> {
    let dir = Path::new(&folder_path);
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Cannot create folder {folder_path}: {e}"))?;

    let source_path = dir.join("_source.json");
    let json = serde_json::to_string_pretty(&source)
        .map_err(|e| format!("Serialization error: {e}"))?;
    std::fs::write(&source_path, json)
        .map_err(|e| format!("Write error: {e}"))?;

    Ok(())
}

/// Read the _source.json from an EDITS event folder.
#[tauri::command]
pub async fn read_source_json(folder_path: String) -> Result<Option<SourceLink>, String> {
    let source_path = Path::new(&folder_path).join("_source.json");
    if !source_path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&source_path)
        .map_err(|e| format!("Read error: {e}"))?;
    let source: SourceLink =
        serde_json::from_str(&content).map_err(|e| format!("Parse error: {e}"))?;
    Ok(Some(source))
}
