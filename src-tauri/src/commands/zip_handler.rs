use super::zip_safety::{extract, LIMITS};
use std::path::Path;

/// Extract into a fresh STAGING import directory with bounded streaming.
#[tauri::command]
pub async fn extract_zip(zip_path: String, staging_dir: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        extract(Path::new(&zip_path), Path::new(&staging_dir), LIMITS)
    })
    .await
    .map_err(|e| format!("ZIP task failed: {e}"))?
}
