/**
 * The single encrypted document, same keys and envelope as the phone:
 * `nucleus.db.v1` holds an NCE1 envelope; the legacy key is still read once.
 */
import { DB_KEY, LEGACY_DB_KEY, normalizeDB } from "@core/defaults";
import { planOpen, resolveOpen } from "@core/openDb";
import type { DB } from "@core/types";
import { isEncrypted, openString, sealString } from "./crypto";
import { storage } from "./storage";
import { getDeviceKey } from "./secure";

export type LoadResult =
  | { status: "missing" }
  | { status: "opened"; db: DB; dropLegacyAfterSave: boolean }
  | { status: "unreadable" };

export async function loadDocument(): Promise<LoadResult> {
  const [current, legacy] = await Promise.all([storage.getItem(DB_KEY), storage.getItem(LEGACY_DB_KEY)]);
  const outcome = await resolveOpen(planOpen(current, legacy), async (raw) => (isEncrypted(raw) ? openString(raw, getDeviceKey()) : raw));
  if (outcome.status === "missing") return { status: "missing" };
  if (outcome.status === "unreadable") return { status: "unreadable" };
  const db = normalizeDB(JSON.parse(outcome.json));
  // The desktop is this document's own editor; a read-only flag from a foreign
  // phone file is not carried over (D1 decision).
  db.settings.readOnly = false;
  if (outcome.dropLegacyNow) await storage.removeItem(LEGACY_DB_KEY).catch(() => {});
  return { status: "opened", db, dropLegacyAfterSave: outcome.dropLegacyAfterSave };
}

export async function saveDocument(db: DB): Promise<void> {
  await storage.setItem(DB_KEY, sealString(JSON.stringify(db), getDeviceKey()));
}

export async function dropLegacyDocument(): Promise<void> {
  await storage.removeItem(LEGACY_DB_KEY).catch(() => {});
}

export async function discardDocument(): Promise<void> {
  await storage.removeItem(DB_KEY).catch(() => {});
  await storage.removeItem(LEGACY_DB_KEY).catch(() => {});
}
