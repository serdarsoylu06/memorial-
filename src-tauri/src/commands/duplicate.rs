use super::analyzer::DuplicatePair;

/// Compute SHA256 hash for a file.
#[tauri::command]
pub async fn compute_sha256(file_path: String) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let mut file = std::fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {e}"))?;
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

/// Check a list of files for exact (SHA256) and perceptual (pHash) duplicates.
///
/// Returns a list of duplicate pairs with similarity scores.
#[tauri::command]
pub async fn check_duplicates(
    file_paths: Vec<String>,
    phash_threshold: u32,
) -> Result<Vec<DuplicatePair>, String> {
    // TODO: Compute SHA256 for every file → group exact matches
    // TODO: For image files, compute pHash using image crate
    // TODO: Compare pHash values using Hamming distance
    // TODO: Return pairs where distance <= phash_threshold
    let _ = (file_paths, phash_threshold);
    Ok(vec![])
}
