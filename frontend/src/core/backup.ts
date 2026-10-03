import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { DB } from "./types";
import { normalizeDB } from "./defaults";
import { decryptWithPassword, encryptWithPassword, type PasswordEnvelope } from "./crypto";
import { countsOf } from "./merge";

export { countsOf, mergeDB, mergePreview } from "./merge";

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

/** Result of picking a file: either readable, or an encrypted blob awaiting a password. */
export type PickedBackup = { kind: "plain"; file: BackupFile } | { kind: "encrypted"; env: PasswordEnvelope; exportedAt: string };

export function buildBackup(db: DB): BackupFile {
  return { format: BACKUP_FORMAT, schema: 1, exportedAt: new Date().toISOString(), counts: countsOf(db), data: db };
}

export async function exportBackup(db: DB, password?: string) {
  const payload = buildBackup(db);
  const json = password
    ? JSON.stringify({ format: BACKUP_FORMAT, schema: 2, encrypted: true, exportedAt: payload.exportedAt, enc: await encryptWithPassword(JSON.stringify(payload), password) }, null, 2)
    : JSON.stringify(payload, null, 2);
  const name = `nucleus-backup-${new Date().toISOString().slice(0, 10)}${password ? "-encrypted" : ""}.json`;
  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = (globalThis as any).document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return name;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Save Nucleus backup" });
  return name;
}

export function parseBackup(text: string): PickedBackup {
  const obj = JSON.parse(text);
  if (!ACCEPTED.includes(obj?.format)) throw new Error("This file is not a Nucleus backup.");
  if (obj.encrypted && obj.enc) return { kind: "encrypted", env: obj.enc, exportedAt: obj.exportedAt };
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

export async function pickBackup(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  let text: string;
  if (Platform.OS === "web") {
    text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  } else {
    text = await new File(asset.uri).text();
  }
  return parseBackup(text);
}
