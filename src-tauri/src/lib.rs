pub mod commands;

use commands::{
    analyzer::{scan_inbox, get_archive_stats},
    classifier::classify_file,
    duplicate::{check_duplicates, compute_sha256},
    helpers::{
        get_archive_tree, get_review_files, open_in_finder, trash_file,
        check_path_exists, get_disk_usage, get_media_folder_hints, get_folder_size,
        init_folder_structure,
    },
    manifest::{read_manifest, write_manifest, write_source_json, read_source_json},
    mover::{copy_files, move_files},
    thumbs::get_thumbnails,
    zip_handler::extract_zip,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_inbox,
            get_archive_stats,
            classify_file,
            check_duplicates,
            compute_sha256,
            get_archive_tree,
            get_review_files,
            open_in_finder,
            trash_file,
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
            get_thumbnails,
            extract_zip,
        ])
        .setup(|_app| {
            // İzleme dörtgeninde iki parmakla kaydırma, tarayıcıdaki gibi geri ve ileri gider.
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                for window in _app.webview_windows().values() {
                    window.with_webview(|webview| unsafe {
                        let view = webview.inner() as *mut objc2::runtime::AnyObject;
                        if let Some(view) = view.as_ref() {
                            let _: () = objc2::msg_send![view, setAllowsBackForwardNavigationGestures: true];
                        }
                    })?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
