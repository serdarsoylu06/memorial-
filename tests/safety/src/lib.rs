// Compile the actual production safety modules without a desktop WebView SDK.
// Tests remain colocated with their implementations; there is no copy of the code.
#![allow(dead_code)]
#[path = "../../../src-tauri/src/commands/safe_fs.rs"]
mod safe_fs;
#[path = "../../../src-tauri/src/commands/zip_safety.rs"]
mod zip_safety;
