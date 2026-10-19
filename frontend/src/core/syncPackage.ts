/**
 * Desktop sync payloads (plan D2).
 *
 * - `changesSince` cuts a delta out of the document: records and tombstones
 *   newer than the last completed sync. `records` is a plain partial-DB, so
 *   mergeDB's rules apply unchanged.
 * - `applySyncDelta` merges with the existing last-write-wins + tombstone rules
 *   (never reimplemented here) and reports "N in, M out".
 * - Vault blobs that live inside the DB as `data:` URIs are addressed by
 *   SHA-256 of their base64 payload, so only missing files are sent.
 *   `file://` overflow blobs live on disk and are addressed in a later phase.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import type { DB, Tombstone } from "./types";
import { emptyDB } from "./defaults";
import { mergeDB } from "./merge";
import { SYNC_COLLECTIONS, type SyncCollection } from "./syncStamp";
import { toB64, toUtf8 } from "./crypto";

type Row = { id: string; updatedAt?: string };

export type SyncDelta = {
  records: Partial<Pick<DB, SyncCollection>>;
  tombstones: Tombstone[];
};

export type SyncResult = { db: DB; inCount: number; outCount: number };

const rowsOf = (db: DB, key: SyncCollection): Row[] => ((db[key] as Row[] | undefined) ?? []);
const tKey = (t: Tombstone) => `${t.kind}:${t.id}`;

/** Records with `updatedAt > since` and tombstones with `deletedAt > since`. `null` means everything. */
export function changesSince(db: DB, since: string | null): SyncDelta {
  const records: Partial<Pick<DB, SyncCollection>> = {};
  for (const key of SYNC_COLLECTIONS) {
    const rows = rowsOf(db, key).filter((r) => since === null || (r.updatedAt ?? "") > since);
    if (rows.length) Object.assign(records, { [key]: rows });
  }
  const tombstones = (db.tombstones ?? []).filter((t) => since === null || t.deletedAt > since);
  return { records, tombstones };
}

/**
 * Merge an incoming delta with the local document.
 * `inCount` counts incoming records and tombstones that won the merge;
 * `outCount` counts local records the delta would have overwritten with an
 * older copy. Device-only settings are never touched (mergeDB keeps `mine.settings`).
 */
export function applySyncDelta(db: DB, delta: SyncDelta): SyncResult {
  const theirs = { ...emptyDB(), ...delta.records, tombstones: delta.tombstones ?? [] } as DB;
  const merged = mergeDB(db, theirs);
  let inCount = 0;
  for (const key of SYNC_COLLECTIONS) {
    const incoming = (delta.records[key] as Row[] | undefined) ?? [];
    if (!incoming.length) continue;
    const won = new Map((merged[key] as Row[]).map((r) => [r.id, r]));
    for (const row of incoming) if (won.get(row.id) === row) inCount++;
  }
  const mergedTombstones = new Map(merged.tombstones.map((t) => [tKey(t), t]));
  for (const t of delta.tombstones ?? []) if (mergedTombstones.get(tKey(t)) === t) inCount++;

  let outCount = 0;
  for (const key of SYNC_COLLECTIONS) {
    const incoming = (delta.records[key] as Row[] | undefined) ?? [];
    if (!incoming.length) continue;
    const mine = new Map(rowsOf(db, key).map((r) => [r.id, r]));
    for (const row of incoming) {
      const local = mine.get(row.id);
      if (local && (local.updatedAt ?? "") > (row.updatedAt ?? "")) outCount++;
    }
  }
  return { db: merged, inCount, outCount };
}

export type VaultFile = { hash: string; size: number; kind: string; ref: string };

const BLOB_FIELDS: { list: SyncCollection; field: string; kind: string }[] = [
  { list: "papers", field: "file", kind: "papers.file" },
  { list: "papers", field: "photo", kind: "papers.photo" },
  { list: "services", field: "billFile", kind: "services.billFile" },
  { list: "txns", field: "photo", kind: "txns.photo" },
  { list: "utilities", field: "photo", kind: "utilities.photo" },
  { list: "vehicles", field: "cover", kind: "vehicles.cover" },
  { list: "media", field: "cover", kind: "media.cover" },
];

function dataUriEntry(uri: string): { hash: string; size: number } | null {
  if (!uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  const payload = comma >= 0 ? uri.slice(comma + 1) : "";
  if (!payload) return null;
  const pad = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return { hash: toB64(sha256(toUtf8(payload))), size: Math.floor((payload.length * 3) / 4) - pad };
}

/** Content hashes of every vault blob stored in the document (data: URIs only). */
export function vaultFileList(db: DB): VaultFile[] {
  const out: VaultFile[] = [];
  for (const { list, field, kind } of BLOB_FIELDS) {
    for (const row of rowsOf(db, list) as unknown as (Row & Record<string, unknown>)[]) {
      const uri = row[field];
      const entry = dataUriEntry(typeof uri === "string" ? uri : "");
      if (entry) out.push({ ...entry, kind, ref: row.id });
    }
  }
  return out;
}

/** The local blobs the other side has not hashed, so this side must send them. */
export function missingVaultFiles(localList: VaultFile[], remoteList: VaultFile[]): VaultFile[] {
  const have = new Set(remoteList.map((f) => f.hash));
  return localList.filter((f) => !have.has(f.hash));
}

/** Content check for a received blob: only store payloads that hash to the row the sender named. */
export function verifyVaultPayload(hash: string, payloadB64: string): boolean {
  return toB64(sha256(toUtf8(payloadB64))) === hash;
}
