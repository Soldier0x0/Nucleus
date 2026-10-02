import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { DB } from "./types";
import { normalizeDB } from "./defaults";

export const BACKUP_FORMAT = "nucleus-backup";
const ACCEPTED = [BACKUP_FORMAT, "tessera-backup"];

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  schema: 1;
  exportedAt: string;
  counts: Record<string, number>;
  data: DB;
};

export const countsOf = (db: DB) => ({
  vehicles: db.vehicles.length,
  fuel: db.fuel.length,
  services: db.services.length,
  transactions: db.txns.length,
  subscriptions: db.subscriptions.length,
  links: db.links.length,
});

export function buildBackup(db: DB): BackupFile {
  return { format: BACKUP_FORMAT, schema: 1, exportedAt: new Date().toISOString(), counts: countsOf(db), data: db };
}

export async function exportBackup(db: DB) {
  const json = JSON.stringify(buildBackup(db), null, 2);
  const name = `nucleus-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

export function parseBackup(text: string): BackupFile {
  const obj = JSON.parse(text);
  if (!ACCEPTED.includes(obj?.format) || !obj.data) throw new Error("This file is not a Nucleus backup.");
  const data = normalizeDB(obj.data);
  return { ...obj, data, counts: countsOf(data) };
}

export async function pickBackup(): Promise<BackupFile | null> {
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
