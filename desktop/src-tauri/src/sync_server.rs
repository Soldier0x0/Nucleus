//! Local-only HTTP server for phone-initiated sync (desktop plan D2).
//!
//! Deliberately dumb transport: read one minimal HTTP/1.1 request per
//! connection (GET/POST, Content-Length bodies, `Connection: close`), relay it
//! to a [`SyncHandler`] and write the answer back. All crypto and merge logic
//! stays in the webview; this module and the Tauri bridge beside it only move
//! bytes. While the daemon runs it also advertises `_nucleus._tcp.local` so the
//! phone's automatic sync can find this computer.

use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

/// The webview must answer within this window; after that the phone is told the app is locked.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;
const ACCEPT_POLL: Duration = Duration::from_millis(25);
const SOCKET_TIMEOUT: Duration = Duration::from_secs(10);
pub const SERVICE_TYPE: &str = "_nucleus._tcp.local.";

pub struct SyncRequest {
    pub method: String,
    pub path: String,
    pub body: Vec<u8>,
}

pub struct SyncResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

/// Answers one relayed request. `None` writes the 503 locked fallback.
pub trait SyncHandler: Send + Sync + 'static {
    fn handle(&self, request: SyncRequest) -> Option<SyncResponse>;
}

/// Blocks until the webview answers or `timeout` passes (the 5 s locked fallback).
pub fn wait_for_answer(receiver: std::sync::mpsc::Receiver<SyncResponse>, timeout: Duration) -> Option<SyncResponse> {
    receiver.recv_timeout(timeout).ok()
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub host: String,
    pub port: u16,
    pub name: String,
    pub device_id: String,
}

pub struct StartOptions {
    pub name: String,
    pub device_id: String,
    pub advertise: bool,
}

pub struct RunningServer {
    running: Arc<AtomicBool>,
    addr: SocketAddr,
    accept: Option<JoinHandle<()>>,
    mdns: Option<Mdns>,
}

struct Mdns {
    daemon: mdns_sd::ServiceDaemon,
}

impl RunningServer {
    pub fn start(handler: Arc<dyn SyncHandler>, options: StartOptions) -> std::io::Result<RunningServer> {
        let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 8787))
            .or_else(|_| TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0)))?;
        listener.set_nonblocking(true)?;
        let addr = listener.local_addr()?;
        let running = Arc::new(AtomicBool::new(true));
        let accept = {
            let running = running.clone();
            let handler = handler.clone();
            thread::spawn(move || accept_loop(listener, running, handler))
        };
        let mdns = if options.advertise { advertise(&options, addr.port()) } else { None };
        Ok(RunningServer { running, addr, accept: Some(accept), mdns })
    }

    pub fn port(&self) -> u16 {
        self.addr.port()
    }

    pub fn stop(mut self) {
        self.shutdown();
    }

    fn shutdown(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(accept) = self.accept.take() {
            let _ = accept.join();
        }
        if let Some(mdns) = self.mdns.take() {
            let _ = mdns.daemon.shutdown();
        }
    }
}

impl Drop for RunningServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn accept_loop(listener: TcpListener, running: Arc<AtomicBool>, handler: Arc<dyn SyncHandler>) {
    while running.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => {
                let handler = handler.clone();
                thread::spawn(move || serve(stream, handler));
            }
            Err(_) => thread::sleep(ACCEPT_POLL),
        }
    }
}

fn serve(mut stream: TcpStream, handler: Arc<dyn SyncHandler>) {
    let _ = stream.set_read_timeout(Some(SOCKET_TIMEOUT));
    let _ = stream.set_write_timeout(Some(SOCKET_TIMEOUT));
    let response = match read_request(&mut stream) {
        Ok(Some(request)) if request.method == "GET" || request.method == "POST" => {
            handler.handle(request).unwrap_or_else(locked_response)
        }
        Ok(Some(_)) => json_response(405, r#"{"error":"method-not-allowed"}"#),
        Ok(None) | Err(_) => json_response(400, r#"{"error":"bad-request"}"#),
    };
    let _ = write_response(&mut stream, response.status, &response.body);
    let _ = stream.shutdown(Shutdown::Both);
}

fn locked_response() -> SyncResponse {
    json_response(503, r#"{"error":"locked"}"#)
}

fn json_response(status: u16, body: &str) -> SyncResponse {
    SyncResponse { status, body: body.as_bytes().to_vec() }
}

fn read_request(stream: &mut TcpStream) -> std::io::Result<Option<SyncRequest>> {
    let mut buf: Vec<u8> = Vec::with_capacity(1024);
    let header_end = loop {
        if let Some(pos) = find_subsequence(&buf, b"\r\n\r\n") {
            break pos + 4;
        }
        if buf.len() > MAX_HEADER_BYTES {
            return Ok(None);
        }
        let mut chunk = [0u8; 4096];
        let n = stream.read(&mut chunk)?;
        if n == 0 {
            return Ok(None);
        }
        buf.extend_from_slice(&chunk[..n]);
    };

    let head = String::from_utf8_lossy(&buf[..header_end]);
    let mut lines = head.split("\r\n");
    let mut parts = lines.next().unwrap_or("").split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();
    if method.is_empty() || path.is_empty() {
        return Ok(None);
    }

    let mut content_length: Option<usize> = None;
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse().ok();
            }
        }
    }
    let need = match content_length {
        Some(n) if n <= MAX_BODY_BYTES => n,
        Some(_) => return Ok(None),
        None => 0,
    };

    let mut body = buf[header_end..].to_vec();
    while body.len() < need {
        let mut chunk = [0u8; 8192];
        let n = stream.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..n]);
    }
    if body.len() < need {
        return Ok(None);
    }
    body.truncate(need);
    Ok(Some(SyncRequest { method, path, body }))
}

fn write_response(stream: &mut TcpStream, status: u16, body: &[u8]) -> std::io::Result<()> {
    let head = format!(
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        reason_for(status),
        body.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()
}

fn reason_for(status: u16) -> &'static str {
    match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        411 => "Length Required",
        413 => "Payload Too Large",
        500 => "Internal Server Error",
        503 => "Service Unavailable",
        _ => "Unknown",
    }
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// First non-loopback IPv4 on this machine, private ranges first.
pub fn lan_ip() -> Option<String> {
    let addrs = local_ip_address::list_afinet_netifas().ok()?;
    let mut fallback: Option<String> = None;
    for (_, ip) in addrs {
        let IpAddr::V4(v4) = ip else { continue };
        if v4.is_loopback() || v4.is_link_local() || v4.is_unspecified() {
            continue;
        }
        if v4.is_private() {
            return Some(v4.to_string());
        }
        fallback.get_or_insert_with(|| v4.to_string());
    }
    fallback
}

pub fn hostname() -> Option<String> {
    let name = gethostname::gethostname().to_string_lossy().trim().to_string();
    (!name.is_empty()).then_some(name)
}

fn advertise(options: &StartOptions, port: u16) -> Option<Mdns> {
    let ip = lan_ip()?;
    let daemon = mdns_sd::ServiceDaemon::new().ok()?;
    let instance = format!("nucleus-{}", options.device_id);
    let host = hostname().map(|h| format!("{}.local.", h.replace(' ', "-"))).unwrap_or_else(|| "nucleus.local.".to_string());
    let service = mdns_sd::ServiceInfo::new(
        SERVICE_TYPE,
        &instance,
        &host,
        ip.as_str(),
        port,
        &[("deviceId", options.device_id.as_str()), ("name", options.name.as_str())][..],
    )
    .ok()?;
    daemon.register(service).ok()?;
    Some(Mdns { daemon })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::sync::Mutex;

    struct TestHandler {
        seen: Mutex<Vec<(String, String, Vec<u8>)>>,
        reply: Mutex<Option<SyncResponse>>,
    }

    impl TestHandler {
        fn new(reply: Option<SyncResponse>) -> Arc<TestHandler> {
            Arc::new(TestHandler { seen: Mutex::new(Vec::new()), reply: Mutex::new(reply) })
        }
    }

    impl SyncHandler for TestHandler {
        fn handle(&self, request: SyncRequest) -> Option<SyncResponse> {
            self.seen.lock().unwrap().push((request.method, request.path, request.body));
            self.reply.lock().unwrap().take()
        }
    }

    fn start(reply: Option<SyncResponse>) -> (Arc<TestHandler>, RunningServer) {
        let handler = TestHandler::new(reply);
        let server = RunningServer::start(
            handler.clone(),
            StartOptions { name: "Test Desk".into(), device_id: "abcd".into(), advertise: false },
        )
        .expect("server starts");
        (handler, server)
    }

    fn send(port: u16, request: &[u8]) -> (u16, String) {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("connect");
        stream.set_read_timeout(Some(SOCKET_TIMEOUT)).unwrap();
        stream.write_all(request).unwrap();
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw).unwrap();
        let text = String::from_utf8_lossy(&raw).to_string();
        let status = text
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse::<u16>().ok())
            .unwrap_or(0);
        let body = text.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
        (status, body)
    }

    #[test]
    fn relays_get_info_and_writes_the_response() {
        let (handler, server) = start(Some(SyncResponse { status: 200, body: b"{\"t\":\"nucleus-info-1\"}".to_vec() }));
        let (status, body) = send(server.port(), b"GET /info HTTP/1.1\r\nHost: x\r\n\r\n");
        assert_eq!(status, 200);
        assert_eq!(body, "{\"t\":\"nucleus-info-1\"}");
        let seen = handler.seen.lock().unwrap();
        assert_eq!(seen.len(), 1);
        assert_eq!(seen[0].0, "GET");
        assert_eq!(seen[0].1, "/info");
        assert!(seen[0].2.is_empty());
    }

    #[test]
    fn relays_post_body_with_content_length() {
        let (handler, server) = start(Some(SyncResponse { status: 200, body: b"{\"ok\":true}".to_vec() }));
        let payload = b"{\"t\":\"nucleus-pair-1\",\"body\":\"NPS1.a.b\"}";
        let request = format!(
            "POST /pair HTTP/1.1\r\nHost: x\r\nContent-Length: {}\r\n\r\n{}",
            payload.len(),
            String::from_utf8_lossy(payload)
        );
        let (status, body) = send(server.port(), request.as_bytes());
        assert_eq!(status, 200);
        assert_eq!(body, "{\"ok\":true}");
        let seen = handler.seen.lock().unwrap();
        assert_eq!(seen.len(), 1);
        assert_eq!(seen[0].0, "POST");
        assert_eq!(seen[0].1, "/pair");
        assert_eq!(seen[0].2, payload);
    }

    #[test]
    fn a_handler_with_no_answer_gets_the_503_locked_fallback() {
        let (_, server) = start(None);
        let (status, body) = send(server.port(), b"POST /sync HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\n\r\n");
        assert_eq!(status, 503);
        assert_eq!(body, "{\"error\":\"locked\"}");
    }

    #[test]
    fn a_bridge_that_never_answers_hits_the_503_fallback_after_the_wait() {
        struct SlowBridge;
        impl SyncHandler for SlowBridge {
            fn handle(&self, _request: SyncRequest) -> Option<SyncResponse> {
                let (_tx, rx) = mpsc::channel::<SyncResponse>();
                wait_for_answer(rx, Duration::from_millis(30))
            }
        }
        let server = RunningServer::start(
            Arc::new(SlowBridge),
            StartOptions { name: "Test".into(), device_id: "abcd".into(), advertise: false },
        )
        .expect("server starts");
        let (status, body) = send(server.port(), b"GET /info HTTP/1.1\r\nHost: x\r\n\r\n");
        assert_eq!(status, 503);
        assert_eq!(body, "{\"error\":\"locked\"}");
    }

    #[test]
    fn other_methods_are_rejected_at_the_transport() {
        let (handler, server) = start(Some(SyncResponse { status: 200, body: b"{}".to_vec() }));
        let (status, body) = send(server.port(), b"DELETE /info HTTP/1.1\r\nHost: x\r\n\r\n");
        assert_eq!(status, 405);
        assert_eq!(body, "{\"error\":\"method-not-allowed\"}");
        assert!(handler.seen.lock().unwrap().is_empty());
    }
}
