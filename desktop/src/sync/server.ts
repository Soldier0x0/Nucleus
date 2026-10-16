/**
 * Tauri transport for phone-initiated sync (desktop plan D2).
 *
 * Rust owns the TCP listener, the LAN address and the mDNS advert; this module
 * starts and stops it, installs the `sync-request` listener once per webview
 * and answers each request through the shared HTTP handler.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "../platform/env";
import { fromB64, toB64, toUtf8 } from "../platform/crypto";
import { handleSyncRequest } from "./http";

export type SyncServerStart = { host: string; port: number; name: string; deviceId: string };
export type SyncServerStatus = { running: boolean; host: string | null; port: number | null };

export function startSyncServer(deviceId: string, name: string): Promise<SyncServerStart> {
  return invoke<SyncServerStart>("sync_server_start", { deviceId, name });
}

export function stopSyncServer(): Promise<void> {
  return invoke("sync_server_stop");
}

export function syncServerStatus(): Promise<SyncServerStatus> {
  return invoke<SyncServerStatus>("sync_server_status");
}

export function desktopLanIp(): Promise<string | null> {
  return invoke<string | null>("lan_ip");
}

export function desktopHostname(): Promise<string | null> {
  return invoke<string | null>("hostname");
}

let installed = false;

/** Called once at webview start so /info can answer even before the PIN is entered. */
export function installSyncBridge(): void {
  if (installed || !isTauri()) return;
  installed = true;
  void listen<{ id: number; method: string; path: string; body: string }>("sync-request", (event) => {
    const { id, method, path, body } = event.payload;
    let status = 500;
    let text = JSON.stringify({ error: "internal" });
    try {
      const answer = handleSyncRequest(method, path, fromB64(body));
      status = answer.status;
      text = answer.body;
    } catch {
      /* keep the 500 */
    }
    void invoke("sync_respond", { id, status, bodyBase64: toB64(toUtf8(text)) }).catch(() => {});
  });
}

export async function ensureSyncServer(identity: { deviceId: string; name: string }): Promise<SyncServerStatus> {
  if (!isTauri()) return { running: false, host: null, port: null };
  const status = await syncServerStatus();
  if (status.running) return status;
  const started = await startSyncServer(identity.deviceId, identity.name);
  return { running: true, host: started.host, port: started.port };
}
