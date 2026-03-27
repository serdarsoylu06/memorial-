use super::analyzer::FileOpResult;

/// Move files to their target archive paths.
#[tauri::command]
pub async fn move_files(
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut moved: Vec<String> = Vec::new();
        let mut failed: Vec<String> = Vec::new();

        for (src, dst) in &files {
            let src_path = std::path::Path::new(src);
            if !src_path.exists() {
                failed.push(src.clone());
                continue;
            }
            if dry_run {
                moved.push(dst.clone());
                continue;
            }
            let dst_path = std::path::Path::new(dst);
            if let Some(parent) = dst_path.parent() {
                if let Err(_) = std::fs::create_dir_all(parent) {
                    failed.push(src.clone());
                    continue;
                }
            }
            // Try rename first; fall back to copy+delete on cross-device error
            let result = std::fs::rename(src_path, dst_path).or_else(|_| {
                std::fs::copy(src_path, dst_path).and_then(|_| std::fs::remove_file(src_path))
            });
            match result {
                Ok(_) => moved.push(dst.clone()),
                Err(_) => failed.push(src.clone()),
            }
        }

        Ok(FileOpResult {
            success: failed.is_empty(),
            moved,
            failed,
            dry_run,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

/// Copy files to their target archive paths with SHA-256 integrity check.
#[tauri::command]
pub async fn copy_files(
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    tokio::task::spawn_blocking(move || {
        let mut moved: Vec<String> = Vec::new();
        let mut failed: Vec<String> = Vec::new();

        for (src, dst) in &files {
            let src_path = std::path::Path::new(src);
            if !src_path.exists() {
                failed.push(src.clone());
                continue;
            }
            if dry_run {
                moved.push(dst.clone());
                continue;
            }
            let dst_path = std::path::Path::new(dst);
            if let Some(parent) = dst_path.parent() {
                if let Err(_) = std::fs::create_dir_all(parent) {
                    failed.push(src.clone());
                    continue;
                }
            }
            match std::fs::copy(src_path, dst_path) {
                Ok(_) => {
                    // Verify integrity
                    let src_hash = compute_file_sha256(src_path);
                    let dst_hash = compute_file_sha256(dst_path);
                    if src_hash.is_ok() && dst_hash.is_ok() && src_hash == dst_hash {
                        moved.push(dst.clone());
                    } else {
                        let _ = std::fs::remove_file(dst_path);
                        failed.push(src.clone());
                    }
                }
                Err(_) => failed.push(src.clone()),
            }
        }

        Ok(FileOpResult {
            success: failed.is_empty(),
            moved,
            failed,
            dry_run,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

fn compute_file_sha256(path: &std::path::Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}
