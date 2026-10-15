/**
 * Phone-compatible backup files (sync mode 3).
 *
 * Same JSON shapes as frontend/src/core/backup.ts:
 * - plain:    { format, schema: 1, exportedAt, counts, data }
 * - password: { format, schema: 2, encrypted: true, exportedAt, enc: PasswordEnvelope }
 * Import accepts both, plus a bare document produced by older builds.
 */
import { normalizeDB } from "@core/defaults";
import { countsOf } from "@core/merge";
import type { DB } from "@core/types";
import { decryptWithPassword, encryptWithPassword, type PasswordEnvelope } from "./crypto";
import { isTauri } from "./env";
import { invoke } from "@tauri-apps/api/core";

export const BACKUP_FORMAT = "nucleus-backup";
const ACCEPTED = [BACKUP_FORMAT, "tessera-backup"];

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  schema: 1 | 2;
  exportedAt: string;
  encrypted?: boolean;
  counts: Record<string, number>;
  data: DB;
};

export type PickedBackup = { kind: "plain"; file: BackupFile } | { kind: "encrypted"; env: PasswordEnvelope; exportedAt: string };

export function buildBackup(db: DB): BackupFile {
  return { format: BACKUP_FORMAT, schema: 1, exportedAt: new Date().toISOString(), counts: countsOf(db), data: db };
}

export function backupFileName(password?: boolean): string {
  return `nucleus-backup-${new Date().toISOString().slice(0, 10)}${password ? "-encrypted" : ""}.json`;
}

/** Mirror of the phone's parseBackup; throws the same errors. */
export function parseBackup(text: string): PickedBackup {
  const obj = JSON.parse(text);
  if (!ACCEPTED.includes(obj?.format)) {
    // Older desktop previews opened a bare document; keep accepting it.
    if (obj?.data || Array.isArray(obj?.txns)) {
      const data = normalizeDB(obj?.data ?? obj);
      return { kind: "plain", file: { format: BACKUP_FORMAT, schema: 1, exportedAt: new Date().toISOString(), counts: countsOf(data), data } };
    }
    throw new Error("This file is not a Nucleus backup.");
  }
  if (obj.encrypted && obj.enc) return { kind: "encrypted", env: obj.enc as PasswordEnvelope, exportedAt: obj.exportedAt };
  if (!obj.data) throw new Error("This file is not a Nucleus backup.");
  const data = normalizeDB(obj.data);
  return { kind: "plain", file: { ...obj, data, counts: countsOf(data) } };
}

/** Wrong password simply fails the AES-GCM tag check. */
export async function decryptBackup(env: PasswordEnvelope, password: string): Promise<BackupFile> {
  let text: string;
  try {
    text = await decryptWithPassword(env, password);
  } catch {
    throw new Error("Wrong password for this backup.");
  }
  const obj = JSON.parse(text);
  const data = normalizeDB(obj.data);
  return { ...obj, encrypted: true, data, counts: countsOf(data) };
}

/** Builds the same JSON the phone writes, then saves it (dialog) or downloads it (preview). */
export async function exportBackup(db: DB, password?: string): Promise<string | null> {
  const payload = buildBackup(db);
  const json = password
    ? JSON.stringify({ format: BACKUP_FORMAT, schema: 2, encrypted: true, exportedAt: payload.exportedAt, enc: await encryptWithPassword(JSON.stringify(payload), password) }, null, 2)
    : JSON.stringify(payload, null, 2);
  const name = backupFileName(!!password);
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: name, filters: [{ name: "Nucleus backup", extensions: ["json"] }] });
    if (!path) return null;
    await invoke("write_export_file", { path, contents: json });
    return name;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}
