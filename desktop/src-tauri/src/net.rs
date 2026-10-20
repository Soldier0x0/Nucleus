//! Network tools (v0.16): ping, DNS lookup and a scan of the private subnet
//! the computer sits on. Mirrors the phone's Kotlin checks. Nothing is
//! saved and nothing leaves this machine: ping and DNS only touch the
//! name the user typed, the scan only looks at this device's own subnet
//! while the screen is open.

use serde::Serialize;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResult {
    ok: bool,
    ms: u64,
    detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsResult {
    addresses: Vec<String>,
}

/// A host name or address may only contain name characters — no spaces or
/// separators that could shape a shell or a path. The `Command` call has no
/// shell either; this is belt and braces.
fn valid_host(host: &str) -> bool {
    let trimmed = host.trim();
    if trimmed.is_empty() || trimmed.len() > 253 {
        return false;
    }
    trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '_' | '%'))
}

#[tauri::command]
pub fn net_ping(host: String) -> Result<PingResult, String> {
    if !valid_host(&host) {
        return Err("The name or address looks off.".to_string());
    }
    let target = host.trim().to_string();
    let started = Instant::now();
    let output = {
        #[cfg(target_os = "windows")]
        let mut cmd = std::process::Command::new("ping");
        #[cfg(target_os = "windows")]
        cmd.arg("-n").arg("1").arg("-w").arg("5000").arg(&target);
        #[cfg(not(target_os = "windows"))]
        let mut cmd = std::process::Command::new("ping");
        #[cfg(not(target_os = "windows"))]
        cmd.arg("-c").arg("1").arg("-w").arg("5").arg(&target);
        cmd.output().map_err(|e| format!("ping could not run: {e}"))?
    };
    let ms = started.elapsed().as_millis() as u64;
    let ok = output.status.success();
    if !ok {
        return Ok(PingResult { ok, ms, detail: "No reply".to_string() });
    }
    // Some pings answer with success only when the round trip completed;
    // parse the reply text as the honest final word.
    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
    if text.contains("100% packet loss") || text.contains("(100% loss)") {
        return Ok(PingResult { ok: false, ms, detail: "No reply".to_string() });
    }
    Ok(PingResult { ok: true, ms, detail: "answered".to_string() })
}

#[tauri::command]
pub fn net_dns(host: String) -> Result<DnsResult, String> {
    if !valid_host(&host) {
        return Err("The name or address looks off.".to_string());
    }
    let target = host.trim().to_string();
    let list = match (&target as &str, 0u16).to_socket_addrs() {
        Ok(addrs) => addrs.map(|addr| addr.ip().to_string()).collect::<Vec<_>>(),
        Err(_) => return Err("That name did not resolve.".to_string()),
    };
    Ok(DnsResult { addresses: list })
}

pub struct LanState {
    pub stop: Mutex<Option<std::sync::Arc<AtomicBool>>>,
}

impl Default for LanState {
    fn default() -> Self {
        LanState { stop: Mutex::new(None) }
    }
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
enum LanEvent {
    Host { ip: String },
    Progress { checked: u32 },
    Done { found: u32 },
    Error { message: String },
}

#[tauri::command]
pub fn net_lan_start(app: AppHandle, state: State<'_, LanState>) -> Result<bool, String> {
    {
        let mut guard = state.stop.lock().unwrap();
        if guard.as_ref().is_some_and(|flag| !flag.load(Ordering::Relaxed)) {
            return Ok(true); // a scan is already running
        }
        *guard = None;
    }
    let base = crate::sync_server::lan_ip().ok_or("This computer does not seem to be on a network.")?;
    if (base.matches('.').count()) != 3 {
        return Err("The network address looks unusual, so no scan was started.".to_string());
    }
    let prefix = base.rsplit_once('.').map(|(a, _)| a.to_string()).ok_or("No subnet address.")?;
    let flag = std::sync::Arc::new(AtomicBool::new(false));
    *state.stop.lock().unwrap() = Some(flag.clone());
    let handle = app.clone();
    std::thread::spawn(move || {
        let flag = flag;
        let ports: [u16; 4] = [80, 443, 8080, 42147];
        let mut checked: u32 = 0;
        let mut found: u32 = 0;
        let mut guard = 0usize;
        for n in 1u32..=254 {
            if flag.load(Ordering::Relaxed) {
                let _ = handle.emit("net-lan", LanEvent::Error { message: "The scan stopped.".to_string() });
                return;
            }
            let ip = format!("{prefix}.{n}");
            let answered = ports.iter().any(|port| {
                let addr = format!("{ip}:{port}")
                    .parse::<std::net::SocketAddr>()
                    .unwrap_or_else(|_| "0.0.0.0:0".parse().unwrap());
                TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok()
            });
            checked += 1;
            if answered {
                found += 1;
                let _ = handle.emit("net-lan", LanEvent::Host { ip: ip.clone() });
            }
            guard += 1;
            if guard % 16 == 0 {
                let _ = handle.emit("net-lan", LanEvent::Progress { checked });
            }
        }
        let _ = handle.emit("net-lan", LanEvent::Done { found });
        // The scan owns the flag slot only while it runs; clear it so the next start can begin.
        let _ = handle.state::<LanState>().stop.lock().unwrap().take();
    });
    Ok(true)
}

#[tauri::command]
pub fn net_lan_stop(state: State<'_, LanState>) {
    if let Some(flag) = state.stop.lock().unwrap().as_ref() {
        flag.store(true, Ordering::Relaxed);
    }
}

/// Lab (Phone-only family, v0.16): the battery, model and OS facts a
/// computer actually has. Sensors and call numbers honestly do not exist
/// on a desktop, so the screen shows that plainly.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFacts {
    name: Option<String>,
    os_version: Option<String>,
    cores: u32,
    memory_gb: f64,
    battery: Option<String>,
    ac_power: bool,
}

fn read_battery_percent() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "(Get-CimInstance Win32_Battery).EstimatedChargeRemaining"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        let pct = text.trim().parse::<u32>().ok()?;
        Some(format!("{pct}%"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::fs;
        for dir in fs::read_dir("/sys/class/power_supply").ok()? {
            let dir = dir.ok()?;
            let path = dir.path().join("capacity");
            if let Ok(cap) = fs::read_to_string(&path) {
                return cap.trim().parse::<u32>().ok().map(|v| format!("{v}%"));
            }
        }
        None
    }
}

fn read_ac_power() -> bool {
    use std::fs;
    for dir in fs::read_dir("/sys/class/power_supply").ok().into_iter().flatten() {
        let Ok(dir) = dir else { continue };
        let name = dir.file_name().to_string_lossy().to_string();
        if !name.starts_with('A') {
            continue;
        }
        if let Ok(state) = fs::read_to_string(dir.path().join("online")) {
            return state.trim().ends_with('1');
        }
    }
    false
}

#[tauri::command]
pub fn device_facts() -> DeviceFacts {
    DeviceFacts {
        name: crate::sync_server::hostname(),
        os_version: os_version(),
        cores: std::thread::available_parallelism().map(|n| n.get() as u32).unwrap_or(1),
        memory_gb: total_memory_gb(),
        battery: read_battery_percent(),
        ac_power: read_ac_power(),
    }
}

fn os_version() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let out = std::process::Command::new("cmd").args(["/c", "ver"]).output().ok()?;
        let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if text.split_whitespace().count() == 0 {
            return None;
        }
        Some(text)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let text = std::fs::read_to_string("/etc/os-release").ok()?;
        let line = text.lines().find(|l| l.starts_with("PRETTY_NAME="))?;
        Some(line.trim_start_matches("PRETTY_NAME=").trim_matches('"').to_string())
    }
}

fn total_memory_gb() -> f64 {
    #[cfg(target_os = "windows")]
    {
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1)"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        let value = text.trim().parse::<f64>().ok()?;
        (value * 10.0).floor() / 10.0
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::fs::read_to_string("/proc/meminfo")
            .ok()
            .and_then(|text| {
                let line = text.lines().find(|l| l.starts_with("MemTotal:"))?;
                line.split_whitespace().nth(1)?.parse::<u64>().ok()
            })
            .map(|kb| (kb as f64 / 1_048_576.0 * 10.0).floor() / 10.0)
            .unwrap_or(0.0)
    }
}
