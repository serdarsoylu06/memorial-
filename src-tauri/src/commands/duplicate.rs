use super::analyzer::DuplicatePair;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

/// Compute SHA256 hash for a file.
#[tauri::command]
pub async fn compute_sha256(file_path: String) -> Result<String, String> {
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

/// Compute a simple 64-bit perceptual hash for an image.
/// Uses 8×8 grayscale average hash (aHash).
fn compute_ahash(path: &str) -> Option<u64> {
    let img = image::open(path).ok()?.to_luma8();
    let small = image::imageops::resize(&img, 8, 8, image::imageops::FilterType::Lanczos3);
    let pixels: Vec<u8> = small.pixels().map(|p| p.0[0]).collect();
    let mean = pixels.iter().map(|&v| v as u32).sum::<u32>() / 64;
    let hash = pixels
        .iter()
        .enumerate()
        .fold(0u64, |acc, (i, &v)| {
            if v as u32 >= mean {
                acc | (1u64 << i)
            } else {
                acc
            }
        });
    Some(hash)
}

fn hamming_distance(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

fn is_image(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "heic" | "tiff" | "tif" | "bmp"
    )
}

/// Check a list of files for exact (SHA256) and perceptual (aHash) duplicates.
#[tauri::command]
pub async fn check_duplicates(
    file_paths: Vec<String>,
    phash_threshold: u32,
) -> Result<Vec<DuplicatePair>, String> {
    let mut pairs: Vec<DuplicatePair> = Vec::new();

    // ── Exact duplicates via SHA256 ──────────────────────────────────────────────
    let mut hash_map: HashMap<String, Vec<String>> = HashMap::new();
    for path in &file_paths {
        if !Path::new(path).exists() {
            continue;
        }
        let h = compute_sha256(path.clone()).await?;
        hash_map.entry(h).or_default().push(path.clone());
    }

    for (_hash, group) in &hash_map {
        if group.len() < 2 {
            continue;
        }
        let original = &group[0];
        for dup in &group[1..] {
            pairs.push(DuplicatePair {
                original: original.clone(),
                duplicate: dup.clone(),
                match_type: "exact".to_string(),
                similarity: 1.0,
            });
        }
    }

    // ── Perceptual duplicates via aHash ─────────────────────────────────────────
    let images: Vec<(&String, u64)> = file_paths
        .iter()
        .filter(|p| {
            Path::new(p)
                .extension()
                .and_then(|e| e.to_str())
                .map(is_image)
                .unwrap_or(false)
        })
        .filter_map(|p| compute_ahash(p).map(|h| (p, h)))
        .collect();

    for i in 0..images.len() {
        for j in (i + 1)..images.len() {
            let dist = hamming_distance(images[i].1, images[j].1);
            if dist <= phash_threshold {
                let similarity = 1.0 - (dist as f32 / 64.0);
                // Don't re-report exact duplicates
                let already = pairs.iter().any(|p| {
                    (p.original == *images[i].0 && p.duplicate == *images[j].0)
                        || (p.original == *images[j].0 && p.duplicate == *images[i].0)
                });
                if !already {
                    pairs.push(DuplicatePair {
                        original: images[i].0.clone(),
                        duplicate: images[j].0.clone(),
                        match_type: "perceptual".to_string(),
                        similarity,
                    });
                }
            }
        }
    }

    Ok(pairs)
}
