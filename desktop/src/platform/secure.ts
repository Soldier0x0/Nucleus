/**
 * Secure key storage.
 *
 * Native: the device key (32 random bytes) and the PIN record live inside a
 * Stronghold snapshot under the app-data folder, encrypted with a key derived
 * from the PIN (BLAKE2b-256, see src-tauri/src/lib.rs). A wrong PIN fails to
 * open the snapshot, so it acts as the lock.
 *
 * Browser preview (`yarn dev`): plain localStorage, clearly dev-only.
 *
 * The PIN is required on every launch. Locking simply drops the cached key;
 * the document itself is only ever written in NCE1 envelopes.
 */
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir, join } from "@tauri-apps/api/path";
import { isTauri } from "./env";
import { storage } from "./storage";
import { randomBytes, randomId, toB64, toUtf8, fromUtf8 } from "./crypto";
import { makePinRecord, verifyPinRecord, nextBackoff, type Backoff, type PinRecord } from "./security";

const MARKER_KEY = "nucleus.desktop.secure.v1";
const BACKOFF_KEY = "nucleus.desktop.backoff.v1";
const CLIENT = "nucleus";
const DEV_KEY = "nucleus.desktop.device-key";
const DEV_PIN = "nucleus.desktop.pin";

type Marker = { v: 1; vault: string };
type SecureSnapshot = { deviceKey: Uint8Array; pin: PinRecord };

export class WrongPinError extends Error {
  constructor() {
    super("Wrong PIN");
    this.name = "WrongPinError";
  }
}

export class SecureStoreMissingError extends Error {
  constructor() {
    super("The key store on this computer is missing");
    this.name = "SecureStoreMissingError";
  }
}

let sessionKey: Uint8Array | null = null;
let devWarned = false;

const vaultPassword = (pin: string) => `nucleus.pin:${pin}`;

async function readMarker(): Promise<Marker | null> {
  try {
    const raw = await storage.getItem(MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Marker;
    if (parsed?.v !== 1 || typeof parsed.vault !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeMarker(marker: Marker): Promise<void> {
  await storage.setItem(MARKER_KEY, JSON.stringify(marker));
}

async function strongholdPath(file: string): Promise<string> {
  return join(await appDataDir(), file);
}

/** Reads a snapshot after it has been opened. */
async function readSnapshot(path: string, pin: string): Promise<SecureSnapshot> {
  const stronghold = await Stronghold.load(path, vaultPassword(pin)).catch(() => {
    throw new WrongPinError();
  });
  let client;
  try {
    client = await stronghold.loadClient(CLIENT);
  } catch {
    throw new WrongPinError();
  }
  const store = client.getStore();
  const keyBytes = await store.get("device-key").catch(() => null);
  const pinBytes = await store.get("pin").catch(() => null);
  if (!keyBytes || !pinBytes || keyBytes.length !== 32) throw new WrongPinError();
  const record = JSON.parse(fromUtf8(pinBytes)) as PinRecord;
  if (!(await verifyPinRecord(record, pin))) throw new WrongPinError();
  return { deviceKey: keyBytes, pin: record };
}

async function writeSnapshot(path: string, pin: string, snapshot: SecureSnapshot): Promise<void> {
  const stronghold = await Stronghold.load(path, vaultPassword(pin));
  let client;
  try {
    client = await stronghold.loadClient(CLIENT);
  } catch {
    client = await stronghold.createClient(CLIENT);
  }
  const store = client.getStore();
  await store.insert("device-key", Array.from(snapshot.deviceKey));
  await store.insert("pin", Array.from(toUtf8(JSON.stringify(snapshot.pin))));
  await stronghold.save();
}

export async function secureStatus(): Promise<{ initialized: boolean }> {
  return { initialized: (await readMarker()) !== null };
}

/** First run: create the vault and choose a PIN. */
export async function createSecure(pin: string): Promise<void> {
  const marker = await readMarker();
  if (marker) throw new Error("A PIN is already set on this computer");
  if (isTauri()) {
    const file = `nucleus-keys-${randomId()}.hold`;
    const snapshot: SecureSnapshot = { deviceKey: randomBytes(32), pin: await makePinRecord(pin) };
    await writeSnapshot(await strongholdPath(file), pin, snapshot);
    sessionKey = snapshot.deviceKey;
    await writeMarker({ v: 1, vault: file });
    return;
  }
  if (!devWarned) {
    devWarned = true;
    console.warn("[Nucleus] Browser preview: the device key and PIN record are kept in plain localStorage. Dev only.");
  }
  const deviceKey = randomBytes(32);
  localStorage.setItem(DEV_KEY, toB64(deviceKey));
  localStorage.setItem(DEV_PIN, JSON.stringify(await makePinRecord(pin)));
  await writeMarker({ v: 1, vault: "dev-preview" });
  sessionKey = deviceKey;
}

/** Unlocks the vault and caches the device key for this run. */
export async function unlockSecure(pin: string): Promise<void> {
  if (isTauri()) {
    const marker = await readMarker();
    if (!marker) throw new SecureStoreMissingError();
    const snapshot = await readSnapshot(await strongholdPath(marker.vault), pin);
    sessionKey = snapshot.deviceKey;
    return;
  }
  const keyRaw = localStorage.getItem(DEV_KEY);
  const pinRaw = localStorage.getItem(DEV_PIN);
  if (!keyRaw || !pinRaw) throw new SecureStoreMissingError();
  const record = JSON.parse(pinRaw) as PinRecord;
  if (!(await verifyPinRecord(record, pin))) throw new WrongPinError();
  sessionKey = Uint8Array.from(atob(keyRaw), (c) => c.charCodeAt(0));
}

export function lockSecure(): void {
  sessionKey = null;
}

export function isUnlocked(): boolean {
  return sessionKey !== null;
}

export function getDeviceKey(): Uint8Array {
  if (!sessionKey) throw new Error("The vault is locked");
  return sessionKey;
}

/**
 * Rotates the Stronghold snapshot onto a new file with a PIN-derived key.
 * The device key never changes, so the saved document stays readable.
 */
export async function changeSecurePin(oldPin: string, newPin: string): Promise<void> {
  if (!isTauri()) {
    await unlockSecure(oldPin);
    localStorage.setItem(DEV_PIN, JSON.stringify(await makePinRecord(newPin)));
    return;
  }
  const marker = await readMarker();
  if (!marker) throw new SecureStoreMissingError();
  const oldPath = await strongholdPath(marker.vault);
  const snapshot = await readSnapshot(oldPath, oldPin);
  const newFile = `nucleus-keys-${randomId()}.hold`;
  const newPath = await strongholdPath(newFile);
  await writeSnapshot(newPath, newPin, snapshot);
  await writeMarker({ v: 1, vault: newFile });
  sessionKey = snapshot.deviceKey;
  try {
    const old = await Stronghold.load(oldPath, vaultPassword(oldPin));
    await old.unload();
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(oldPath).catch(() => {});
  } catch {
    /* A leftover snapshot is harmless: the marker no longer points at it. */
  }
}

/** Lock-screen recovery: forget the PIN and key store. Documents must be re-imported. */
export async function resetSecure(): Promise<void> {
  if (isTauri()) {
    const marker = await readMarker();
    if (marker) {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(await strongholdPath(marker.vault)).catch(() => {});
    }
    await storage.removeItem(MARKER_KEY);
    await storage.removeItem(BACKOFF_KEY);
  } else {
    localStorage.removeItem(DEV_KEY);
    localStorage.removeItem(DEV_PIN);
    await storage.removeItem(MARKER_KEY);
    await storage.removeItem(BACKOFF_KEY);
  }
  sessionKey = null;
}

// ---------- wrong-PIN back-off ----------
export async function readBackoff(): Promise<Backoff> {
  try {
    const raw = await storage.getItem(BACKOFF_KEY);
    return raw ? (JSON.parse(raw) as Backoff) : { fails: 0, until: 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
}

export async function registerFailure(): Promise<Backoff> {
  const next = nextBackoff(await readBackoff());
  await storage.setItem(BACKOFF_KEY, JSON.stringify(next));
  return next;
}

export async function clearFailures(): Promise<void> {
  await storage.removeItem(BACKOFF_KEY);
}
