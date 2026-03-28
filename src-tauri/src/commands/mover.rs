use super::analyzer::FileOpResult;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

fn compute_file_hash(path: &str) -> Result<String, String> {
    let mut file =
        std::fs::File::open(path).map_err(|e| format!("Failed to open {path}: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("Read error: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Move files to their target archive paths.
///
/// When dry_run is true, only simulates the operation and returns what would happen.
#[tauri::command]
pub async fn move_files(
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    let mut moved = Vec::new();
    let mut failed = Vec::new();

    for (src, dst) in &files {
        let src_path = Path::new(src);
        if !src_path.exists() {
            failed.push(format!("Source not found: {src}"));
            continue;
        }
        if dry_run {
            moved.push(dst.clone());
            continue;
        }
        // Create destination directories
        if let Some(parent) = Path::new(dst).parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                failed.push(format!("Cannot create dir {}: {e}", parent.display()));
                continue;
            }
        }
        // Try rename first (same fs, fast), fall back to copy+delete for cross-device
        match std::fs::rename(src, dst) {
            Ok(_) => {
                moved.push(dst.clone());
            }
            Err(rename_err) => {
                // Cross-device (EXDEV) fallback: copy then delete source
                match std::fs::copy(src, dst) {
                    Ok(_) => {
                        if let Err(e) = std::fs::remove_file(src) {
                            failed.push(format!(
                                "Copied {src} but couldn't delete source: {e}"
                            ));
                        } else {
                            moved.push(dst.clone());
                        }
                    }
                    Err(copy_err) => {
                        failed.push(format!(
                            "Failed to move {src}: rename={rename_err}, copy={copy_err}"
                        ));
                    }
                }
            }
        }
    }

    Ok(FileOpResult {
        success: failed.is_empty(),
        moved,
        failed,
        dry_run,
    })
}

/// Copy files to their target archive paths with SHA256 integrity verification.
#[tauri::command]
pub async fn copy_files(
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    let mut moved = Vec::new();
    let mut failed = Vec::new();

    for (src, dst) in &files {
        let src_path = Path::new(src);
        if !src_path.exists() {
            failed.push(format!("Source not found: {src}"));
            continue;
        }
        if dry_run {
            moved.push(dst.clone());
            continue;
        }
        if let Some(parent) = Path::new(dst).parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                failed.push(format!("Cannot create dir: {e}"));
                continue;
            }
        }
        match std::fs::copy(src, dst) {
            Ok(_) => {
                // Integrity check
                let src_hash = compute_file_hash(src).unwrap_or_default();
                let dst_hash = compute_file_hash(dst).unwrap_or_default();
                if src_hash != dst_hash || src_hash.is_empty() {
                    let _ = std::fs::remove_file(dst);
                    failed.push(format!("Integrity check failed for {src}"));
                } else {
                    moved.push(dst.clone());
                }
            }
            Err(e) => {
                failed.push(format!("Failed to copy {src}: {e}"));
            }
        }
    }

    Ok(FileOpResult {
        success: failed.is_empty(),
        moved,
        failed,
        dry_run,
    })
}
