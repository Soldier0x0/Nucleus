/**
 * This computer's sync identity (desktop plan D2).
 *
 * The key pair is made once, the first time the Pair screen opens, and lives
 * inside the encrypted document settings (`settings.desktopSync`), so it is
 * only available while unlocked and never syncs. The public half is mirrored
 * to local prefs so GET /info can answer a paired phone even while the app is
 * locked; nothing secret is ever written there.
 */
import type { DB } from "@core/types";
import { newDeviceKeyPair } from "@core/pairing";
import { randomBytes } from "../platform/crypto";
import { localPrefs } from "../platform/storage";

export type DesktopSyncIdentity = { deviceId: string; name: string; publicKey: string; privateKey: string };
export type PublicIdentity = { deviceId: string; name: string; publicKey: string };

const PUBLIC_CACHE_KEY = "nucleus.desktop.sync.public.v1";
const KEY_B64 = /^[A-Za-z0-9+/]{43}=$/;

export function readDesktopSync(db: DB): DesktopSyncIdentity | null {
  const raw = (db.settings as unknown as { desktopSync?: unknown }).desktopSync;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.deviceId !== "string" || !row.deviceId.trim()) return null;
  if (typeof row.name !== "string" || !row.name.trim()) return null;
  if (typeof row.publicKey !== "string" || !KEY_B64.test(row.publicKey)) return null;
  if (typeof row.privateKey !== "string" || !KEY_B64.test(row.privateKey)) return null;
  return { deviceId: row.deviceId.trim(), name: row.name.trim(), publicKey: row.publicKey, privateKey: row.privateKey };
}

export function withDesktopSync(db: DB, identity: DesktopSyncIdentity): DB {
  return { ...db, settings: { ...db.settings, desktopSync: identity } as DB["settings"] };
}

export function newDesktopSyncIdentity(name: string): DesktopSyncIdentity {
  const keys = newDeviceKeyPair();
  const deviceId = [...randomBytes(8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { deviceId, name, publicKey: keys.publicKey, privateKey: keys.privateKey };
}

export function rememberPublicIdentity(identity: PublicIdentity): void {
  localPrefs.set(PUBLIC_CACHE_KEY, JSON.stringify({ deviceId: identity.deviceId, name: identity.name, publicKey: identity.publicKey }));
}

export function cachedPublicIdentity(): PublicIdentity | null {
  const raw = localPrefs.get(PUBLIC_CACHE_KEY);
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as Record<string, unknown>;
    if (typeof row?.deviceId !== "string" || !row.deviceId) return null;
    if (typeof row.name !== "string") return null;
    if (typeof row.publicKey !== "string" || !KEY_B64.test(row.publicKey)) return null;
    return { deviceId: row.deviceId, name: row.name, publicKey: row.publicKey };
  } catch {
    return null;
  }
}
