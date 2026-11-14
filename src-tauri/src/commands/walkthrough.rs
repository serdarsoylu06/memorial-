//! A manual walkthrough of the whole pipeline against a real folder:
//!
//!   python3 scripts/make-test-disk.py ~/Desktop/test-disk
//!   MEMORIAL_DISK=~/Desktop/test-disk cargo test --lib disk_walkthrough -- --ignored --nocapture
//!
//! It does what the app does when every session is approved with "copy": scan the
//! INBOX, file each session under <root>/<suggested path>/<Photos|Videos>/<Device>,
//! then build thumbnails, look for duplicates in the ARCHIVE and list REVIEW.
//! Sources are only read; the ARCHIVE gains files, so use a disposable folder.

use super::analyzer::scan_inbox_sync;
use super::duplicate::find_duplicates;
use super::helpers::get_review_files;
use super::safe_fs::{transfer, validate_batch_destinations};
use super::thumbs::thumbnail_jpeg;
use std::path::{Path, PathBuf};

fn destination(root: &Path, target: &str, kind: &str, device: &str, name: &str) -> PathBuf {
    let media = if kind == "video" { "Videos" } else { "Photos" };
    let device = if device.is_empty() { "Unknown_Device" } else { device };
    root.join(target).join(media).join(device.replace(char::is_whitespace, "_")).join(name)
}

#[test]
#[ignore]
fn disk_walkthrough() {
    let disk = std::env::var("MEMORIAL_DISK").expect("set MEMORIAL_DISK to a test disk folder");
    let root = Path::new(&disk).canonicalize().expect("MEMORIAL_DISK does not exist");
    let inbox = root.join("INBOX");
    let archive = root.join("ARCHIVE");

    // ── 1. Scan ────────────────────────────────────────────────────────────────
    let scan = scan_inbox_sync(inbox.to_str().unwrap(), 2).expect("scan failed");
    println!("\n== Tarama: {} dosya, {} oturum, {} sınıflandırılamayan", scan.total_files, scan.sessions.len(), scan.unclassified.len());
    for s in &scan.sessions {
        println!(
            "  [{:?}] {}  ({} dosya; {}; konum: {})\n        {} .. {}",
            s.confidence,
            s.suggested_path,
            s.files.len(),
            s.devices.join(", "),
            if s.has_gps { "var" } else { "yok" },
            s.date_start.as_deref().unwrap_or("?"),
            s.date_end.as_deref().unwrap_or("?"),
        );
    }
    for f in &scan.unclassified {
        println!("  sınıflandırılamadı: {}", f.filename);
    }
    let in_sessions: usize = scan.sessions.iter().map(|s| s.files.len()).sum();
    assert_eq!(in_sessions + scan.unclassified.len(), scan.total_files, "every scanned file is accounted for");

    // ── 2. Approve every session with "copy" ───────────────────────────────────
    println!("\n== Kopyalama");
    let mut copied = 0usize;
    let mut conflicts = 0usize;
    for s in &scan.sessions {
        let mut pairs: Vec<(String, String)> = Vec::new();
        for f in &s.files {
            let dst = destination(&root, &s.suggested_path, &f.kind, &f.device, &f.filename);
            pairs.push((f.path.clone(), dst.to_string_lossy().to_string()));
            for sidecar in &f.sidecars {
                let name = Path::new(sidecar).file_name().unwrap().to_string_lossy().to_string();
                pairs.push((sidecar.clone(), dst.with_file_name(name).to_string_lossy().to_string()));
            }
        }
        validate_batch_destinations(&pairs).expect("destinations must be distinct and inside the disk");
        for (src, dst) in &pairs {
            if let Err(error) = transfer(Path::new(src), Path::new(dst), false, true) {
                println!("  ön kontrol reddetti: {} ({error})", Path::new(dst).strip_prefix(&root).unwrap().display());
                conflicts += 1;
                continue;
            }
            transfer(Path::new(src), Path::new(dst), false, false).expect("copy failed after a clean dry run");
            assert_eq!(std::fs::read(src).unwrap(), std::fs::read(dst).unwrap(), "copy differs from source");
            assert!(Path::new(src).exists(), "copy must leave the source");
            assert!(transfer(Path::new(src), Path::new(dst), false, false).is_err(), "second copy must not overwrite");
            copied += 1;
        }
        println!("  {} -> {} dosya", s.suggested_path, pairs.len());
    }
    println!("  toplam: {copied} dosya kopyalandı, {conflicts} çakışma");

    // ── 3. Thumbnails ──────────────────────────────────────────────────────────
    let cache = tempfile::tempdir().unwrap();
    let all: Vec<_> = scan.sessions.iter().flat_map(|s| s.files.iter()).chain(scan.unclassified.iter()).collect();
    let started = std::time::Instant::now();
    let made = all.iter().filter(|f| thumbnail_jpeg(Path::new(&f.path), Some(cache.path())).is_some()).count();
    let cold = started.elapsed();
    let started = std::time::Instant::now();
    let again = all.iter().filter(|f| thumbnail_jpeg(Path::new(&f.path), Some(cache.path())).is_some()).count();
    println!("\n== Küçük resimler: {made}/{} üretildi, ilk seferde {cold:.2?}, önbellekten {:.2?}", all.len(), started.elapsed());
    assert_eq!(made, again);

    // ── 4. Duplicates in the archive ───────────────────────────────────────────
    let pairs = find_duplicates(&[archive.to_string_lossy().to_string()], 4, true, true);
    println!("\n== Arşivde kopyalar: {} çift", pairs.len());
    for p in &pairs {
        println!(
            "  {} ({:.0}%)\n      {}\n      {}",
            p.match_type,
            p.similarity * 100.0,
            Path::new(&p.original).strip_prefix(&root).unwrap().display(),
            Path::new(&p.duplicate).strip_prefix(&root).unwrap().display()
        );
    }

    // ── 5. Review ──────────────────────────────────────────────────────────────
    let review = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(get_review_files(root.join("REVIEW").to_string_lossy().to_string()))
        .unwrap();
    let review_pairs = find_duplicates(&[root.join("REVIEW").to_string_lossy().to_string()], 4, true, true);
    println!("\n== İnceleme: {} dosya, kendi içinde {} kopya çifti", review.len(), review_pairs.len());
}
