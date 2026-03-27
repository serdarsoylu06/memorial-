use super::analyzer::DuplicatePair;
use super::utils::compute_file_sha256;

/// Compute SHA-256 hash for a single file.
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

fn compute_phash(path: &std::path::Path) -> Option<u64> {
    let img = image::open(path).ok()?;
    let small = img.resize_exact(8, 8, image::imageops::FilterType::Lanczos3);
    let luma = small.to_luma8();
    let pixels: Vec<u8> = luma.into_raw();
    let mean = pixels.iter().map(|&p| p as u64).sum::<u64>() / 64;
    let mut hash: u64 = 0;
    for (i, &p) in pixels.iter().enumerate() {
        if (p as u64) > mean {
            hash |= 1u64 << i;
        }
    }
    Some(hash)
}

fn hamming_distance(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

/// Check a list of files for exact (SHA-256) and perceptual (pHash) duplicates.
#[tauri::command]
pub async fn check_duplicates(
    file_paths: Vec<String>,
    phash_threshold: u32,
) -> Result<Vec<DuplicatePair>, String> {
    tokio::task::spawn_blocking(move || {
        let mut results: Vec<DuplicatePair> = Vec::new();
        let mut exact_pairs: std::collections::HashSet<(usize, usize)> =
            std::collections::HashSet::new();

        // Step 1: SHA-256 exact duplicates
        let hashes: Vec<Option<String>> = file_paths
            .iter()
            .map(|p| compute_file_sha256(std::path::Path::new(p)).ok())
            .collect();

        let mut hash_groups: std::collections::HashMap<String, Vec<usize>> =
            std::collections::HashMap::new();
        for (i, h) in hashes.iter().enumerate() {
            if let Some(hash) = h {
                hash_groups.entry(hash.clone()).or_default().push(i);
            }
        }
        for indices in hash_groups.values() {
            if indices.len() < 2 {
                continue;
            }
            let original_idx = indices[0];
            for &dup_idx in &indices[1..] {
                exact_pairs.insert((original_idx.min(dup_idx), original_idx.max(dup_idx)));
                results.push(DuplicatePair {
                    original: file_paths[original_idx].clone(),
                    duplicate: file_paths[dup_idx].clone(),
                    match_type: "exact".to_string(),
                    similarity: 1.0,
                });
            }
        }

        // Step 2: pHash perceptual duplicates for image files
        // pHash is only computed for formats supported by the image crate's current
        // feature set (jpeg, png, webp). RAW formats (arw, cr2, cr3), HEIC, and
        // videos are skipped here; they may still appear as exact duplicates via SHA-256.
        const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png"];
        let phashes: Vec<Option<u64>> = file_paths
            .iter()
            .map(|p| {
                let ext = std::path::Path::new(p)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if IMAGE_EXTS.contains(&ext.as_str()) {
                    compute_phash(std::path::Path::new(p))
                } else {
                    None
                }
            })
            .collect();

        for i in 0..file_paths.len() {
            for j in (i + 1)..file_paths.len() {
                if exact_pairs.contains(&(i, j)) {
                    continue;
                }
                if let (Some(ha), Some(hb)) = (phashes[i], phashes[j]) {
                    let dist = hamming_distance(ha, hb);
                    if dist <= phash_threshold {
                        let similarity = 1.0 - (dist as f32 / 64.0);
                        results.push(DuplicatePair {
                            original: file_paths[i].clone(),
                            duplicate: file_paths[j].clone(),
                            match_type: "perceptual".to_string(),
                            similarity,
                        });
                    }
                }
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
