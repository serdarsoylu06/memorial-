use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

use super::analyzer::MediaFile;

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

fn is_media(ext: &str) -> bool {
    let ext = ext.to_lowercase();
    PHOTO_EXTS.iter().any(|e| *e == ext.as_str()) || VIDEO_EXTS.iter().any(|e| *e == ext.as_str())
}

fn file_kind(ext: &str) -> &'static str {
    let ext = ext.to_lowercase();
    if PHOTO_EXTS.iter().any(|e| *e == ext.as_str()) { "photo" }
    else if VIDEO_EXTS.iter().any(|e| *e == ext.as_str()) { "video" }
    else { "unknown" }
}

/// List contents of the REVIEW directory as MediaFiles.
#[tauri::command]
pub async fn get_review_files(review_path: String) -> Result<Vec<MediaFile>, String> {
    let root = Path::new(&review_path);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut files: Vec<MediaFile> = Vec::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let fname = entry.file_name().to_str().unwrap_or("");
        if fname.starts_with('.') {
            continue;
        }
        if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
            if !is_media(ext) {
                continue;
            }
            let meta = entry.metadata().ok();
            let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            files.push(MediaFile {
                path: entry.path().to_string_lossy().to_string(),
                filename: fname.to_string(),
                size_bytes,
                created_at: None,
                device: super::analyzer::DeviceType::Unknown,
                has_gps: false,
                gps_lat: None,
                gps_lon: None,
                kind: file_kind(ext).to_string(),
            });
        }
    }
    Ok(files)
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

/// Delete a file from disk.
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Delete failed: {e}"))
}

/// Check if a path exists (for HDD polling).
#[tauri::command]
pub async fn check_path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
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
