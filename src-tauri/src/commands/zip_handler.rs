use std::io;
use std::path::Path;
use zip::ZipArchive;

/// Extract a ZIP archive to the STAGING directory.
/// Skips __MACOSX and .DS_Store entries.
#[tauri::command]
pub async fn extract_zip(
    zip_path: String,
    staging_dir: String,
) -> Result<Vec<String>, String> {
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| format!("Cannot open ZIP {zip_path}: {e}"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Invalid ZIP: {e}"))?;

    std::fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("Cannot create staging dir: {e}"))?;

    let mut extracted: Vec<String> = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("ZIP entry error: {e}"))?;
        let raw_name = entry.name().to_string();

        // Skip macOS noise
        if raw_name.starts_with("__MACOSX/")
            || raw_name.contains(".DS_Store")
            || raw_name.starts_with('.')
        {
            continue;
        }

        let out_path = Path::new(&staging_dir).join(&raw_name);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Cannot create dir: {e}"))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Cannot create parent dir: {e}"))?;
            }
            let mut out_file = std::fs::File::create(&out_path)
                .map_err(|e| format!("Cannot create file: {e}"))?;
            io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("Write error: {e}"))?;
            extracted.push(out_path.to_string_lossy().to_string());
        }
    }

    Ok(extracted)
}
