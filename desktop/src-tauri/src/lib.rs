// Shared app entry point for BOTH desktop (called from main.rs) and mobile
// (Android/iOS call this directly via the tauri::mobile_entry_point attribute).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Light Again");
}
