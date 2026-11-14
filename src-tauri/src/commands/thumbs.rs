//! Thumbnails for the contact strips and sheets.
//!
//! Sources, fastest first:
//!   1. the JPEG preview embedded in EXIF (JPEG and TIFF-based RAW files),
//!   2. a full decode for formats the `image` crate reads (JPEG, PNG, WebP),
//!   3. on macOS, Quick Look for everything else (HEIC, video, RAW without a preview).
//!
//! Results are cached on disk, keyed by path, size and modification time.

use base64::Engine;
use image::DynamicImage;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Longest edge of a generated thumbnail, in pixels.
const MAX_EDGE: u32 = 320;
/// Embedded previews smaller than this are too soft; decode the file instead when possible.
const MIN_EMBEDDED_EDGE: u32 = 120;
const MAX_BATCH: usize = 96;
const WORKERS: usize = 4;

fn read_exif(path: &Path) -> Option<exif::Exif> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    exif::Reader::new().read_from_container(&mut reader).ok()
}

fn embedded_preview(exif: &exif::Exif) -> Option<DynamicImage> {
    let offset = exif
        .get_field(exif::Tag::JPEGInterchangeFormat, exif::In::THUMBNAIL)?
        .value
        .get_uint(0)? as usize;
    let length = exif
        .get_field(exif::Tag::JPEGInterchangeFormatLength, exif::In::THUMBNAIL)?
        .value
        .get_uint(0)? as usize;
    let bytes = exif.buf().get(offset..offset.checked_add(length)?)?;
    image::load_from_memory_with_format(bytes, image::ImageFormat::Jpeg).ok()
}

fn orientation(exif: &exif::Exif) -> u32 {
    exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .unwrap_or(1)
}

fn apply_orientation(img: DynamicImage, orientation: u32) -> DynamicImage {
    match orientation {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        6 => img.rotate90(),
        7 => img.rotate270().fliph(),
        8 => img.rotate270(),
        _ => img,
    }
}

fn decodable(ext: &str) -> bool {
    matches!(ext, "jpg" | "jpeg" | "png" | "webp")
}

/// Quick Look can hang on damaged or mislabelled files; give up after this long.
#[cfg(target_os = "macos")]
const QUICK_LOOK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(8);

#[cfg(target_os = "macos")]
fn quick_look(path: &Path) -> Option<DynamicImage> {
    let out = tempfile::tempdir().ok()?;
    let mut child = std::process::Command::new("/usr/bin/qlmanage")
        .args(["-t", "-s", &MAX_EDGE.to_string(), "-o"])
        .arg(out.path())
        .arg(path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

    let started = std::time::Instant::now();
    let finished = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.success(),
            Ok(None) if started.elapsed() < QUICK_LOOK_TIMEOUT => {
                std::thread::sleep(std::time::Duration::from_millis(40));
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break false;
            }
        }
    };
    if !finished {
        return None;
    }

    let produced = std::fs::read_dir(out.path())
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.extension().and_then(|e| e.to_str()) == Some("png"))?;
    image::open(produced).ok()
}

#[cfg(not(target_os = "macos"))]
fn quick_look(_path: &Path) -> Option<DynamicImage> {
    None
}

/// A small, upright image for `path`, or None when no source can produce one.
/// `allow_external` permits the (slow) Quick Look fallback.
pub(crate) fn small_image(path: &Path, allow_external: bool) -> Option<DynamicImage> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    let exif = read_exif(path);
    let turn = exif.as_ref().map(orientation).unwrap_or(1);

    let embedded = exif.as_ref().and_then(embedded_preview);
    let embedded_ok = embedded
        .as_ref()
        .map(|img| img.width().max(img.height()) >= MIN_EMBEDDED_EDGE)
        .unwrap_or(false);

    let img = if embedded_ok {
        embedded.map(|img| apply_orientation(img, turn))
    } else if decodable(&ext) {
        image::open(path)
            .ok()
            .map(|img| apply_orientation(img, turn))
            .or_else(|| embedded.map(|img| apply_orientation(img, turn)))
    } else {
        // Quick Look returns an already upright image.
        embedded
            .map(|img| apply_orientation(img, turn))
            .or_else(|| if allow_external { quick_look(path) } else { None })
    }?;

    Some(if img.width().max(img.height()) > MAX_EDGE {
        img.thumbnail(MAX_EDGE, MAX_EDGE)
    } else {
        img
    })
}

fn cache_file(cache_dir: &Path, path: &Path) -> Option<PathBuf> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    hasher.update(meta.len().to_le_bytes());
    hasher.update(modified.to_le_bytes());
    let key = hex::encode(hasher.finalize());
    Some(cache_dir.join(format!("{}.jpg", &key[..32])))
}

/// JPEG bytes of the thumbnail for `path`, reading and writing `cache_dir` when given.
pub(crate) fn thumbnail_jpeg(path: &Path, cache_dir: Option<&Path>) -> Option<Vec<u8>> {
    let cached = cache_dir.and_then(|dir| cache_file(dir, path));
    if let Some(bytes) = cached.as_ref().and_then(|file| std::fs::read(file).ok()) {
        return Some(bytes);
    }

    let img = small_image(path, true)?;
    let mut bytes = Vec::new();
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 78);
    img.to_rgb8().write_with_encoder(encoder).ok()?;

    if let Some(file) = cached {
        // A failed cache write only costs speed next time.
        let _ = std::fs::write(file, &bytes);
    }
    Some(bytes)
}

fn thumbnails_for(paths: &[String], cache_dir: Option<&Path>) -> Vec<Option<String>> {
    let mut results: Vec<Option<String>> = vec![None; paths.len()];
    let chunk = paths.len().div_ceil(WORKERS).max(1);
    std::thread::scope(|scope| {
        for (inputs, outputs) in paths.chunks(chunk).zip(results.chunks_mut(chunk)) {
            scope.spawn(move || {
                for (path, slot) in inputs.iter().zip(outputs.iter_mut()) {
                    *slot = thumbnail_jpeg(Path::new(path), cache_dir).map(|bytes| {
                        format!(
                            "data:image/jpeg;base64,{}",
                            base64::engine::general_purpose::STANDARD.encode(bytes)
                        )
                    });
                }
            });
        }
    });
    results
}

/// Thumbnails for a batch of files, as JPEG data URLs in the same order as `paths`.
/// A file that cannot be previewed yields null.
#[tauri::command]
pub async fn get_thumbnails(app: AppHandle, paths: Vec<String>) -> Result<Vec<Option<String>>, String> {
    if paths.len() > MAX_BATCH {
        return Err(format!("At most {MAX_BATCH} thumbnails per request"));
    }
    let cache_dir = app.path().app_cache_dir().ok().map(|dir| dir.join("thumbnails"));
    if let Some(dir) = &cache_dir {
        let _ = std::fs::create_dir_all(dir);
    }
    tokio::task::spawn_blocking(move || thumbnails_for(&paths, cache_dir.as_deref()))
        .await
        .map_err(|e| format!("Thumbnail task failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_jpeg(path: &Path, width: u32, height: u32) {
        let img = image::RgbImage::from_fn(width, height, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 120])
        });
        img.save(path).unwrap();
    }

    #[test]
    fn large_jpeg_is_reduced_and_keeps_its_shape() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("wide.jpg");
        write_jpeg(&file, 1200, 800);

        let bytes = thumbnail_jpeg(&file, None).unwrap();
        let thumb = image::load_from_memory(&bytes).unwrap();
        assert_eq!(thumb.width(), MAX_EDGE);
        assert!(thumb.height() < thumb.width());
    }

    #[test]
    fn cache_is_written_and_reused() {
        let dir = tempfile::tempdir().unwrap();
        let cache = dir.path().join("cache");
        std::fs::create_dir_all(&cache).unwrap();
        let file = dir.path().join("photo.jpg");
        write_jpeg(&file, 640, 480);

        let first = thumbnail_jpeg(&file, Some(&cache)).unwrap();
        let cached = cache_file(&cache, &file).unwrap();
        assert!(cached.exists());

        // The cached bytes are served even if they no longer match the source.
        std::fs::write(&cached, b"cached").unwrap();
        assert_eq!(thumbnail_jpeg(&file, Some(&cache)).unwrap(), b"cached");
        assert_ne!(first, b"cached");
    }

    #[test]
    fn unreadable_and_unsupported_files_yield_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let broken = dir.path().join("broken.jpg");
        std::fs::write(&broken, b"not an image").unwrap();
        assert!(thumbnail_jpeg(&broken, None).is_none());
        assert!(thumbnail_jpeg(&dir.path().join("missing.jpg"), None).is_none());
        assert!(small_image(&dir.path().join("notes.txt"), false).is_none());
    }

    #[test]
    fn batch_keeps_order_and_marks_failures() {
        let dir = tempfile::tempdir().unwrap();
        let good = dir.path().join("a.png");
        image::RgbImage::new(50, 40).save(&good).unwrap();
        let paths = vec![
            dir.path().join("missing.jpg").to_string_lossy().to_string(),
            good.to_string_lossy().to_string(),
            dir.path().join("also-missing.jpg").to_string_lossy().to_string(),
        ];
        let out = thumbnails_for(&paths, None);
        assert_eq!(out.len(), 3);
        assert!(out[0].is_none() && out[2].is_none());
        assert!(out[1].as_deref().unwrap().starts_with("data:image/jpeg;base64,"));
    }

    /// Manual check against a real file, e.g. a HEIC or a video:
    ///   MEMORIAL_SAMPLE=/path/to/file cargo test --lib sample_file -- --ignored --nocapture
    #[test]
    #[ignore]
    fn sample_file_produces_a_thumbnail() {
        let sample = std::env::var("MEMORIAL_SAMPLE").expect("set MEMORIAL_SAMPLE to a media file");
        let started = std::time::Instant::now();
        let bytes = thumbnail_jpeg(Path::new(&sample), None).expect("no thumbnail produced");
        let thumb = image::load_from_memory(&bytes).unwrap();
        println!("{sample}: {}x{}, {} bytes, {:?}", thumb.width(), thumb.height(), bytes.len(), started.elapsed());
        assert!(thumb.width().max(thumb.height()) <= MAX_EDGE);
    }
}
