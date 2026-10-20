/**
 * Network + device probes on desktop: the same three checks the phone
 * makes through its Kotlin module, now via small Rust commands. The LAN
 * scan emits `net-lan` events while it walks this computer's subnet.
 * Nothing is saved and nothing leaves the machine.
 */
import type { NetLogEntry } from "@core/types";

export type LanEvent = { type: "host" | "progress" | "done" | "error"; ip?: string; checked?: number; found?: number; message?: string };
export type { NetLogEntry };

export type PingResult = { ok: boolean; ms: number; detail: string };
export type DnsResult = { addresses: string[] };
export type DeviceFacts = {
  name: string | null;
  osVersion: string | null;
  cores: number;
  memoryGb: number;
  battery: string | null;
  acPower: boolean;
};

export async function pingHost(host: string): Promise<PingResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<PingResult>("net_ping", { host });
}

export async function lookupDns(host: string): Promise<DnsResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DnsResult>("net_dns", { host });
}

export async function startLanScan(): Promise<boolean> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("net_lan_start");
}

export async function stopLanScan(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("net_lan_stop");
}

export async function deviceFacts(): Promise<DeviceFacts> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DeviceFacts>("device_facts");
}

/** Subscribes to the scan's events; the remover also cancels the scan. */
export async function subscribeLan(onEvent: (event: LanEvent) => void): Promise<(this: unknown) => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<LanEvent>("net-lan", (e) => onEvent(e.payload));
  return unlisten;
}
