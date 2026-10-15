use blake2::digest::{consts::U32, Digest};
use blake2::Blake2b;

/// Stronghold encrypts its snapshot with a key derived from the PIN.
/// The PIN never leaves the device; this KDF (BLAKE2b-256) is deterministic
/// so the same PIN opens the same snapshot.
fn pin_to_key(password: &str) -> Vec<u8> {
    let mut hasher = Blake2b::<U32>::new();
    hasher.update(b"nucleus-desktop-stronghold-v1");
    hasher.update(password.as_bytes());
    hasher.finalize().to_vec()
}

/// Writes a backup export to the path the user picked in the save dialog.
/// The fs plugin scope only covers the app data folder, so this tiny command
/// handles the one file the user explicitly chose.
#[tauri::command]
fn write_export_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_stronghold::Builder::new(pin_to_key).build())
        .invoke_handler(tauri::generate_handler![write_export_file])
        .run(tauri::generate_context!())
        .expect("error while running Nucleus");
}
