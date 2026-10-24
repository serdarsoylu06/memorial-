use super::safe_fs::reject_symlinks;
use std::fs::{self, File, OpenOptions};
use std::io::Read;
use std::path::{Component, Path};
use zip::ZipArchive;

#[derive(Clone, Copy)]
pub(crate) struct Limits {
    entries: usize,
    file_bytes: u64,
    total_bytes: u64,
}

pub(crate) const LIMITS: Limits = Limits {
    entries: 10_000,
    file_bytes: 2 * 1024 * 1024 * 1024,
    total_bytes: 8 * 1024 * 1024 * 1024,
};

pub(crate) fn extract(
    zip_path: &Path,
    staging: &Path,
    limits: Limits,
) -> Result<Vec<String>, String> {
    let file = File::open(zip_path).map_err(|e| format!("Cannot open ZIP: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {e}"))?;
    if archive.len() > limits.entries {
        return Err("ZIP contains too many entries".into());
    }
    reject_symlinks(staging)?;
    fs::create_dir_all(staging).map_err(|e| e.to_string())?;
    let staging = staging.canonicalize().map_err(|e| e.to_string())?;
    // Each import has an isolated directory. TempDir removes partial output on error.
    let work = tempfile::Builder::new()
        .prefix("memorial-import-")
        .tempdir_in(&staging)
        .map_err(|e| e.to_string())?;
    let mut extracted = Vec::new();
    let mut total = 0u64;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| format!("Unsafe ZIP path: {name}"))?
            .to_path_buf();
        if relative.as_os_str().is_empty()
            || relative
                .components()
                .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
            || name.contains('\\')
            || name.contains(':')
        {
            return Err(format!("Unsafe ZIP path: {name}"));
        }
        let kind = entry.unix_mode().unwrap_or(0) & 0o170000;
        if !matches!(kind, 0 | 0o100000 | 0o040000) {
            return Err(format!(
                "ZIP links and special files are not supported: {name}"
            ));
        }
        if relative
            .components()
            .any(|c| c.as_os_str() == "__MACOSX" || c.as_os_str() == ".DS_Store")
        {
            continue;
        }
        if entry.size() > limits.file_bytes
            || entry.size() > limits.total_bytes.saturating_sub(total)
        {
            return Err(format!("ZIP extraction size limit exceeded: {name}"));
        }
        let output = work.path().join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&output).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut target = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(|e| format!("ZIP destination conflict for {name}: {e}"))?;
        let allowed = limits
            .file_bytes
            .min(limits.total_bytes.saturating_sub(total));
        let copied = std::io::copy(&mut (&mut entry).take(allowed + 1), &mut target)
            .map_err(|e| format!("Cannot extract {name}: {e}"))?;
        if copied > allowed || copied != entry.size() {
            return Err(format!("Invalid or oversized ZIP entry: {name}"));
        }
        target.sync_all().map_err(|e| e.to_string())?;
        total += copied;
        extracted.push(output.to_string_lossy().into_owned());
    }
    if !extracted.is_empty() {
        let _ = work.keep();
    }
    Ok(extracted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn archive(path: &Path, entries: &[(&str, &[u8])]) {
        let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
        for (name, bytes) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
    }

    #[test]
    fn safe_imports_are_isolated_and_skip_macos_noise() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let zip = dir.path().join("media.zip");
        let staging = dir.path().join("staging");
        archive(
            &zip,
            &[("trip/photo.jpg", b"media"), ("__MACOSX/noise", b"noise")],
        );
        let first = extract(&zip, &staging, LIMITS).unwrap();
        let second = extract(&zip, &staging, LIMITS).unwrap();
        assert_eq!(first.len(), 1);
        assert_ne!(first, second);
        assert_eq!(fs::read(&first[0]).unwrap(), b"media");
    }

    #[test]
    fn rejects_escapes_and_removes_partial_output() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let zip = dir.path().join("bad.zip");
        let staging = dir.path().join("staging");
        for name in [
            "../escape",
            "/absolute",
            "C:/escape",
            "folder/../../escape",
            "folder\\..\\escape",
        ] {
            archive(&zip, &[("first.jpg", b"partial"), (name, b"bad")]);
            assert!(extract(&zip, &staging, LIMITS).is_err(), "{name}");
            assert_eq!(fs::read_dir(&staging).unwrap().count(), 0);
        }
        assert!(!dir.path().join("escape").exists());
    }

    #[test]
    fn enforces_file_total_and_entry_limits() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let zip = dir.path().join("big.zip");
        let staging = dir.path().join("staging");
        archive(&zip, &[("a", b"1234"), ("b", b"5678")]);
        for limits in [
            Limits {
                entries: 1,
                ..LIMITS
            },
            Limits {
                file_bytes: 3,
                ..LIMITS
            },
            Limits {
                total_bytes: 7,
                ..LIMITS
            },
        ] {
            assert!(extract(&zip, &staging, limits).is_err());
            assert!(!staging.exists() || fs::read_dir(&staging).unwrap().count() == 0);
        }
    }

    #[test]
    fn rejects_colliding_entry_paths_and_cleans_partial_files() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let zip = dir.path().join("collision.zip");
        let staging = dir.path().join("staging");
        archive(
            &zip,
            &[("folder/./photo", b"first"), ("folder/photo", b"second")],
        );
        assert!(extract(&zip, &staging, LIMITS).is_err());
        assert_eq!(fs::read_dir(&staging).unwrap().count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_archive_symlinks_and_linked_staging() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let zip = dir.path().join("links.zip");
        let staging = dir.path().join("staging");
        let mut writer = zip::ZipWriter::new(File::create(&zip).unwrap());
        writer
            .add_symlink("link", "../outside", SimpleFileOptions::default())
            .unwrap();
        writer.finish().unwrap();
        assert!(extract(&zip, &staging, LIMITS).is_err());
        assert_eq!(fs::read_dir(&staging).unwrap().count(), 0);
        let linked = dir.path().join("linked");
        std::os::unix::fs::symlink(&staging, &linked).unwrap();
        archive(&zip, &[("photo", b"media")]);
        assert!(extract(&zip, &linked, LIMITS).is_err());
    }
}
