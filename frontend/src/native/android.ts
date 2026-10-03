import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import type { HomeShortcut } from "@/src/core/types";
import type { WidgetSnapshot } from "@/src/core/widgets";

export type LanEvent = { type: "host" | "progress" | "done" | "error"; ip?: string; checked?: number; found?: number; message?: string };

type Native = {
  publishSnapshot(json: string): void;
  setShortcuts(json: string): void;
  ping(host: string): Promise<{ ok: boolean; ms: number; detail: string }>;
  dns(host: string): Promise<{ addresses: string[] }>;
  startScan(): boolean;
  stopScan(): void;
  addListener(event: "onLan", listener: (event: LanEvent) => void): { remove: () => void };
};

function bridge(): Native | null {
  if (Platform.OS !== "android") return null;
  try {
    return requireNativeModule<Native>("NucleusAndroid");
  } catch {
    return null;
  }
}

export const androidReady = () => bridge() != null;

export function publishWidgets(snapshot: WidgetSnapshot) {
  bridge()?.publishSnapshot(JSON.stringify(snapshot));
}

export function publishShortcuts(items: HomeShortcut[]) {
  bridge()?.setShortcuts(JSON.stringify(items.slice(0, 4)));
}

export async function pingHost(host: string) {
  const mod = bridge();
  if (!mod) throw new Error("This check runs in the installed Android app.");
  return mod.ping(host);
}

export async function lookupDns(host: string) {
  const mod = bridge();
  if (!mod) throw new Error("This check runs in the installed Android app.");
  return mod.dns(host);
}

export function startLanScan() {
  return bridge()?.startScan() ?? false;
}

export function stopLanScan() {
  bridge()?.stopScan();
}

export function subscribeLan(fn: (event: LanEvent) => void) {
  const mod = bridge();
  if (!mod) return () => {};
  const sub = mod.addListener("onLan", fn);
  return () => sub.remove();
}
