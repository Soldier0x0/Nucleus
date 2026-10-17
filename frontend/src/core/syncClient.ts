/**
 * Phone side of the LAN sync conversation (desktop plan D2).
 *
 * Pure functions only: build the sealed pair/sync bodies, open the sealed
 * replies and merge them with the same core rules the desktop uses. The
 * network transport and the screens live outside this file.
 *
 * The desktop server contract (desktop/src/sync/http.ts) is mirrored here:
 *   GET  /info -> { t:"nucleus-info-1", deviceId, name, publicKey }
 *   POST /pair <- { t:"nucleus-pair-1", publicKey, body:"NPS1…" }
 *   POST /sync <- { deviceId, body:"NPS1…" }  (deviceId is this phone's id)
 */
import type { DB, PairedDevice } from "./types";
import { addPairedDevice, derivePairKey, newDeviceKeyPair, openMessage, pairProof, removePairedDevice, sealMessage, PAIR_QR_TAG } from "./pairing";
import { applySyncDelta, changesSince, vaultFileList, type SyncDelta, type VaultFile } from "./syncPackage";
import type { SyncCollection } from "./syncStamp";
import { randomBytes } from "./crypto";

const SEAL_PREFIX = "NPS1.";
const MAX_SEND_B64 = 8 * 1024 * 1024;
const KEY_B64 = /^[A-Za-z0-9+/]{43}=$/;

export type PhoneSyncIdentity = { deviceId: string; name: string; publicKey: string; privateKey: string };
export type DesktopIdentity = { deviceId: string; name: string; publicKey: string };
export type PairRequest = { path: string; body: string };
export type SyncSummary = { in: number; out: number };
export type SyncApplication = { db: DB; summary: SyncSummary; needFromPhone: { hash: string }[] };
export type VaultSend = { hash: string; kind: string; ref: string; size: number; dataB64: string };

export type SyncErrorCode = "bad-code" | "locked" | "unknown-device" | "bad-response" | "not-paired" | "bad-address" | "timeout" | "unreachable" | "key-changed";

/** Plain-word wording lives in one place so every sync screen says the same thing. */
export function syncErrorMessage(code: SyncErrorCode): string {
  switch (code) {
    case "bad-code":
      return "That code didn't match. Check the six digits shown on your desktop and try again.";
    case "locked":
      return "Open Nucleus on your desktop, unlock it, and try again.";
    case "unknown-device":
      return "Your desktop doesn't recognise this phone yet. Pair it again.";
    case "not-paired":
      return "Pair a desktop first.";
    case "bad-address":
      return "Type the address as host:port, like 192.168.1.5:47821.";
    case "timeout":
    case "unreachable":
      return "No desktop answered. Keep both apps open on the same Wi-Fi and try again.";
    case "bad-response":
      return "The desktop sent a reply Nucleus could not read.";
    case "key-changed":
      return "This desktop answers with a different key than when we paired. Pair again only if you changed or reinstalled the desktop.";
    default: {
      const unreachable: never = code;
      return unreachable;
    }
  }
}

export class SyncError extends Error {
  code: SyncErrorCode;
  constructor(code: SyncErrorCode) {
    super(syncErrorMessage(code));
    this.name = "SyncError";
    this.code = code;
  }
}

function readErrorCode(raw: unknown): SyncErrorCode | null {
  if (raw === "bad-code") return "bad-code";
  if (raw === "locked") return "locked";
  if (raw === "unknown-device") return "unknown-device";
  return null;
}

/** The desktop's plain-JSON refusals (no key to seal with, or locked). */
function plainError(text: string): never {
  try {
    const raw = JSON.parse(text) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const row = raw as Record<string, unknown>;
      const code = readErrorCode(row.error);
      if (code) throw new SyncError(code);
    }
  } catch (err) {
    if (err instanceof SyncError) throw err;
  }
  throw new SyncError("bad-response");
}

/** Open a sealed reply, or read the plain refusal the desktop sends before it has a key. */
function openReply(keyB64: string, body: string, openFailure: SyncErrorCode): Record<string, unknown> {
  const text = body.trim();
  if (!text.startsWith(SEAL_PREFIX)) plainError(text);
  let opened: unknown;
  try {
    opened = openMessage(keyB64, text);
  } catch {
    throw new SyncError(openFailure);
  }
  if (!opened || typeof opened !== "object" || Array.isArray(opened)) throw new SyncError("bad-response");
  return opened as Record<string, unknown>;
}

function noteIfRefused(opened: Record<string, unknown>): void {
  if (opened.ok === true) return;
  throw new SyncError(readErrorCode(opened.error) ?? "bad-response");
}

export function parseDesktopAddress(text: string): { host: string; port: number } | null {
  const trimmed = text.trim().replace(/^https?:\/\//i, "");
  const match = /^([^\s:/]+):(\d{1,5})$/.exec(trimmed);
  if (!match) return null;
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: match[1], port };
}

/** Strict reader for the GET /info reply the manual fallback uses. */
export function parseInfoReply(body: string): DesktopIdentity | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.t !== "nucleus-info-1") return null;
  const deviceId = typeof row.deviceId === "string" ? row.deviceId.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const publicKey = typeof row.publicKey === "string" ? row.publicKey : "";
  if (!deviceId || !name) return null;
  if (!KEY_B64.test(publicKey)) return null;
  return { deviceId, name, publicKey };
}

function randomHexId(): string {
  return [...randomBytes(8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** This phone's sync identity, as stored in the document. Never merged (settings stay local). */
export function readPhoneSync(db: DB): PhoneSyncIdentity | null {
  const raw = (db.settings as unknown as { phoneSync?: unknown }).phoneSync;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.deviceId !== "string" || !row.deviceId.trim()) return null;
  if (typeof row.name !== "string" || !row.name.trim()) return null;
  if (typeof row.publicKey !== "string" || !KEY_B64.test(row.publicKey)) return null;
  if (typeof row.privateKey !== "string" || !KEY_B64.test(row.privateKey)) return null;
  return { deviceId: row.deviceId.trim().slice(0, 40), name: row.name.trim().slice(0, 40), publicKey: row.publicKey, privateKey: row.privateKey };
}

/** Read the identity, or make one from the install id. Returns the document to keep. */
export function phoneIdentity(db: DB): { db: DB; identity: PhoneSyncIdentity } {
  const existing = readPhoneSync(db);
  if (existing) return { db, identity: existing };
  const keys = newDeviceKeyPair();
  const installId = typeof db.settings.installId === "string" ? db.settings.installId.trim().slice(0, 40) : "";
  const identity: PhoneSyncIdentity = { deviceId: installId || randomHexId(), name: "Phone", publicKey: keys.publicKey, privateKey: keys.privateKey };
  return { db: { ...db, settings: { ...db.settings, phoneSync: identity } as DB["settings"] }, identity };
}

/** The POST /pair body: the phone key in the clear, everything else sealed with the one-time code. */
export function buildPairRequest(identity: PhoneSyncIdentity, desktop: DesktopIdentity, code: string): PairRequest {
  const pairKey = derivePairKey(identity.privateKey, desktop.publicKey, code);
  const body = sealMessage(pairKey, {
    phonePublicKey: identity.publicKey,
    deviceId: identity.deviceId,
    name: identity.name,
    proof: pairProof(pairKey),
  });
  return { path: "/pair", body: JSON.stringify({ t: PAIR_QR_TAG, publicKey: identity.publicKey, body }) };
}

/**
 * Trust on first use: a desktop's public key is pinned when we pair with it.
 * A second pairing with the same device id and a different key is refused
 * until the user says it is theirs (a reinstall rotates the key).
 */
export function pairKeyConflict(db: DB, desktop: DesktopIdentity): boolean {
  const existing = db.settings.pairedDevices?.find((d) => d.id === desktop.deviceId);
  return !!existing?.pubKey && existing.pubKey !== desktop.publicKey;
}

/** Open the desktop's answer and keep it, with the pair key as the device's shared key. */
export function handlePairResponse(db: DB, desktop: DesktopIdentity, code: string, sealedResponse: string): DB {
  const identity = readPhoneSync(db);
  if (!identity) throw new SyncError("not-paired");
  const pairKey = derivePairKey(identity.privateKey, desktop.publicKey, code);
  const opened = openReply(pairKey, sealedResponse, "bad-code");
  noteIfRefused(opened);
  const id = typeof opened.deviceId === "string" && opened.deviceId.trim() ? opened.deviceId.trim() : desktop.deviceId;
  const name = typeof opened.name === "string" && opened.name.trim() ? opened.name.trim() : desktop.name;
  const device: PairedDevice = { id: id.slice(0, 40), name: name.slice(0, 40), key: pairKey, lastSyncAt: "", pubKey: desktop.publicKey };
  return addPairedDevice(db, device);
}

type SyncRequestPayload = {
  deviceId: string;
  changes: SyncDelta;
  vaultHashes: VaultFile[];
  vaultFiles: VaultSend[];
};

function sealedSyncBody(identity: PhoneSyncIdentity, device: PairedDevice, payload: SyncRequestPayload): string {
  return JSON.stringify({ deviceId: identity.deviceId, body: sealMessage(device.key, payload) });
}

/** The POST /sync body for a round: local changes, the full blob list, no blobs yet. */
export function buildSyncRequest(db: DB, device: PairedDevice): string {
  const identity = readPhoneSync(db);
  if (!identity) throw new SyncError("not-paired");
  return sealedSyncBody(identity, device, {
    deviceId: identity.deviceId,
    changes: changesSince(db, device.lastSyncAt || null),
    vaultHashes: vaultFileList(db),
    vaultFiles: [],
  });
}

function normalizeDelta(raw: unknown): SyncDelta {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const records = row.records && typeof row.records === "object" && !Array.isArray(row.records) ? (row.records as SyncDelta["records"]) : {};
  const tombstones = Array.isArray(row.tombstones) ? (row.tombstones as SyncDelta["tombstones"]) : [];
  return { records, tombstones };
}

type VaultTarget = { list: SyncCollection; field: string; kind: string; fallbackMime: string };

const BLOB_TARGETS: VaultTarget[] = [
  { list: "papers", field: "file", kind: "papers.file", fallbackMime: "application/pdf" },
  { list: "papers", field: "photo", kind: "papers.photo", fallbackMime: "image/jpeg" },
  { list: "services", field: "billFile", kind: "services.billFile", fallbackMime: "application/pdf" },
  { list: "txns", field: "photo", kind: "txns.photo", fallbackMime: "image/jpeg" },
  { list: "utilities", field: "photo", kind: "utilities.photo", fallbackMime: "image/jpeg" },
  { list: "vehicles", field: "cover", kind: "vehicles.cover", fallbackMime: "image/jpeg" },
  { list: "media", field: "cover", kind: "media.cover", fallbackMime: "image/jpeg" },
];

function dataPrefix(target: VaultTarget, row: Record<string, unknown>, mime: unknown): string {
  const existing = row[target.field];
  if (typeof existing === "string" && existing.startsWith("data:")) {
    const comma = existing.indexOf(",");
    if (comma > 5) return existing.slice(0, comma + 1);
  }
  if (typeof row.mime === "string" && row.mime) return `data:${row.mime};base64,`;
  if (typeof mime === "string" && mime) return `data:${mime};base64,`;
  return `data:${target.fallbackMime};base64,`;
}

/** Store incoming blobs into the rows they name, exactly like desktop/src/sync/http.ts. */
export function applyIncomingVaultFiles(db: DB, files: unknown): DB {
  const list = Array.isArray(files) ? files : [];
  const have = new Set(vaultFileList(db).map((f) => f.hash));
  let next = db;
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const hash = typeof row.hash === "string" ? row.hash : "";
    const kind = typeof row.kind === "string" ? row.kind : "";
    const ref = typeof row.ref === "string" ? row.ref : "";
    const dataB64 = typeof row.dataB64 === "string" ? row.dataB64 : "";
    if (!hash || !kind || !ref || !dataB64 || have.has(hash)) continue;
    const target = BLOB_TARGETS.find((t) => t.kind === kind);
    if (!target) continue;
    const rows = (next[target.list] as unknown as Record<string, unknown>[] | undefined) ?? [];
    const index = rows.findIndex((r) => r.id === ref);
    if (index < 0) continue;
    const existing = rows[index]!;
    const updated = { ...existing, [target.field]: `${dataPrefix(target, existing, row.mime)}${dataB64}` };
    next = { ...next, [target.list]: rows.map((r, i) => (i === index ? updated : r)) };
    have.add(hash);
  }
  return next;
}

function blobBase64(db: DB, file: VaultFile): string | null {
  const target = BLOB_TARGETS.find((t) => t.kind === file.kind);
  if (!target) return null;
  const rows = (db[target.list] as unknown as Record<string, unknown>[] | undefined) ?? [];
  const uri = rows.find((r) => r.id === file.ref)?.[target.field];
  if (typeof uri !== "string" || !uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  return comma >= 0 ? uri.slice(comma + 1) : null;
}

/** Blobs for the hashes the desktop asked for, capped so one body stays small. */
export function collectVaultFiles(db: DB, missing: VaultFile[]): VaultSend[] {
  const out: VaultSend[] = [];
  let total = 0;
  for (const file of missing) {
    const dataB64 = blobBase64(db, file);
    if (!dataB64) continue;
    if (total + dataB64.length > MAX_SEND_B64) continue;
    total += dataB64.length;
    out.push({ hash: file.hash, kind: file.kind, ref: file.ref, size: file.size, dataB64 });
  }
  return out;
}

function normalizeHashes(raw: unknown): VaultFile[] {
  if (!Array.isArray(raw)) return [];
  const out: VaultFile[] = [];
  for (const entry of raw) {
    const hash = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as Record<string, unknown>).hash : undefined;
    if (typeof hash === "string" && hash) out.push({ hash, size: 0, kind: "", ref: "" });
  }
  return out;
}

function normalizeSummary(raw: unknown, inFallback: number, outFallback: number): SyncSummary {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const inCount = typeof row.in === "number" && Number.isFinite(row.in) ? Math.max(0, Math.trunc(row.in)) : inFallback;
  const outCount = typeof row.out === "number" && Number.isFinite(row.out) ? Math.max(0, Math.trunc(row.out)) : outFallback;
  return { in: inCount, out: outCount };
}

function setDeviceLastSync(db: DB, id: string, at: string): DB {
  const pairedDevices = (db.settings.pairedDevices ?? []).map((d) => (d.id === id ? { ...d, lastSyncAt: at } : d));
  return { ...db, settings: { ...db.settings, pairedDevices, lastSyncAt: at } };
}

/** Merge one /sync reply: desktop changes, incoming blobs, then stamp the round's time. */
export function applySyncResponse(db: DB, device: PairedDevice, sealedResponse: string): SyncApplication {
  const opened = openReply(device.key, sealedResponse, "bad-response");
  noteIfRefused(opened);
  const merged = applySyncDelta(db, normalizeDelta(opened.changes));
  const withFiles = applyIncomingVaultFiles(merged.db, opened.vaultFiles);
  const next = setDeviceLastSync(withFiles, device.id, new Date().toISOString());
  return {
    db: next,
    summary: normalizeSummary(opened.summary, merged.inCount, merged.outCount),
    needFromPhone: normalizeHashes(opened.needFromPhone).map((f) => ({ hash: f.hash })),
  };
}

/** The follow-up POST /sync body carrying the blobs the desktop said it is missing. */
export function buildVaultUpload(db: DB, device: PairedDevice, hashes: readonly ({ hash: string } | string)[]): string {
  const identity = readPhoneSync(db);
  if (!identity) throw new SyncError("not-paired");
  const wanted = new Set(hashes.map((h) => (typeof h === "string" ? h : h.hash)).filter(Boolean));
  const files = collectVaultFiles(db, vaultFileList(db).filter((f) => wanted.has(f.hash)));
  return sealedSyncBody(identity, device, {
    deviceId: identity.deviceId,
    changes: { records: {}, tombstones: [] },
    vaultHashes: vaultFileList(db),
    vaultFiles: files,
  });
}

type DesktopAddresses = Record<string, string>;

function readDesktopAddresses(db: DB): DesktopAddresses {
  const raw = (db.settings as unknown as { desktopAddresses?: unknown }).desktopAddresses;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DesktopAddresses = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
    const key = id.trim().slice(0, 40);
    if (!key || typeof value !== "string") continue;
    if (!parseDesktopAddress(value)) continue;
    out[key] = value.trim();
  }
  return out;
}

/** The desktop's last known host:port, remembered when it was paired (ports change each launch). */
export function desktopAddress(db: DB, deviceId: string): { host: string; port: number } | null {
  const value = readDesktopAddresses(db)[deviceId];
  return value ? parseDesktopAddress(value) : null;
}

/** Remember where a desktop answers so "Sync now" can reach it later. */
export function setDesktopAddress(db: DB, deviceId: string, host: string, port: number): DB {
  const next: DesktopAddresses = { ...readDesktopAddresses(db), [deviceId.trim().slice(0, 40)]: `${host.trim()}:${port}` };
  return { ...db, settings: { ...db.settings, desktopAddresses: next } as DB["settings"] };
}

/** Forget a desktop: its pair key, name and saved address go together. */
export function forgetDesktop(db: DB, deviceId: string): DB {
  const addresses = readDesktopAddresses(db);
  delete addresses[deviceId];
  const without = removePairedDevice(db, deviceId);
  return { ...without, settings: { ...without.settings, desktopAddresses: addresses } as DB["settings"] };
}
