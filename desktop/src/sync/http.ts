/**
 * HTTP contract for phone-initiated sync (desktop plan D2).
 *
 * Rust relays every request here; this module owns all crypto, merge and vault
 * rules using the shared core. Phones are the only initiators, so every reply
 * is either a sealed message for a known pair key or the plain locked/refused
 * fallback the phone can show without decrypting.
 *
 *   GET  /info -> 200 { t, deviceId, name, publicKey }     (public identity, even while locked)
 *   POST /pair <- { t:"nucleus-pair-1", publicKey, body:"NPS1…" }
 *                 body opens with pairKey = HKDF(ECDH(desktopPriv, phonePub), code)
 *   POST /sync <- { deviceId, body:"NPS1…" } sealed with that device's pair key
 */
import type { DB, PairedDevice } from "@core/types";
import { addPairedDevice, derivePairKey, openMessage, pairedDeviceById, sealMessage, verifyPairProof } from "@core/pairing";
import { applySyncDelta, changesSince, missingVaultFiles, vaultFileList, type SyncDelta, type VaultFile } from "@core/syncPackage";
import type { SyncCollection } from "@core/syncStamp";
import { fromUtf8 } from "../platform/crypto";
import { cachedPublicIdentity, rememberPublicIdentity } from "./identity";
import { currentPairCode, getSyncRuntime, noteSyncSummary } from "./runtime";

export type HttpReply = { status: number; body: string };

const MAX_SEND_B64 = 8 * 1024 * 1024;

const BLOB_TARGETS: { list: SyncCollection; field: string; kind: string; fallbackMime: string }[] = [
  { list: "papers", field: "file", kind: "papers.file", fallbackMime: "application/pdf" },
  { list: "papers", field: "photo", kind: "papers.photo", fallbackMime: "image/jpeg" },
  { list: "services", field: "billFile", kind: "services.billFile", fallbackMime: "application/pdf" },
  { list: "txns", field: "photo", kind: "txns.photo", fallbackMime: "image/jpeg" },
  { list: "utilities", field: "photo", kind: "utilities.photo", fallbackMime: "image/jpeg" },
  { list: "vehicles", field: "cover", kind: "vehicles.cover", fallbackMime: "image/jpeg" },
  { list: "media", field: "cover", kind: "media.cover", fallbackMime: "image/jpeg" },
];

const reply = (status: number, value: unknown): HttpReply => ({ status, body: typeof value === "string" ? value : JSON.stringify(value) });
const locked = () => reply(503, { error: "locked" });

export function handleSyncRequest(method: string, path: string, body: Uint8Array): HttpReply {
  const route = path.split("?")[0] ?? path;
  if (method === "GET" && route === "/info") return handleInfo();
  if (method === "POST" && route === "/pair") return handlePair(body);
  if (method === "POST" && route === "/sync") return handleSync(body);
  return reply(404, { error: "not-found" });
}

function handleInfo(): HttpReply {
  const runtime = getSyncRuntime();
  const identity = cachedPublicIdentity() ?? runtime?.identity() ?? null;
  if (!identity) return locked();
  return reply(200, { t: "nucleus-info-1", deviceId: identity.deviceId, name: identity.name, publicKey: identity.publicKey });
}

function handlePair(body: Uint8Array): HttpReply {
  const runtime = getSyncRuntime();
  const identity = runtime?.identity() ?? null;
  const code = currentPairCode();
  if (!runtime || !identity || !code) return locked();

  let outer: Record<string, unknown>;
  try {
    const parsed = JSON.parse(fromUtf8(body)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply(400, { ok: false, error: "bad-request" });
    outer = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { ok: false, error: "bad-request" });
  }
  if (outer.t !== "nucleus-pair-1" || typeof outer.body !== "string") return reply(400, { ok: false, error: "bad-request" });
  const phonePublicKey = typeof outer.publicKey === "string" ? outer.publicKey : typeof outer.phonePublicKey === "string" ? outer.phonePublicKey : "";
  if (!phonePublicKey) return reply(403, { ok: false, error: "bad-code" });

  let pairKey: string;
  try {
    pairKey = derivePairKey(identity.privateKey, phonePublicKey, code);
  } catch {
    return reply(403, { ok: false, error: "bad-code" });
  }
  const refused = sealMessage(pairKey, { ok: false, error: "bad-code" });

  let payload: Record<string, unknown>;
  try {
    const opened = openMessage(pairKey, outer.body) as unknown;
    if (!opened || typeof opened !== "object" || Array.isArray(opened)) return { status: 403, body: refused };
    payload = opened as Record<string, unknown>;
  } catch {
    return { status: 403, body: refused };
  }

  const phoneId = typeof payload.deviceId === "string" ? payload.deviceId.trim() : "";
  const phoneName = typeof payload.name === "string" ? payload.name.trim() : "";
  const phoneKey = typeof payload.phonePublicKey === "string" ? payload.phonePublicKey : phonePublicKey;
  const proof = typeof payload.proof === "string" ? payload.proof : "";
  if (!phoneId || phoneKey !== phonePublicKey || !verifyPairProof(pairKey, proof)) return { status: 403, body: refused };

  const device: PairedDevice = { id: phoneId, name: phoneName || "Phone", key: pairKey, lastSyncAt: "" };
  runtime.apply((db) => addPairedDevice(db, device));
  rememberPublicIdentity(identity);
  return reply(200, sealMessage(pairKey, { ok: true, deviceId: identity.deviceId, name: identity.name, publicKey: identity.publicKey }));
}

function handleSync(body: Uint8Array): HttpReply {
  const runtime = getSyncRuntime();
  if (!runtime) return locked();
  const db = runtime.db();

  const text = fromUtf8(body).trim();
  let wantedDeviceId = "";
  let sealed = "";
  if (text.startsWith("NPS1.")) {
    sealed = text;
  } else {
    try {
      const outer = JSON.parse(text) as unknown;
      if (outer && typeof outer === "object" && !Array.isArray(outer)) {
        const row = outer as Record<string, unknown>;
        if (typeof row.body === "string") {
          sealed = row.body;
          wantedDeviceId = typeof row.deviceId === "string" ? row.deviceId : "";
        }
      }
    } catch {
      /* falls through to unknown-device */
    }
  }
  if (!sealed) return reply(403, { ok: false, error: "unknown-device" });

  const paired = db.settings.pairedDevices ?? [];
  let device: PairedDevice | undefined;
  let payload: Record<string, unknown> | null = null;
  if (wantedDeviceId) {
    device = pairedDeviceById(db, wantedDeviceId);
    if (!device) return reply(403, { ok: false, error: "unknown-device" });
    try {
      const opened = openMessage(device.key, sealed) as unknown;
      if (opened && typeof opened === "object" && !Array.isArray(opened)) payload = opened as Record<string, unknown>;
    } catch {
      payload = null;
    }
  } else {
    for (const candidate of paired) {
      try {
        const opened = openMessage(candidate.key, sealed) as unknown;
        if (opened && typeof opened === "object" && !Array.isArray(opened)) {
          device = candidate;
          payload = opened as Record<string, unknown>;
          break;
        }
      } catch {
        /* try the next paired key */
      }
    }
  }
  if (!device || !payload) return reply(403, { ok: false, error: "unknown-device" });
  const owner = device;
  const refused = (error: string) => ({ status: 403, body: sealMessage(owner.key, { ok: false, error }) });
  if (payload.deviceId !== owner.id) return refused("unknown-device");

  const changes = normalizeChanges(payload.changes);
  const incomingVault = Array.isArray(payload.vaultFiles) ? payload.vaultFiles : [];
  const vaultHashes = normalizeHashes(payload.vaultHashes);
  const now = new Date().toISOString();

  const merged = applySyncDelta(db, changes);
  const withFiles = applyIncomingVaultFiles(merged.db, incomingVault);
  const outgoing = changesSince(withFiles, owner.lastSyncAt || null);
  const missing = missingVaultFiles(vaultFileList(withFiles), vaultHashes);
  const files = collectVaultFiles(withFiles, missing);
  const haveOnDesktop = new Set(vaultFileList(withFiles).map((f) => f.hash));
  const needFromPhone = vaultHashes.filter((f) => !haveOnDesktop.has(f.hash)).map((f) => ({ hash: f.hash }));
  const outCount = countDelta(outgoing);
  const next = setDeviceLastSync(withFiles, owner.id, now);

  runtime.apply(() => next);
  noteSyncSummary(owner.id, { at: now, inCount: merged.inCount, outCount });
  return reply(200, sealMessage(owner.key, { ok: true, changes: outgoing, vaultFiles: files, needFromPhone, summary: { in: merged.inCount, out: outCount } }));
}

function normalizeChanges(raw: unknown): SyncDelta {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const records = row.records && typeof row.records === "object" && !Array.isArray(row.records) ? (row.records as SyncDelta["records"]) : {};
  const tombstones = Array.isArray(row.tombstones) ? row.tombstones : [];
  return { records, tombstones: tombstones as SyncDelta["tombstones"] };
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

function countDelta(delta: SyncDelta): number {
  let n = 0;
  for (const rows of Object.values(delta.records)) if (Array.isArray(rows)) n += rows.length;
  return n + (delta.tombstones?.length ?? 0);
}

function applyIncomingVaultFiles(db: DB, files: unknown[]): DB {
  const have = new Set(vaultFileList(db).map((f) => f.hash));
  let next = db;
  for (const raw of files) {
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

function dataPrefix(target: { field: string; fallbackMime: string }, row: Record<string, unknown>, mime: unknown): string {
  const existing = row[target.field];
  if (typeof existing === "string" && existing.startsWith("data:")) {
    const comma = existing.indexOf(",");
    if (comma > 5) return existing.slice(0, comma + 1);
  }
  if (typeof row.mime === "string" && row.mime) return `data:${row.mime};base64,`;
  if (typeof mime === "string" && mime) return `data:${mime};base64,`;
  return `data:${target.fallbackMime};base64,`;
}

function collectVaultFiles(db: DB, missing: VaultFile[]): ({ hash: string; kind: string; ref: string; size: number; dataB64: string })[] {
  const out: { hash: string; kind: string; ref: string; size: number; dataB64: string }[] = [];
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

function blobBase64(db: DB, file: VaultFile): string | null {
  const target = BLOB_TARGETS.find((t) => t.kind === file.kind);
  if (!target) return null;
  const rows = (db[target.list] as unknown as Record<string, unknown>[] | undefined) ?? [];
  const uri = rows.find((r) => r.id === file.ref)?.[target.field];
  if (typeof uri !== "string" || !uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  return comma >= 0 ? uri.slice(comma + 1) : null;
}

function setDeviceLastSync(db: DB, id: string, at: string): DB {
  const pairedDevices = (db.settings.pairedDevices ?? []).map((d) => (d.id === id ? { ...d, lastSyncAt: at } : d));
  return { ...db, settings: { ...db.settings, pairedDevices, lastSyncAt: at } };
}
