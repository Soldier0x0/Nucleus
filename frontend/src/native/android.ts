import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import type { HomeShortcut } from "@/src/core/types";
import type { WidgetSnapshot } from "@/src/core/widgets";
import type { InboxLine } from "@/src/core/smsMoney";

export type LanEvent = { type: "host" | "progress" | "done" | "error"; ip?: string; checked?: number; found?: number; message?: string };

type Native = {
  publishSnapshot(json: string): void;
  setShortcuts(json: string): void;
  ping(host: string): Promise<{ ok: boolean; ms: number; detail: string }>;
  dns(host: string): Promise<{ addresses: string[] }>;
  startScan(): boolean;
  stopScan(): void;
  setLauncherIcon(name: string): void;
  consumePhoneLock(): boolean;
  readSms(): Promise<string>;
  showLockCard(title: string, body: string): void;
  hideLockCard(): void;
  publishCycle(json: string): void;
  writeLockedFile(path: string): Promise<boolean>;
  forgetCloudFile(): void;
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

export function applyLauncherIcon(alias: string) {
  try {
    bridge()?.setLauncherIcon(alias);
  } catch {
    /* Expo Go has no activity-alias switch. */
  }
}

/** True when the phone was locked since the last check. Minimizing the app does not set this. */
export function consumePhoneLock(): boolean {
  try {
    return bridge()?.consumePhoneLock() ?? false;
  } catch {
    return false;
  }
}

export async function readSmsInbox(): Promise<InboxLine[]> {
  const mod = bridge();
  if (!mod) return [];
  try {
    const raw = await mod.readSms();
    const parsed = JSON.parse(raw) as InboxLine[];
    return Array.isArray(parsed) ? parsed.filter((line) => line && typeof line.body === "string") : [];
  } catch {
    return [];
  }
}

export function showLockCard(title: string, body: string) {
  try {
    bridge()?.showLockCard(title, body);
  } catch {
    /* The installed app posts the lock-screen card. */
  }
}

export function hideLockCard() {
  try {
    bridge()?.hideLockCard();
  } catch {
    /* ignore */
  }
}

/** Writes the locked file to the one document this phone may store. False when the write does not happen. */
export async function writeLockedFile(path: string): Promise<boolean> {
  const mod = bridge();
  if (!mod) return false;
  try {
    return (await mod.writeLockedFile(path)) === true;
  } catch {
    return false;
  }
}

export function forgetCloudFile() {
  try {
    bridge()?.forgetCloudFile();
  } catch {
    /* The installed app keeps the document permission. */
  }
}

export function publishCycleWidget(payload: { window: string; shade: string }) {
  try {
    bridge()?.publishCycle(JSON.stringify(payload));
  } catch {
    /* Expo Go has no widget. */
  }
}

export function subscribeLan(fn: (event: LanEvent) => void) {
  const mod = bridge();
  if (!mod) return () => {};
  const sub = mod.addListener("onLan", fn);
  return () => sub.remove();
}
