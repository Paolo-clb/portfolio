// Shared app entry point for BOTH desktop (called from main.rs) and mobile
// (Android/iOS call this directly via the tauri::mobile_entry_point attribute).

// Quit the whole app from the frontend (the in-game × button). `app.exit(0)` runs
// the normal shutdown and then terminates the process — reliable on desktop AND
// Android, where merely closing the WebView window does not end the activity.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app])
        .run(tauri::generate_context!())
        .expect("error while running Light Again");
}
