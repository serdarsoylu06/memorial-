use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

use super::analyzer::{load_device_rules, parse_media_file, MediaFile};

/// A node in the archive folder tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveFolder {
    pub name: String,
    pub path: String,
    pub children: Vec<ArchiveFolder>,
    pub file_count: u64,
    pub has_manifest: bool,
    pub has_edits: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskUsage {
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFolderHint {
    pub name: String,
    pub path: String,
    pub media_count: u64,
}

/// Recursively build the archive folder tree.
#[tauri::command]
pub async fn get_archive_tree(archive_path: String) -> Result<ArchiveFolder, String> {
    let root = Path::new(&archive_path);
    if !root.exists() {
        return Err(format!("Archive path does not exist: {archive_path}"));
    }
    Ok(build_folder_node(root))
}

fn build_folder_node(dir: &Path) -> ArchiveFolder {
    let name = dir.file_name().unwrap_or_default().to_string_lossy().to_string();
    let path = dir.to_string_lossy().to_string();

    let mut children: Vec<ArchiveFolder> = Vec::new();
    let mut file_count: u64 = 0;
    let mut has_manifest = false;
    let mut has_edits = false;

    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        entries.sort_by_key(|e| e.file_name());

        for entry in entries {
            let entry_path = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with('.') {
                continue;
            }
            if entry_path.is_dir() {
                if fname == "EDITS" || fname == "_edits" {
                    has_edits = true;
                }
                children.push(build_folder_node(&entry_path));
            } else {
                if fname == "_manifest.json" {
                    has_manifest = true;
                }
                if fname == "_source.json" {
                    has_edits = true;
                }
                file_count += 1;
            }
        }
    }

    ArchiveFolder {
        name,
        path,
        children,
        file_count,
        has_manifest,
        has_edits,
    }
}

static PHOTO_EXTS: &[&str] = &["jpg", "jpeg", "heic", "png", "cr2", "arw", "nef", "dng", "tiff", "tif"];
static VIDEO_EXTS: &[&str] = &["mp4", "mov", "avi", "mts", "m2ts", "mkv", "m4v"];

pub(crate) fn is_media(ext: &str) -> bool {
    let ext = ext.to_lowercase();
    PHOTO_EXTS.iter().any(|e| *e == ext.as_str()) || VIDEO_EXTS.iter().any(|e| *e == ext.as_str())
}

/// Find top-level folders under root that contain media files.
#[tauri::command]
pub async fn get_media_folder_hints(
    root_path: String,
    ignore_dirs: Option<Vec<String>>,
) -> Result<Vec<MediaFolderHint>, String> {
    let root = Path::new(&root_path);
    if !root.exists() {
        return Err(format!("Root path does not exist: {root_path}"));
    }

    let mut ignored = std::collections::HashSet::new();
    if let Some(dirs) = ignore_dirs {
        for d in dirs {
            ignored.insert(d.trim_matches('/').to_lowercase());
        }
    }

    let mut hints: Vec<MediaFolderHint> = Vec::new();
    let entries = std::fs::read_dir(root).map_err(|e| format!("read_dir failed: {e}"))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if ignored.contains(&name.to_lowercase()) {
            continue;
        }

        let media_count = WalkDir::new(&path)
            .follow_links(false)
            .max_depth(5)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(is_media)
                    .unwrap_or(false)
            })
            .count() as u64;

        if media_count > 0 {
            hints.push(MediaFolderHint {
                name,
                path: path.to_string_lossy().to_string(),
                media_count,
            });
        }
    }

    hints.sort_by(|a, b| b.media_count.cmp(&a.media_count));
    Ok(hints)
}

/// List contents of the REVIEW directory as MediaFiles.
#[tauri::command]
pub async fn get_review_files(review_path: String) -> Result<Vec<MediaFile>, String> {
    let root = Path::new(&review_path);
    if !root.exists() {
        return Ok(vec![]);
    }

    // Read each file the way the scan does, so the list shows what is actually
    // known about it (device, capture time, location) and what is missing.
    let rules = load_device_rules()?;
    let root = root.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut files: Vec<MediaFile> = WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
            .filter_map(|e| parse_media_file(e.path(), &rules))
            .collect();
        files.sort_by(|a, b| a.path.cmp(&b.path));
        files
    })
    .await
    .map_err(|e| format!("Review listing failed: {e}"))
}

/// Open a file or folder in macOS Finder (or Windows Explorer).
#[tauri::command]
pub async fn open_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {e}"))?;
    }
    Ok(())
}

/// Move a file to the system Trash. Nothing is ever removed permanently:
/// if the volume has no Trash the call fails and the file stays where it is.
pub(crate) fn trash_path(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err(format!("Not a file: {}", path.display()));
    }
    #[allow(unused_mut)]
    let mut context = trash::TrashContext::default();
    #[cfg(target_os = "macos")]
    {
        // NSFileManager needs no Finder automation permission.
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context
        .delete(path)
        .map_err(|e| format!("Could not move to Trash: {e}"))
}

/// Move a file to the system Trash.
#[tauri::command]
pub async fn trash_file(path: String) -> Result<(), String> {
    trash_path(Path::new(&path))
}

/// Check if a path exists (for HDD polling).
#[tauri::command]
pub async fn check_path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

/// Calculate total size of a directory in bytes.
#[tauri::command]
pub async fn get_folder_size(path: String) -> Result<u64, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Ok(0);
    }
    let total: u64 = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum();
    Ok(total)
}

/// Create the top-level folder structure on the HDD root.
/// Creates: INBOX, ARCHIVE, EDITS, REVIEW, STAGING (if they don't already exist).
#[tauri::command]
pub async fn init_folder_structure(
    hdd_root: String,
    dirs: Vec<String>,
) -> Result<Vec<String>, String> {
    let root = Path::new(&hdd_root);
    if !root.exists() {
        return Err(format!("HDD root does not exist: {hdd_root}"));
    }
    let mut created: Vec<String> = Vec::new();
    for dir_name in &dirs {
        let dir_path = root.join(dir_name);
        if !dir_path.exists() {
            std::fs::create_dir_all(&dir_path)
                .map_err(|e| format!("Failed to create {}: {e}", dir_path.display()))?;
            created.push(dir_path.to_string_lossy().to_string());
        }
    }
    Ok(created)
}

/// Get disk usage statistics for a path.
#[tauri::command]
pub async fn get_disk_usage(path: String) -> Result<DiskUsage, String> {
    #[cfg(unix)]
    {
        use std::ffi::CString;
        let c_path = CString::new(path.clone()).map_err(|e| e.to_string())?;
        let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
        let ret = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };
        if ret == 0 {
            let block_size = stat.f_frsize as u64;
            let total = stat.f_blocks as u64 * block_size;
            let free = stat.f_bavail as u64 * block_size;
            return Ok(DiskUsage {
                total_bytes: total,
                free_bytes: free,
                used_bytes: total.saturating_sub(free),
            });
        }
        Err(format!("statvfs failed for {path}"))
    }
    #[cfg(not(unix))]
    {
        // Windows fallback - return zeroes for now
        Ok(DiskUsage {
            total_bytes: 0,
            free_bytes: 0,
            used_bytes: 0,
        })
    }
}

#[cfg(test)]
mod trash_tests {
    use super::*;

    /// Leaves a file in the real Trash, so it only runs on request:
    /// `cargo test --lib trash_keeps_the_file_recoverable -- --ignored`
    #[test]
    #[ignore]
    fn trash_keeps_the_file_recoverable() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("memorial-trash-test.jpg");
        std::fs::write(&file, b"not really a photo").unwrap();
        trash_path(&file).unwrap();
        assert!(!file.exists());
        assert!(trash_path(&file).is_err(), "a missing file must be an error, not a silent success");
        assert!(trash_path(dir.path()).is_err(), "folders are never trashed");
    }
}
