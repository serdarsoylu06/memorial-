pub mod commands;

use commands::{
    analyzer::scan_inbox,
    classifier::classify_file,
    duplicate::{check_duplicates, compute_sha256},
    manifest::{read_manifest, write_manifest},
    mover::{copy_files, move_files},
    zip_handler::extract_zip,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            scan_inbox,
            classify_file,
            check_duplicates,
            compute_sha256,
            read_manifest,
            write_manifest,
            copy_files,
            move_files,
            extract_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
