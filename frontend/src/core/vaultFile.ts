import type { CloudProvider, DB, Settings } from "./types";

export type { CloudProvider };

/** Passphrase for the locked file. It stays in this phone's keystore, never inside the file. */
export const FILE_PASSPHRASE_KEY = "nucleus.file.passphrase";

export function describeContents(db: DB): string {
  const money = db.txns.length;
  const days = db.cycle.days.length;
  const notes = db.notes.length;
  const trips = db.trips.length;
  const moneyWord = money === 1 ? "entry" : "entries";
  const dayWord = days === 1 ? "day" : "days";
  const noteWord = notes === 1 ? "note" : "notes";
  const tripWord = trips === 1 ? "trip" : "trips";
  return `This file has ${money} money ${moneyWord}, ${days} cycle ${dayWord}, ${notes} ${noteWord}, ${trips} ${tripWord}, and settings.`;
}

/** The file is applied only after its contents have been shown and confirmed. */
export function replaceAllowed(described: boolean, confirmed: boolean): boolean {
  return described && confirmed;
}

/** The locked file holds the document. Biometric material stays on this phone. */
export function bundleForFile(db: DB): DB {
  const copy = JSON.parse(JSON.stringify(db)) as DB;
  const settings = { ...copy.settings } as Settings & Record<string, unknown>;
  for (const key of Object.keys(settings)) {
    if (key.toLowerCase().includes("biometric")) delete settings[key];
  }
  if (settings.unlockMethod === "biometric" || settings.unlockMethod === "both") settings.unlockMethod = "pin";
  copy.settings = settings as Settings;
  return copy;
}

export function canOpenFile(input: { passphrase: string; samePhone: boolean; biometricOk: boolean }): boolean {
  if (input.passphrase.trim().length > 0) return true;
  return input.samePhone && input.biometricOk;
}

export function accessMode(samePhone: boolean): "edit" | "read-only" {
  return samePhone ? "edit" : "read-only";
}

export function defaultCloud(): CloudProvider {
  return "off";
}

export function cloudScope(provider: "drive" | "onedrive"): string {
  switch (provider) {
    case "drive":
      return "https://www.googleapis.com/auth/drive.file";
    case "onedrive":
      return "https://graph.microsoft.com/Files.ReadWrite.AppFolder";
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
}

export function uploadNotices(ok: boolean): { title: string }[] {
  if (ok) return [];
  return [{ title: "Backup did not upload" }];
}

export type CloudSignIn =
  | { ok: true; signsIn: boolean; saver: "document" | "account"; scope: string }
  | { ok: false; message: string };

/** Sign in to the provider already chosen, then upload that one locked file. */
export function cloudSignIn(provider: CloudProvider): CloudSignIn {
  switch (provider) {
    case "off":
      return { ok: false, message: "Choose Drive or OneDrive first." };
    case "drive":
    case "onedrive":
      return { ok: true, signsIn: true, saver: "account", scope: cloudScope(provider) };
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
}

export function cloudStoreMessage(provider: "drive" | "onedrive", reason: string): string {
  const why = reason.trim() || "did not finish";
  switch (provider) {
    case "drive":
      return `Drive did not store the file (${why}).`;
    case "onedrive":
      return `OneDrive did not store the file (${why}).`;
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
}

export function askUnsynced(input: { provider: CloudProvider; lastSyncAt: string | null; unlockedAt: string; asked: boolean }): boolean {
  if (input.provider === "off" || input.asked) return false;
  if (!input.lastSyncAt) return true;
  return input.lastSyncAt < input.unlockedAt;
}
