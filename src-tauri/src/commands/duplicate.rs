use super::analyzer::DuplicatePair;
use super::helpers::is_media;
use super::thumbs::small_image;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
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

/// Compute SHA256 hash for a file.
#[tauri::command]
pub async fn compute_sha256(file_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || sha256_file(Path::new(&file_path)))
        .await
        .map_err(|e| format!("Hash task failed: {e}"))?
}

/// Compute a 64-bit perceptual hash for an image: a difference hash (dHash).
/// The preview is reduced to 9×8 grey pixels and each bit records whether a
/// pixel is brighter than its right-hand neighbour, so the hash follows the
/// picture's structure rather than its overall brightness. Uses the file's small
/// preview, so RAW files with an embedded preview are compared too and large
/// JPEGs stay cheap.
fn compute_phash(path: &Path) -> Option<u64> {
    let img = small_image(path, false)?.to_luma8();
    let small = image::imageops::resize(&img, 9, 8, image::imageops::FilterType::Triangle);
    let mut hash = 0u64;
    for y in 0..8 {
        for x in 0..8 {
            if small.get_pixel(x, y).0[0] > small.get_pixel(x + 1, y).0[0] {
                hash |= 1u64 << (y * 8 + x);
            }
        }
    }
    Some(hash)
}

#[cfg(test)]
fn compute_ahash(path: &Path) -> Option<u64> {
    let img = small_image(path, false)?.to_luma8();
    let small = image::imageops::resize(&img, 8, 8, image::imageops::FilterType::Triangle);
    let pixels: Vec<u8> = small.pixels().map(|p| p.0[0]).collect();
    let mean = pixels.iter().map(|&v| v as u32).sum::<u32>() / 64;
    Some(pixels.iter().enumerate().fold(0u64, |acc, (i, &v)| if v as u32 >= mean { acc | (1u64 << i) } else { acc }))
}

fn hamming_distance(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

fn is_image(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "heic" | "tiff" | "tif" | "cr2" | "arw" | "nef" | "dng"
    )
}

/// Turn the request into a sorted list of media files: a directory contributes
/// every media file beneath it, a file contributes itself.
fn collect_files(inputs: &[String]) -> Vec<String> {
    let mut files: Vec<String> = Vec::new();
    for input in inputs {
        let path = Path::new(input);
        if path.is_dir() {
            for entry in WalkDir::new(path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
            {
                let name = entry.file_name().to_string_lossy();
                if name.starts_with('.') {
                    continue;
                }
                let media = entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(is_media)
                    .unwrap_or(false);
                if media {
                    files.push(entry.path().to_string_lossy().to_string());
                }
            }
        } else if path.is_file() {
            files.push(input.clone());
        }
    }
    files.sort();
    files.dedup();
    files
}

pub(crate) fn find_duplicates(
    inputs: &[String],
    phash_threshold: u32,
    sha256_check: bool,
    phash_check: bool,
) -> Vec<DuplicatePair> {
    let files = collect_files(inputs);
    let mut pairs: Vec<DuplicatePair> = Vec::new();

    // ── Exact duplicates via SHA256 ──────────────────────────────────────────────
    // Only files of equal size can be identical, so only those are hashed.
    if sha256_check {
        let mut by_size: HashMap<u64, Vec<&String>> = HashMap::new();
        for file in &files {
            if let Ok(meta) = std::fs::metadata(file) {
                by_size.entry(meta.len()).or_default().push(file);
            }
        }
        let mut by_hash: HashMap<String, Vec<&String>> = HashMap::new();
        for group in by_size.values().filter(|g| g.len() > 1) {
            for file in group {
                // An unreadable file is skipped rather than failing the whole scan.
                if let Ok(hash) = sha256_file(Path::new(file)) {
                    by_hash.entry(hash).or_default().push(file);
                }
            }
        }
        let mut groups: Vec<Vec<&String>> = by_hash.into_values().filter(|g| g.len() > 1).collect();
        for group in groups.iter_mut() {
            group.sort();
        }
        groups.sort();
        for group in groups {
            for dup in &group[1..] {
                pairs.push(DuplicatePair {
                    original: group[0].clone(),
                    duplicate: (*dup).clone(),
                    match_type: "exact".to_string(),
                    similarity: 1.0,
                });
            }
        }
    }

    // ── Perceptual duplicates via aHash ─────────────────────────────────────────
    if phash_check {
        let exact: std::collections::HashSet<(String, String)> = pairs
            .iter()
            .map(|p| (p.original.clone(), p.duplicate.clone()))
            .collect();
        let images: Vec<(&String, u64)> = files
            .iter()
            .filter(|p| {
                Path::new(p)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(is_image)
                    .unwrap_or(false)
            })
            .filter_map(|p| compute_phash(Path::new(p)).map(|h| (p, h)))
            .collect();

        for i in 0..images.len() {
            for j in (i + 1)..images.len() {
                let dist = hamming_distance(images[i].1, images[j].1);
                if dist > phash_threshold {
                    continue;
                }
                // Don't re-report exact duplicates
                if exact.contains(&(images[i].0.clone(), images[j].0.clone())) {
                    continue;
                }
                pairs.push(DuplicatePair {
                    original: images[i].0.clone(),
                    duplicate: images[j].0.clone(),
                    match_type: "perceptual".to_string(),
                    similarity: 1.0 - (dist as f32 / 64.0),
                });
            }
        }
    }

    pairs
}

/// Check files for exact (SHA256) and perceptual (aHash) duplicates.
/// Each entry of `file_paths` may be a file or a directory to search.
#[tauri::command]
pub async fn check_duplicates(
    file_paths: Vec<String>,
    phash_threshold: u32,
    sha256_check: Option<bool>,
    phash_check: Option<bool>,
) -> Result<Vec<DuplicatePair>, String> {
    tokio::task::spawn_blocking(move || {
        find_duplicates(
            &file_paths,
            phash_threshold,
            sha256_check.unwrap_or(true),
            phash_check.unwrap_or(true),
        )
    })
    .await
    .map_err(|e| format!("Duplicate scan failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gradient(path: &Path, shift: u8) {
        image::RgbImage::from_fn(240, 160, |x, _| {
            let v = (x as u8).wrapping_add(shift);
            image::Rgb([v, v, v])
        })
        .save(path)
        .unwrap();
    }

    #[test]
    fn a_directory_is_searched_for_exact_copies() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("2024").join("Photos");
        std::fs::create_dir_all(&sub).unwrap();
        gradient(&dir.path().join("a.jpg"), 0);
        std::fs::copy(dir.path().join("a.jpg"), sub.join("a-copy.jpg")).unwrap();
        std::fs::write(dir.path().join("notes.txt"), b"ignored").unwrap();
        std::fs::write(dir.path().join(".hidden.jpg"), b"ignored").unwrap();

        let pairs = find_duplicates(&[dir.path().to_string_lossy().to_string()], 0, true, false);
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].match_type, "exact");
        assert!(pairs[0].original.ends_with("a-copy.jpg") || pairs[0].original.ends_with("a.jpg"));
        assert_ne!(pairs[0].original, pairs[0].duplicate);
    }

    #[test]
    fn similar_images_are_perceptual_matches_and_checks_can_be_switched_off() {
        let dir = tempfile::tempdir().unwrap();
        gradient(&dir.path().join("a.jpg"), 0);
        gradient(&dir.path().join("b.png"), 1);
        let input = [dir.path().to_string_lossy().to_string()];

        let pairs = find_duplicates(&input, 6, true, true);
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].match_type, "perceptual");

        assert!(find_duplicates(&input, 6, true, false).is_empty());
        assert!(find_duplicates(&input, 6, false, false).is_empty());
    }

    #[test]
    fn missing_paths_are_ignored() {
        assert!(find_duplicates(&["/missing-memorial-duplicates".to_string()], 10, true, true).is_empty());
    }

    /// Compare hash methods on a folder of real photos:
    ///   MEMORIAL_PHOTOS=/folder cargo test --lib hash_methods -- --ignored --nocapture
    #[test]
    #[ignore]
    fn hash_methods_on_real_photos() {
        let dir = std::env::var("MEMORIAL_PHOTOS").expect("set MEMORIAL_PHOTOS");
        let files = collect_files(&[dir]);
        for (name, hash) in [("aHash", compute_ahash as fn(&Path) -> Option<u64>), ("dHash", compute_phash)] {
            let hashes: Vec<(String, u64)> = files.iter().filter_map(|f| hash(Path::new(f)).map(|h| (f.clone(), h))).collect();
            let mut distances = Vec::new();
            for i in 0..hashes.len() {
                for j in (i + 1)..hashes.len() {
                    let a = Path::new(&hashes[i].0).file_stem().unwrap().to_string_lossy().to_string();
                    let b = Path::new(&hashes[j].0).file_stem().unwrap().to_string_lossy().to_string();
                    let related = a.starts_with(&b) || b.starts_with(&a);
                    distances.push((hamming_distance(hashes[i].1, hashes[j].1), related, a, b));
                }
            }
            let related: Vec<u32> = distances.iter().filter(|d| d.1).map(|d| d.0).collect();
            let mut unrelated: Vec<u32> = distances.iter().filter(|d| !d.1).map(|d| d.0).collect();
            unrelated.sort();
            println!("{name}: {} files; true copies at distances {:?}; unrelated pairs: min {:?}, <=4: {}, <=6: {}, <=10: {}, of {}",
                hashes.len(), related, unrelated.first(),
                unrelated.iter().filter(|d| **d <= 4).count(), unrelated.iter().filter(|d| **d <= 6).count(),
                unrelated.iter().filter(|d| **d <= 10).count(), unrelated.len());
        }
    }
}
