import { Platform } from "react-native";
import Constants from "expo-constants";
import { requireNativeModule } from "expo-modules-core";
import { cloudStoreMessage } from "@/src/core/vaultFile";
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
  clearIconRestart(): void;
  consumePhoneLock(): boolean | { deviceLocked?: boolean; screenTurnedOff?: boolean };
  consumeIconRestart(): boolean;
  readBankNotices(): string;
  readBattery(): string;
  notificationAccess(): boolean;
  openNotificationListener(): string;
  installedVersion(): string;
  publishCycle(json: string): void;
  writeLockedFile(path: string): Promise<boolean>;
  storeLockedFile(provider: string, path: string): Promise<{ ok: boolean; message: string }>;
  forgetCloudFile(): void;
  addListener(event: "onLan", listener: (event: LanEvent) => void): { remove: () => void };
  addListener(event: "onBank", listener: () => void): { remove: () => void };
  addListener(event: "onNetwork", listener: (event: { type?: string }) => void): { remove: () => void };
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
    const mod = bridge();
    mod?.setLauncherIcon(alias);
    // Returning here means this process was not killed. Drop the unlock mark so a later full close still asks.
    mod?.clearIconRestart();
  } catch {
    /* Expo Go has no activity-alias switch. */
  }
}

export type PhoneLock = { deviceLocked: boolean; screenTurnedOff: boolean };

/** The screen-off latch and whether the phone is locked right now. A screenshot overlay is not a lock. */
export function readPhoneLock(): PhoneLock {
  const failClosed = { deviceLocked: true, screenTurnedOff: false };
  try {
    const mod = bridge();
    if (!mod) return failClosed;
    const raw = mod.consumePhoneLock();
    if (raw && typeof raw === "object") {
      return { deviceLocked: raw.deviceLocked === true, screenTurnedOff: raw.screenTurnedOff === true };
    }
    return { deviceLocked: raw === true, screenTurnedOff: false };
  } catch {
    return failClosed;
  }
}

/** True when the phone was locked since the last check. Minimizing the app does not set this. */
export function consumePhoneLock(): boolean {
  const phone = readPhoneLock();
  return phone.deviceLocked || phone.screenTurnedOff;
}

/** True when this process was restarted by an icon change and the phone is still unlocked. */
export function consumeIconRestart(): boolean {
  try {
    return bridge()?.consumeIconRestart() === true;
  } catch {
    return false;
  }
}

/** JSON battery facts from the sticky intent. Empty when this build has no native module. */
export function readPhoneBattery(): string {
  try {
    return bridge()?.readBattery() ?? "";
  } catch {
    return "";
  }
}

export function readBankNotices(): InboxLine[] {
  const mod = bridge();
  if (!mod) return [];
  try {
    const parsed = JSON.parse(mod.readBankNotices()) as InboxLine[];
    return Array.isArray(parsed) ? parsed.filter((line) => line && typeof line.sender === "string" && typeof line.body === "string" && typeof line.at === "string") : [];
  } catch {
    return [];
  }
}

/** True only when this app is already allowed to read notifications. Does not turn that permission on. */
export function requestNotificationAccess(): boolean {
  try {
    return bridge()?.notificationAccess() === true;
  } catch {
    return false;
  }
}

/** Opens the system notification-access screen. The app does not turn Nucleus on itself. */
export function openNotificationListener(): "opened" | "blocked" {
  try {
    return bridge()?.openNotificationListener() === "opened" ? "opened" : "blocked";
  } catch {
    return "blocked";
  }
}

/** Version name stamped into this APK. A later release follows that stamp. */
export function installedVersion(): string {
  try {
    const stamped = bridge()?.installedVersion() ?? "";
    if (stamped.trim()) return stamped.trim();
  } catch {
    /* Expo Go has no package version. */
  }
  return Constants.expoConfig?.version?.trim() ?? "";
}

/** Signs in to the chosen account and uploads the locked file. A failure carries a message. */
export async function storeLockedFile(provider: "drive" | "onedrive", path: string): Promise<{ ok: boolean; message: string }> {
  const mod = bridge();
  if (!mod) return { ok: false, message: "Sign-in runs in the installed Android app." };
  try {
    const result = await mod.storeLockedFile(provider, path);
    const message = typeof result?.message === "string" ? result.message.trim() : "";
    if (result?.ok === true) return { ok: true, message };
    return { ok: false, message: message || cloudStoreMessage(provider, "did not finish") };
  } catch (error) {
    const reason = error instanceof Error && error.message.trim() ? error.message.trim() : "did not finish";
    return { ok: false, message: cloudStoreMessage(provider, reason) };
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

export function subscribeBankNotices(fn: () => void) {
  const mod = bridge();
  if (!mod) return () => {};
  try {
    const sub = mod.addListener("onBank", fn);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

export function subscribeLan(fn: (event: LanEvent) => void) {
  const mod = bridge();
  if (!mod) return () => {};
  const sub = mod.addListener("onLan", fn);
  return () => sub.remove();
}

/** Fires when the default network changes (Wi-Fi join, reconnect) — the auto-sync nudge. */
export function subscribeNetworkWake(fn: () => void) {
  const mod = bridge();
  if (!mod) return () => {};
  try {
    const sub = mod.addListener("onNetwork", () => fn());
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
