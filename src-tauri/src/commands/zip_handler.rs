/// Extract a ZIP archive to the STAGING directory.
///
/// Applies the same INBOX pipeline after extraction.
#[tauri::command]
pub async fn extract_zip(zip_path: String, staging_dir: String) -> Result<Vec<String>, String> {
    // TODO: Open ZIP file using the zip crate
    // TODO: Extract all entries to staging_dir
    // TODO: Skip __MACOSX and .DS_Store entries
    // TODO: Return list of extracted file paths for downstream processing
    let _ = (zip_path, staging_dir);
    Ok(vec![])
}
