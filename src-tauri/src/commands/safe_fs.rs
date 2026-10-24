//! Verified transfers which never replace an existing archive file.
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

fn hash_reader(reader: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let n = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    Ok(hash.finalize().to_vec())
}

/// Reject symlinks in existing path components, including dangling links.
/// Archive directories must not be concurrently modified by an untrusted process.
pub(crate) fn reject_symlinks(path: &Path) -> Result<(), String> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(path)
    };
    let mut current = PathBuf::new();
    for component in absolute.components() {
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Symlink paths are not supported: {}",
                    current.display()
                ))
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("Cannot inspect {}: {e}", current.display())),
        }
    }
    Ok(())
}

pub(crate) fn validate_transfer(src: &Path, dst: &Path) -> Result<(), String> {
    if dst
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("Destination must not contain parent-directory components".into());
    }
    reject_symlinks(src)?;
    reject_symlinks(dst)?;
    let metadata = fs::metadata(src).map_err(|e| format!("Cannot read {}: {e}", src.display()))?;
    if !metadata.is_file() {
        return Err(format!("Source is not a regular file: {}", src.display()));
    }
    match fs::symlink_metadata(dst) {
        Ok(_) => return Err(format!("Destination already exists: {}", dst.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("Cannot inspect destination: {e}")),
    }
    // Check the nearest existing parent even during dry-run, without creating directories.
    let mut parent = dst
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    while !parent.exists() {
        parent = parent
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
    }
    let metadata = fs::metadata(parent).map_err(|e| e.to_string())?;
    if !metadata.is_dir() || metadata.permissions().readonly() {
        return Err(format!(
            "Destination parent is not writable: {}",
            parent.display()
        ));
    }
    Ok(())
}

pub(crate) fn validate_batch_destinations(files: &[(String, String)]) -> Result<(), String> {
    let mut destinations = std::collections::HashSet::new();
    for (_, destination) in files {
        let path = Path::new(destination);
        if path
            .components()
            .any(|c| c == std::path::Component::ParentDir)
        {
            return Err(format!("Invalid destination path: {destination}"));
        }
        let key = std::path::absolute(path).map_err(|e| e.to_string())?;
        if !destinations.insert(key) {
            return Err(format!(
                "Multiple source files have the same destination: {destination}"
            ));
        }
    }
    Ok(())
}

pub(crate) fn transfer(
    src: &Path,
    dst: &Path,
    move_source: bool,
    dry_run: bool,
) -> Result<(), String> {
    validate_transfer(src, dst)?;
    if dry_run {
        return Ok(());
    }
    let parent = dst
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent).map_err(|e| format!("Cannot create destination directory: {e}"))?;
    reject_symlinks(parent)?;
    let mut source = File::open(src).map_err(|e| e.to_string())?;
    let before = source.metadata().map_err(|e| e.to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    std::io::copy(&mut source, &mut temporary).map_err(|e| format!("Copy failed: {e}"))?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    source.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    temporary
        .as_file_mut()
        .seek(SeekFrom::Start(0))
        .map_err(|e| e.to_string())?;
    let source_hash = hash_reader(&mut source)?;
    let copied_hash = hash_reader(temporary.as_file_mut())?;
    let after = source.metadata().map_err(|e| e.to_string())?;
    if source_hash != copied_hash
        || before.len() != after.len()
        || before.modified().ok() != after.modified().ok()
    {
        return Err("Source changed or integrity verification failed; source retained".into());
    }
    temporary
        .as_file()
        .set_permissions(before.permissions())
        .map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    // persist_noclobber also rejects a destination created since validation.
    temporary
        .persist_noclobber(dst)
        .map_err(|e| format!("Cannot publish verified file: {e}"))?;
    // Make the destination directory entry durable before unlinking a source on Unix.
    #[cfg(unix)]
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|e| {
            format!("Destination saved but directory sync failed; source retained: {e}")
        })?;
    if move_source {
        let current = fs::metadata(src).map_err(|e| e.to_string())?;
        if current.len() != after.len() || current.modified().ok() != after.modified().ok() {
            return Err("Destination saved but source changed; source retained".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if current.dev() != after.dev() || current.ino() != after.ino() {
                return Err("Destination saved but source was replaced; source retained".into());
            }
        }
        fs::remove_file(src).map_err(|e| {
            format!(
                "Verified destination saved at {}; source could not be removed: {e}",
                dst.display()
            )
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_rejects_duplicate_destinations_and_parent_traversal() {
        assert!(validate_batch_destinations(&[
            ("a".into(), "archive/photo".into()),
            ("b".into(), "archive/./photo".into())
        ])
        .is_err());
        assert!(validate_batch_destinations(&[("a".into(), "archive/../photo".into())]).is_err());
    }

    #[test]
    fn concurrent_copies_never_replace_a_winner() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let first = dir.path().join("first");
        let second = dir.path().join("second");
        let dst = dir.path().join("archive");
        fs::write(&first, vec![1u8; 1024 * 1024]).unwrap();
        fs::write(&second, vec![2u8; 1024 * 1024]).unwrap();
        let results = std::thread::scope(|scope| {
            let a = scope.spawn(|| transfer(&first, &dst, false, false));
            let b = scope.spawn(|| transfer(&second, &dst, false, false));
            (a.join().unwrap(), b.join().unwrap())
        });
        assert_ne!(results.0.is_ok(), results.1.is_ok());
        let expected = if results.0.is_ok() { &first } else { &second };
        assert_eq!(fs::read(&dst).unwrap(), fs::read(expected).unwrap());
        assert!(first.exists() && second.exists());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 3);
    }

    #[test]
    fn copy_and_move_preserve_contents() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let src = dir.path().join("source");
        let dst = dir.path().join("archive/copy");
        fs::write(&src, b"original media").unwrap();
        transfer(&src, &dst, false, false).unwrap();
        assert_eq!(fs::read(&src).unwrap(), fs::read(&dst).unwrap());
        let moved = dir.path().join("archive/moved");
        transfer(&src, &moved, true, false).unwrap();
        assert!(!src.exists());
        assert_eq!(fs::read(&moved).unwrap(), b"original media");
    }

    #[test]
    fn conflicts_and_same_path_never_change_files() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let src = dir.path().join("source");
        let dst = dir.path().join("destination");
        fs::write(&src, b"source").unwrap();
        fs::write(&dst, b"archive").unwrap();
        for moving in [false, true] {
            for preview in [false, true] {
                assert!(transfer(&src, &dst, moving, preview).is_err());
                assert!(transfer(&src, &src, moving, preview).is_err());
            }
        }
        assert_eq!(fs::read(&src).unwrap(), b"source");
        assert_eq!(fs::read(&dst).unwrap(), b"archive");
    }

    #[test]
    fn dry_run_and_failed_copy_leave_source_untouched() {
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let src = dir.path().join("source");
        let dst = dir.path().join("new/archive/file");
        fs::write(&src, b"source").unwrap();
        transfer(&src, &dst, true, true).unwrap();
        assert!(!dir.path().join("new").exists());
        let invalid = src.join("file");
        assert!(transfer(&src, &invalid, true, false).is_err());
        assert_eq!(fs::read(&src).unwrap(), b"source");
        assert!(transfer(dir.path(), &dst, false, false).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_and_hardlink_aliases() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir_in(std::env::temp_dir().canonicalize().unwrap()).unwrap();
        let src = dir.path().join("source");
        fs::write(&src, b"source").unwrap();
        let link = dir.path().join("link");
        symlink(&src, &link).unwrap();
        assert!(transfer(&link, &dir.path().join("copy"), false, false).is_err());
        let alias = dir.path().join("alias");
        fs::hard_link(&src, &alias).unwrap();
        assert!(transfer(&src, &alias, true, false).is_err());
        let parent = dir.path().join("parent");
        symlink(dir.path(), &parent).unwrap();
        assert!(transfer(&src, &parent.join("escape"), false, false).is_err());
        assert_eq!(fs::read(&src).unwrap(), b"source");
    }
}
