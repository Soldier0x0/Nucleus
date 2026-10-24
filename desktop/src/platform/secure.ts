/**
 * Secure key storage.
 *
 * Native: the device key (32 random bytes) and the PIN record live inside a
 * Stronghold snapshot under the app-data folder, encrypted with a key derived
 * from the PIN (BLAKE2b-256, see src-tauri/src/lib.rs). A wrong PIN fails to
 * open the snapshot, so it acts as the lock.
 *
 * The PIN is optional (v0.18): `createSecure(null)` and `changeSecurePin(_, null)`
 * seal the snapshot with a fixed password so the app opens straight to the data
 * on launch. Without a PIN nothing gates the app — the document itself stays
 * NCE1-encrypted either way; with a PIN, every launch must type it.
 *
 * Browser preview (`yarn dev`): plain localStorage, clearly dev-only.
 * Locking simply drops the cached key.
 */
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir, join } from "@tauri-apps/api/path";
import { isTauri } from "./env";
import { storage } from "./storage";
import { DB_KEY, LEGACY_DB_KEY } from "@core/defaults";
import { randomBytes, randomId, toB64, toUtf8, fromUtf8 } from "./crypto";
import { makePinRecord, verifyPinRecord, nextBackoff, type Backoff, type PinRecord } from "./security";

const MARKER_KEY = "nucleus.desktop.secure.v1";
const BACKOFF_KEY = "nucleus.desktop.backoff.v1";
const CLIENT = "nucleus";
const DEV_KEY = "nucleus.desktop.device-key";
const DEV_PIN = "nucleus.desktop.pin";

type Marker = { v: 1; vault: string };
type SecureSnapshot = { deviceKey: Uint8Array; pin: PinRecord | null };

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
/** Last observed app-lock state. Kept in memory on purpose: the stronghold
 *  plugin must not be asked for the same snapshot with a second password while
 *  the first instance is alive (it stalls) — boot probe / unlock / rotate all
 *  already know the answer by the time Settings mounts. */
let knownPin: boolean | null = null;
const rememberPin = (has: boolean | null) => {
  knownPin = has;
};

/** Password for the no-PIN snapshot: obscure, not a gate — by design (optional lock). */
const vaultPassword = (pin: string | null) => (pin ? `nucleus.pin:${pin}` : "nucleus.pin:none");

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

/**
 * Reads a snapshot after it has been opened. `pin: null` only succeeds when the snapshot has no PIN.
 *
 * The stronghold plugin starts a FRESH EMPTY instance whenever the snapshot
 * file does not exist, and `unload()` persists that instance before dropping
 * it — so a read against a missing file must be rejected before any load:
 * otherwise the store would be silently replaced by an empty snapshot.
 * The actor is always released after use (#rotation stall).
 */
async function readSnapshot(path: string, pin: string | null): Promise<SecureSnapshot> {
  const { exists } = await import("@tauri-apps/plugin-fs");
  if (!(await exists(path))) throw new SecureStoreMissingError();
  const stronghold = await Stronghold.load(path, vaultPassword(pin)).catch(() => {
    throw new WrongPinError();
  });
  try {
    let client;
    try {
      client = await stronghold.loadClient(CLIENT);
    } catch {
      throw new WrongPinError();
    }
    const store = client.getStore();
    const keyBytes = await store.get("device-key").catch(() => null);
    const pinBytes = await store.get("pin").catch(() => null);
    if (!keyBytes || keyBytes.length !== 32) throw new WrongPinError();
    const record: PinRecord | null = pinBytes ? ((JSON.parse(fromUtf8(pinBytes)) as PinRecord | null) ?? null) : null;
    if (record === null) {
      if (pin !== null) throw new WrongPinError();
      return { deviceKey: keyBytes, pin: null };
    }
    if (pin === null || typeof pin !== "string") throw new WrongPinError();
    if (!(await verifyPinRecord(record, pin))) throw new WrongPinError();
    return { deviceKey: keyBytes, pin: record };
  } finally {
    await stronghold.unload().catch(() => {});
  }
}

async function writeSnapshot(path: string, pin: string | null, snapshot: SecureSnapshot): Promise<void> {
  const stronghold = await Stronghold.load(path, vaultPassword(pin));
  try {
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
  } finally {
    await stronghold.unload().catch(() => {});
  }
}

export async function secureStatus(): Promise<{ initialized: boolean }> {
  return { initialized: (await readMarker()) !== null };
}

/** First run: create the vault. `pin === null` means "no app lock on this computer". */
export async function createSecure(pin: string | null): Promise<void> {
  const marker = await readMarker();
  if (marker) throw new Error("A key store is already set up on this computer");
  if (isTauri()) {
    const file = `nucleus-keys-${randomId()}.hold`;
    const snapshot: SecureSnapshot = { deviceKey: randomBytes(32), pin: pin ? await makePinRecord(pin) : null };
    await writeSnapshot(await strongholdPath(file), pin, snapshot);
    sessionKey = snapshot.deviceKey;
    rememberPin(snapshot.pin !== null);
    await writeMarker({ v: 1, vault: file });
    return;
  }
  if (!devWarned) {
    devWarned = true;
    console.warn("[Nucleus] Browser preview: the device key and PIN record are kept in plain localStorage. Dev only.");
  }
  const deviceKey = randomBytes(32);
  localStorage.setItem(DEV_KEY, toB64(deviceKey));
  localStorage.setItem(DEV_PIN, JSON.stringify(pin ? await makePinRecord(pin) : null));
  await writeMarker({ v: 1, vault: "dev-preview" });
  sessionKey = deviceKey;
}

/** Unlocks the vault and caches the device key for this run. */
export async function unlockSecure(pin: string | null): Promise<void> {
  if (isTauri()) {
    const marker = await readMarker();
    if (!marker) throw new SecureStoreMissingError();
    const snapshot = await readSnapshot(await strongholdPath(marker.vault), pin);
    sessionKey = snapshot.deviceKey;
    rememberPin(snapshot.pin !== null);
    return;
  }
  const keyRaw = localStorage.getItem(DEV_KEY);
  const pinRaw = localStorage.getItem(DEV_PIN);
  if (!keyRaw) throw new SecureStoreMissingError();
  const record: PinRecord | null = pinRaw ? ((JSON.parse(pinRaw) as PinRecord | null) ?? null) : null;
  if (record === null) {
    if (pin !== null) throw new WrongPinError();
  } else {
    if (typeof pin !== "string" || !(await verifyPinRecord(record, pin))) throw new WrongPinError();
  }
  sessionKey = Uint8Array.from(atob(keyRaw), (c) => c.charCodeAt(0));
  rememberPin(record !== null);
}

/**
 * What launch has to do:
 *  - "empty": no key store yet → run the first-run flow;
 *  - "lock":  a PIN is set → show the lock screen;
 *  - "open":  no PIN set → the key store is already open, go straight to the data.
 */
export type BootProbe = { mode: "empty" | "lock" | "open" };

export async function probeSecure(): Promise<BootProbe> {
  const marker = await readMarker();
  if (!marker) {
    rememberPin(false); // nothing set up yet — there is no lock either
    return { mode: "empty" };
  }
  if (isTauri()) {
    try {
      const snapshot = await readSnapshot(await strongholdPath(marker.vault), null);
      if (snapshot.pin === null) {
        sessionKey = snapshot.deviceKey;
        rememberPin(false);
        return { mode: "open" };
      }
      rememberPin(true);
      return { mode: "lock" };
    } catch {
      rememberPin(true);
      return { mode: "lock" }; /* a PIN is set (null-password load fails), or a broken store */
    }
  }
  const keyRaw = localStorage.getItem(DEV_KEY);
  const pinRaw = localStorage.getItem(DEV_PIN);
  if (!keyRaw) {
    rememberPin(true);
    return { mode: "lock" };
  }
  const record: PinRecord | null = pinRaw ? ((JSON.parse(pinRaw) as PinRecord | null) ?? null) : null;
  if (record === null) {
    sessionKey = Uint8Array.from(atob(keyRaw), (c) => c.charCodeAt(0));
    rememberPin(false);
    return { mode: "open" };
  }
  rememberPin(true);
  return { mode: "lock" };
}

/** Whether an app-lock PIN is currently set (drives the Settings card).
 *  Reads the in-memory observation only: boot, unlock, create and rotation all
 *  remember the true state, and re-opening the snapshot here would ask the
 *  stronghold plugin for a second concurrent instance, which stalls. */
export async function securePinStatus(): Promise<boolean> {
  return knownPin ?? false;
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
 * Either side may be null: (null, pin) turns the lock ON, (pin, null) turns it
 * OFF, pin→pin rotates. The device key never changes, so the saved document
 * stays readable.
 */
export async function changeSecurePin(oldPin: string | null, newPin: string | null): Promise<void> {
  if (!isTauri()) {
    const keyRaw = localStorage.getItem(DEV_KEY);
    const pinRaw = localStorage.getItem(DEV_PIN);
    if (!keyRaw) throw new SecureStoreMissingError();
    const record: PinRecord | null = pinRaw ? ((JSON.parse(pinRaw) as PinRecord | null) ?? null) : null;
    if (record === null) {
      if (oldPin !== null) throw new WrongPinError();
    } else if (typeof oldPin !== "string" || !(await verifyPinRecord(record, oldPin))) {
      throw new WrongPinError();
    }
    localStorage.setItem(DEV_PIN, JSON.stringify(newPin ? await makePinRecord(newPin) : null));
    rememberPin(newPin !== null);
    return;
  }
  const marker = await readMarker();
  if (!marker) throw new SecureStoreMissingError();
  const oldPath = await strongholdPath(marker.vault);
  const snapshot = await readSnapshot(oldPath, oldPin);
  const newFile = `nucleus-keys-${randomId()}.hold`;
  const newPath = await strongholdPath(newFile);
  // The new snapshot gets a freshly derived record for the new PIN — null when
  // the lock is being turned off. The old record must never be carried over.
  const record = newPin ? await makePinRecord(newPin) : null;
  await writeSnapshot(newPath, newPin, { deviceKey: snapshot.deviceKey, pin: record });
  await writeMarker({ v: 1, vault: newFile });
  sessionKey = snapshot.deviceKey;
  rememberPin(newPin !== null);
  try {
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
  // Keep the dialog's promise: "erases the PIN, the key and the document".
  // A fresh key store can never decrypt the old envelope, so a leftover
  // document would only ever surface as the unreadable-document screen.
  await storage.removeItem(DB_KEY).catch(() => {});
  await storage.removeItem(LEGACY_DB_KEY).catch(() => {});
  sessionKey = null;
  rememberPin(false);
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
