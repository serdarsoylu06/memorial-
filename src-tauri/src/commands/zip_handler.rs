/// Extract a ZIP archive to the staging directory.
#[tauri::command]
pub async fn extract_zip(zip_path: String, staging_dir: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        use std::io::Read;

        let file = std::fs::File::open(&zip_path)
            .map_err(|e| format!("Failed to open ZIP: {e}"))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP: {e}"))?;

        let mut extracted: Vec<String> = Vec::new();
        let staging = std::path::Path::new(&staging_dir);

        for i in 0..archive.len() {
            let mut entry = archive
                .by_index(i)
                .map_err(|e| format!("ZIP entry error: {e}"))?;

            let name = entry.name().to_string();

            // Skip macOS metadata and .DS_Store
            if name.contains("__MACOSX") || name.contains(".DS_Store") {
                continue;
            }

            let out_path = match entry.enclosed_name() {
                Some(p) => staging.join(p),
                None => continue,
            };

            if entry.is_dir() {
                std::fs::create_dir_all(&out_path)
                    .map_err(|e| format!("Failed to create directory: {e}"))?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {e}"))?;
                }
                let mut contents = Vec::new();
                entry
                    .read_to_end(&mut contents)
                    .map_err(|e| format!("Failed to read entry: {e}"))?;
                std::fs::write(&out_path, &contents)
                    .map_err(|e| format!("Failed to write file: {e}"))?;
                extracted.push(out_path.to_string_lossy().to_string());
            }
        }

        Ok(extracted)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
