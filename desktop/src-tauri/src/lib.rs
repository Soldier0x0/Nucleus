use blake2::digest::{consts::U32, Digest};
use blake2::Blake2b;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::MacosLauncher;

mod sync_server;
use sync_server::{RunningServer, ServerInfo, StartOptions, SyncHandler, SyncRequest, SyncResponse};

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

/// Relays one HTTP request to the webview and waits up to 5 s for the answer.
struct WebviewBridge {
    app: AppHandle,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, Sender<SyncResponse>>>,
}

impl WebviewBridge {
    fn new(app: AppHandle) -> Self {
        WebviewBridge { app, next_id: AtomicU64::new(1), pending: Mutex::new(HashMap::new()) }
    }
}

impl SyncHandler for WebviewBridge {
    fn handle(&self, request: SyncRequest) -> Option<SyncResponse> {
        if self.app.webview_windows().is_empty() {
            return None;
        }
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::channel();
        self.pending.lock().unwrap().insert(id, sender);
        let payload = serde_json::json!({
            "id": id,
            "method": request.method,
            "path": request.path,
            "body": B64.encode(&request.body),
        });
        if self.app.emit("sync-request", payload).is_err() {
            self.pending.lock().unwrap().remove(&id);
            return None;
        }
        let answer = sync_server::wait_for_answer(receiver, sync_server::REQUEST_TIMEOUT);
        self.pending.lock().unwrap().remove(&id);
        answer
    }
}

struct SyncState {
    bridge: Arc<WebviewBridge>,
    server: Mutex<Option<RunningServer>>,
    info: Mutex<Option<ServerInfo>>,
}

impl SyncState {
    fn new(app: AppHandle) -> Self {
        SyncState { bridge: Arc::new(WebviewBridge::new(app)), server: Mutex::new(None), info: Mutex::new(None) }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerStatus {
    running: bool,
    host: Option<String>,
    port: Option<u16>,
}

/// Called by the webview as the answer to one `sync-request` event.
#[tauri::command]
fn sync_respond(state: State<'_, SyncState>, id: u64, status: u16, body_base64: String) -> Result<(), String> {
    let sender = state.bridge.pending.lock().unwrap().remove(&id).ok_or("no pending request")?;
    let body = B64.decode(body_base64).unwrap_or_default();
    sender.send(SyncResponse { status, body }).map_err(|_| "request dropped".to_string())
}

#[tauri::command]
fn sync_server_start(state: State<'_, SyncState>, device_id: String, name: String) -> Result<ServerInfo, String> {
    let mut server = state.server.lock().unwrap();
    if server.is_some() {
        drop(server);
        return state.info.lock().unwrap().clone().ok_or_else(|| "server info missing".to_string());
    }
    let running = RunningServer::start(
        state.bridge.clone(),
        StartOptions { name: name.clone(), device_id: device_id.clone(), advertise: true },
    )
    .map_err(|e| e.to_string())?;
    let info = ServerInfo {
        host: sync_server::lan_ip().unwrap_or_else(|| "127.0.0.1".to_string()),
        port: running.port(),
        name,
        device_id,
    };
    *state.info.lock().unwrap() = Some(info.clone());
    *server = Some(running);
    Ok(info)
}

#[tauri::command]
fn sync_server_stop(state: State<'_, SyncState>) {
    if let Some(running) = state.server.lock().unwrap().take() {
        running.stop();
    }
    *state.info.lock().unwrap() = None;
}

#[tauri::command]
fn sync_server_status(state: State<'_, SyncState>) -> ServerStatus {
    let running = state.server.lock().unwrap().is_some();
    let info = state.info.lock().unwrap().clone();
    ServerStatus {
        running,
        host: info.as_ref().map(|i| i.host.clone()),
        port: info.map(|i| i.port),
    }
}

#[tauri::command]
fn lan_ip() -> Option<String> {
    sync_server::lan_ip()
}

#[tauri::command]
fn hostname() -> Option<String> {
    sync_server::hostname()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![])))
        .plugin(tauri_plugin_stronghold::Builder::new(pin_to_key).build())
        .setup(|app| {
            app.manage(SyncState::new(app.handle().clone()));
            setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            write_export_file,
            sync_respond,
            sync_server_start,
            sync_server_stop,
            sync_server_status,
            lan_ip,
            hostname
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nucleus");
}

/// The Nucleus tray (v0.14): show the window or quit. Left-click also shows.
fn setup_tray(app: &tauri::App) -> Result<(), tauri::Error> {
    let show = MenuItem::with_id(app, "show", "Show Nucleus", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Nucleus", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    TrayIconBuilder::with_id("nucleus")
        .icon(app.default_window_icon().expect("default window icon").clone())
        .tooltip("Nucleus")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}
