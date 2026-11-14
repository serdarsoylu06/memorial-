use super::analyzer::FileOpResult;
use super::safe_fs::{transfer, validate_batch_destinations};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct FileProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
    pub status: String,
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

// Both commands use the same verified, no-overwrite transfer path. Existing
// destinations are reported as conflicts, including exact duplicates. Copying
// never relocates or removes a source as a side effect of duplicate detection.
fn run_transfers(
    app: &AppHandle,
    files: Vec<(String, String)>,
    dry_run: bool,
    move_source: bool,
) -> FileOpResult {
    if let Err(error) = validate_batch_destinations(&files) {
        return FileOpResult {
            success: false,
            moved: vec![],
            failed: vec![error],
            dry_run,
        };
    }
    let mut moved = Vec::new();
    let mut failed = Vec::new();
    let mut parents = HashSet::new();
    for (i, (src, dst)) in files.iter().enumerate() {
        let filename = Path::new(src)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let emit = |status: &str| {
            let _ = app.emit(
                "file-progress",
                FileProgress {
                    current: i + 1,
                    total: files.len(),
                    filename: filename.clone(),
                    status: status.into(),
                },
            );
        };
        emit("copying");
        match transfer(Path::new(src), Path::new(dst), move_source, dry_run) {
            Ok(()) => {
                moved.push(dst.clone());
                if move_source && !dry_run {
                    if let Some(parent) = Path::new(src).parent() {
                        parents.insert((parent.to_path_buf(), find_inbox_root(src)));
                    }
                }
                emit("done");
            }
            Err(error) => {
                failed.push(format!("{src} -> {dst}: {error}"));
                emit("failed");
            }
        }
    }
    for (parent, root) in parents {
        cleanup_empty_dirs(&parent, &root);
    }
    FileOpResult {
        success: failed.is_empty(),
        moved,
        failed,
        dry_run,
    }
}

/// Copy to a temporary file, verify SHA-256, publish without overwriting, then
/// remove the source. This path also supports transfers between filesystems.
#[tauri::command]
pub async fn move_files(
    app: AppHandle,
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    tokio::task::spawn_blocking(move || run_transfers(&app, files, dry_run, true))
        .await
        .map_err(|e| format!("Transfer task failed: {e}"))
}

/// Copy with integrity verification; existing archive files are never replaced.
#[tauri::command]
pub async fn copy_files(
    app: AppHandle,
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    tokio::task::spawn_blocking(move || run_transfers(&app, files, dry_run, false))
        .await
        .map_err(|e| format!("Transfer task failed: {e}"))
}
