use super::analyzer::FileOpResult;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
    pub status: String, // "copying" | "verifying" | "done" | "failed" | "duplicate_skipped"
}

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

/// Resolve the DUPLICATES directory: place it alongside the top-level dirs (e.g. INBOX).
/// We climb up from the source path until we find a well-known sibling like INBOX/ARCHIVE,
/// then put DUPLICATES at the same level. Falls back to src's grandparent.
fn resolve_duplicates_dir(src: &str) -> std::path::PathBuf {
    let known = ["INBOX", "ARCHIVE", "REVIEW", "STAGING", "EDITS"];
    let mut cur = Path::new(src).to_path_buf();
    while let Some(parent) = cur.parent() {
        let name = cur
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        if known.iter().any(|k| k.eq_ignore_ascii_case(name)) {
            return parent.join("DUPLICATES");
        }
        cur = parent.to_path_buf();
    }
    // Fallback: two levels up from src file
    Path::new(src)
        .parent()
        .and_then(|p| p.parent())
        .unwrap_or_else(|| Path::new(src).parent().unwrap_or(Path::new("/")))
        .join("DUPLICATES")
}

/// Handle a duplicate: move source file to DUPLICATES dir.
/// Returns the status string for the progress event.
fn handle_duplicate(src: &str) -> Result<String, String> {
    let dup_dir = resolve_duplicates_dir(src);
    std::fs::create_dir_all(&dup_dir)
        .map_err(|e| format!("Cannot create DUPLICATES dir: {e}"))?;
    let fname = Path::new(src)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let dup_dst = dup_dir.join(&fname);
    // Avoid overwrite inside DUPLICATES: append counter if needed
    let final_dst = if dup_dst.exists() {
        let stem = Path::new(&fname)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ext = Path::new(&fname)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();
        let mut n = 1u32;
        loop {
            let candidate = dup_dir.join(format!("{}_{}{}", stem, n, ext));
            if !candidate.exists() {
                break candidate;
            }
            n += 1;
        }
    } else {
        dup_dst
    };
    std::fs::rename(src, &final_dst).or_else(|_| {
        std::fs::copy(src, &final_dst)
            .and_then(|_| std::fs::remove_file(src))
            .map_err(|e| format!("Failed to move duplicate: {e}"))
    })?;
    Ok("duplicate_skipped".to_string())
}

/// Remove empty directories climbing up from `start` towards (but not including) `stop_at`.
fn cleanup_empty_dirs(start: &Path, stop_at: &Path) {
    let mut dir = start.to_path_buf();
    while dir.starts_with(stop_at) && dir != stop_at {
        // Only remove if truly empty
        let is_empty = std::fs::read_dir(&dir)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if is_empty {
            let _ = std::fs::remove_dir(&dir);
            dir = match dir.parent() {
                Some(p) => p.to_path_buf(),
                None => break,
            };
        } else {
            break;
        }
    }
}

/// Derive the INBOX root path: climb from src until we find INBOX-like dir.
fn find_inbox_root(src: &str) -> std::path::PathBuf {
    let known = ["INBOX", "ARCHIVE", "REVIEW", "STAGING", "EDITS"];
    let mut cur = Path::new(src).to_path_buf();
    while let Some(parent) = cur.parent() {
        let name = cur.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if known.iter().any(|k| k.eq_ignore_ascii_case(name)) {
            return cur.clone();
        }
        cur = parent.to_path_buf();
    }
    Path::new(src)
        .parent()
        .unwrap_or(Path::new("/"))
        .to_path_buf()
}

// ─── move_files ─────────────────────────────────────────────────────────────────

/// Move files to their target archive paths.
#[tauri::command]
pub async fn move_files(
    app: AppHandle,
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    let mut moved = Vec::new();
    let mut failed = Vec::new();
    let total = files.len();
    let mut source_parents: HashSet<std::path::PathBuf> = HashSet::new();
    let mut inbox_root: Option<std::path::PathBuf> = None;

    for (i, (src, dst)) in files.iter().enumerate() {
        let filename = Path::new(src)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let _ = app.emit(
            "file-progress",
            FileProgress {
                current: i + 1,
                total,
                filename: filename.clone(),
                status: "copying".to_string(),
            },
        );

        let src_path = Path::new(src);
        if !src_path.exists() {
            failed.push(format!("Source not found: {src}"));
            let _ = app.emit("file-progress", FileProgress {
                current: i + 1, total, filename, status: "failed".to_string(),
            });
            continue;
        }
        if dry_run {
            moved.push(dst.clone());
            let _ = app.emit("file-progress", FileProgress {
                current: i + 1, total, filename, status: "done".to_string(),
            });
            continue;
        }

        // ── Duplicate check ──
        let dst_path = Path::new(dst);
        if dst_path.exists() {
            let src_hash = compute_file_hash(src).unwrap_or_default();
            let dst_hash = compute_file_hash(dst).unwrap_or_default();
            if !src_hash.is_empty() && src_hash == dst_hash {
                // Exact duplicate — move source to DUPLICATES
                match handle_duplicate(src) {
                    Ok(status) => {
                        let _ = app.emit("file-progress", FileProgress {
                            current: i + 1, total, filename, status,
                        });
                    }
                    Err(e) => {
                        failed.push(format!("Duplicate handling failed for {src}: {e}"));
                        let _ = app.emit("file-progress", FileProgress {
                            current: i + 1, total, filename, status: "failed".to_string(),
                        });
                    }
                }
                continue;
            }
        }

        // Create destination directories
        if let Some(parent) = dst_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                failed.push(format!("Cannot create dir {}: {e}", parent.display()));
                let _ = app.emit("file-progress", FileProgress {
                    current: i + 1, total, filename, status: "failed".to_string(),
                });
                continue;
            }
        }

        // Track source parent for cleanup
        if let Some(parent) = src_path.parent() {
            source_parents.insert(parent.to_path_buf());
        }
        if inbox_root.is_none() {
            inbox_root = Some(find_inbox_root(src));
        }

        // Try rename first (same fs), fall back to copy+delete
        match std::fs::rename(src, dst) {
            Ok(_) => {
                moved.push(dst.clone());
                let _ = app.emit("file-progress", FileProgress {
                    current: i + 1, total, filename, status: "done".to_string(),
                });
            }
            Err(_rename_err) => {
                match std::fs::copy(src, dst) {
                    Ok(_) => {
                        if let Err(e) = std::fs::remove_file(src) {
                            failed.push(format!("Copied but couldn't delete source: {e}"));
                            let _ = app.emit("file-progress", FileProgress {
                                current: i + 1, total, filename, status: "failed".to_string(),
                            });
                        } else {
                            moved.push(dst.clone());
                            let _ = app.emit("file-progress", FileProgress {
                                current: i + 1, total, filename, status: "done".to_string(),
                            });
                        }
                    }
                    Err(copy_err) => {
                        failed.push(format!("Failed to move {src}: {copy_err}"));
                        let _ = app.emit("file-progress", FileProgress {
                            current: i + 1, total, filename, status: "failed".to_string(),
                        });
                    }
                }
            }
        }
    }

    // ── Auto-cleanup: remove empty directories ──
    if !dry_run {
        if let Some(ref root) = inbox_root {
            for parent in &source_parents {
                cleanup_empty_dirs(parent, root);
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

// ─── copy_files ─────────────────────────────────────────────────────────────────

/// Copy files to their target archive paths with SHA256 integrity verification.
#[tauri::command]
pub async fn copy_files(
    app: AppHandle,
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    let mut moved = Vec::new();
    let mut failed = Vec::new();
    let total = files.len();

    for (i, (src, dst)) in files.iter().enumerate() {
        let filename = Path::new(src)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let _ = app.emit(
            "file-progress",
            FileProgress {
                current: i + 1,
                total,
                filename: filename.clone(),
                status: "copying".to_string(),
            },
        );

        let src_path = Path::new(src);
        if !src_path.exists() {
            failed.push(format!("Source not found: {src}"));
            let _ = app.emit("file-progress", FileProgress {
                current: i + 1, total, filename, status: "failed".to_string(),
            });
            continue;
        }
        if dry_run {
            moved.push(dst.clone());
            let _ = app.emit("file-progress", FileProgress {
                current: i + 1, total, filename, status: "done".to_string(),
            });
            continue;
        }

        // ── Duplicate check ──
        let dst_path = Path::new(dst);
        if dst_path.exists() {
            let src_hash = compute_file_hash(src).unwrap_or_default();
            let dst_hash = compute_file_hash(dst).unwrap_or_default();
            if !src_hash.is_empty() && src_hash == dst_hash {
                match handle_duplicate(src) {
                    Ok(status) => {
                        let _ = app.emit("file-progress", FileProgress {
                            current: i + 1, total, filename, status,
                        });
                    }
                    Err(e) => {
                        failed.push(format!("Duplicate handling failed for {src}: {e}"));
                        let _ = app.emit("file-progress", FileProgress {
                            current: i + 1, total, filename, status: "failed".to_string(),
                        });
                    }
                }
                continue;
            }
        }

        if let Some(parent) = dst_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                failed.push(format!("Cannot create dir: {e}"));
                let _ = app.emit("file-progress", FileProgress {
                    current: i + 1, total, filename, status: "failed".to_string(),
                });
                continue;
            }
        }

        match std::fs::copy(src, dst) {
            Ok(_) => {
                // Integrity check
                let _ = app.emit("file-progress", FileProgress {
                    current: i + 1,
                    total,
                    filename: filename.clone(),
                    status: "verifying".to_string(),
                });
                let src_hash = compute_file_hash(src).unwrap_or_default();
                let dst_hash = compute_file_hash(dst).unwrap_or_default();
                if src_hash != dst_hash || src_hash.is_empty() {
                    let _ = std::fs::remove_file(dst);
                    failed.push(format!("Integrity check failed for {src}"));
                    let _ = app.emit("file-progress", FileProgress {
                        current: i + 1, total, filename, status: "failed".to_string(),
                    });
                } else {
                    moved.push(dst.clone());
                    let _ = app.emit("file-progress", FileProgress {
                        current: i + 1, total, filename, status: "done".to_string(),
                    });
                }
            }
            Err(e) => {
                failed.push(format!("Failed to copy {src}: {e}"));
                let _ = app.emit("file-progress", FileProgress {
                    current: i + 1, total, filename, status: "failed".to_string(),
                });
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
