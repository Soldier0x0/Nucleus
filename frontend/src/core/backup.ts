import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { DB } from "./types";
import { normalizeDB } from "./defaults";
import { decryptWithPassword, encryptWithPassword, type PasswordEnvelope } from "./crypto";

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

export const countsOf = (db: DB) => ({
  vehicles: db.vehicles.length,
  fuel: db.fuel.length,
  services: db.services.length,
  transactions: db.txns.length,
  subscriptions: db.subscriptions.length,
  trips: db.trips.length,
  appliances: db.appliances.length,
  notes: db.notes?.length ?? 0,
  links: db.links.length,
});

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

const byId = <T extends { id: string }>(mine: T[], theirs: T[]): T[] => {
  const map = new Map(mine.map((x) => [x.id, x]));
  theirs.forEach((x) => map.set(x.id, x)); // same id -> imported copy wins
  return [...map.values()];
};

/** Merge a backup into the current device data instead of replacing it. */
export function mergeDB(mine: DB, theirs: DB): DB {
  return {
    ...mine,
    vehicles: byId(mine.vehicles, theirs.vehicles),
    fuel: byId(mine.fuel, theirs.fuel),
    services: byId(mine.services, theirs.services),
    txns: byId(mine.txns, theirs.txns),
    subscriptions: byId(mine.subscriptions, theirs.subscriptions),
    links: byId(mine.links, theirs.links),
    trips: byId(mine.trips, theirs.trips),
    appliances: byId(mine.appliances, theirs.appliances),
    notes: byId(mine.notes ?? [], theirs.notes ?? []),
    toolHistory: byId(mine.toolHistory, theirs.toolHistory).slice(0, 200),
    budget: { monthly: theirs.budget.monthly || mine.budget.monthly, categories: { ...mine.budget.categories, ...theirs.budget.categories } },
    attention: { ...mine.attention, ...theirs.attention },
  };
}

export const mergePreview = (mine: DB, theirs: DB) => {
  const m = countsOf(mergeDB(mine, theirs));
  const a = countsOf(mine);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${a[k as keyof typeof a]} → ${v}`]));
};
