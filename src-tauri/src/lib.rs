pub mod commands;

use commands::{
    analyzer::{scan_inbox, get_archive_stats},
    classifier::classify_file,
    duplicate::{check_duplicates, compute_sha256},
    helpers::{
        get_archive_tree, get_review_files, open_in_finder, delete_file,
        check_path_exists, get_disk_usage, get_media_folder_hints, get_folder_size,
        init_folder_structure,
    },
    manifest::{read_manifest, write_manifest, write_source_json, read_source_json},
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
            get_archive_stats,
            classify_file,
            check_duplicates,
            compute_sha256,
            get_archive_tree,
            get_review_files,
            open_in_finder,
            delete_file,
            check_path_exists,
            get_disk_usage,
            get_media_folder_hints,
            get_folder_size,
            init_folder_structure,
            read_manifest,
            write_manifest,
            write_source_json,
            read_source_json,
            copy_files,
            move_files,
            extract_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
