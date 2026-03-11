use super::analyzer::FileOpResult;

/// Move files to their target archive paths.
///
/// When dry_run is true, only simulates the operation and returns what would happen.
#[tauri::command]
pub async fn move_files(
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    // TODO: Validate source paths exist
    // TODO: Validate target directories exist or create them
    // TODO: If dry_run, return simulated result without touching the filesystem
    // TODO: Move files using std::fs::rename (cross-device safe fallback to copy+delete)
    // TODO: Log each operation to session log
    let _ = (files, dry_run);
    Ok(FileOpResult {
        success: true,
        moved: vec![],
        failed: vec![],
        dry_run,
    })
}

/// Copy files to their target archive paths.
///
/// When dry_run is true, only simulates the operation.
#[tauri::command]
pub async fn copy_files(
    files: Vec<(String, String)>,
    dry_run: bool,
) -> Result<FileOpResult, String> {
    // TODO: Validate source paths exist
    // TODO: Validate target directories or create them
    // TODO: If dry_run, return simulated result
    // TODO: Copy files using std::fs::copy
    // TODO: Verify integrity via SHA256 after copy
    // TODO: Log each operation to session log
    let _ = (files, dry_run);
    Ok(FileOpResult {
        success: true,
        moved: vec![],
        failed: vec![],
        dry_run,
    })
}
