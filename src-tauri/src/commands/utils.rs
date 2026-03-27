use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

/// Extract the first ASCII string value from an EXIF field.
pub fn ascii_value(field: &exif::Field) -> Option<String> {
    if let exif::Value::Ascii(ref v) = field.value {
        v.first()
            .and_then(|b| std::str::from_utf8(b).ok())
            .map(|s| s.trim_end_matches('\0').to_string())
    } else {
        None
    }
}

/// Compute the SHA-256 hex digest of a file.
pub fn compute_file_sha256(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}
