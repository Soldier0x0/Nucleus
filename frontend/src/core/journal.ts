/**
 * Per-record change journal (v0.13 History & Trust).
 *
 * Every local edit stamps the whole-document diff through stampChanges
 * (syncStamp.ts), which calls appendJournal here: one entry per row that was
 * added, edited or deleted, keeping the row it replaced or removed. The
 * journal never syncs and never leaves the device (files are built
 * bundleForFile-stripped); it is this phone's own record of what happened
 * when, so records can be reverted and deletions restored.
 */
import type { DB, EntityKind, JournalEntry, JournalRow } from "./types";
import { SYNC_COLLECTIONS, type SyncCollection } from "./syncStamp";
import { uid } from "./format";

export type { JournalEntry, JournalRow };
export type JournalAct = JournalEntry["act"];

export const JOURNAL_CAP = 1200;
export const JOURNAL_DAYS = 120;

const EMPTY: JournalEntry[] = [];
const EMPTYROWS: JournalRow[] = [];

/** The generic detail screen's kinds map straight to the lists they live in. */
export const KIND_TO_LIST: Record<EntityKind, SyncCollection> = {
  vehicle: "vehicles",
  fuel: "fuel",
  service: "services",
  txn: "txns",
  subscription: "subscriptions",
  trip: "trips",
  appliance: "appliances",
  note: "notes",
  media: "media",
  paper: "papers",
};

function rowOf(entry: JournalEntry): JournalRow | undefined {
  return entry.after ?? entry.before;
}

/** One entry per record touched in an edit. Sample data never journals. */
export function appendJournal(prev: DB, next: DB, now: string): JournalEntry[] {
  const priorSample = new Set((prev.settings.sampleIds ?? []) as string[]);
  const nextSample = new Set((next.settings.sampleIds ?? []) as string[]);
  const entries: JournalEntry[] = [];
  for (const key of SYNC_COLLECTIONS) {
    const before = prev[key] as JournalRow[] | undefined;
    const after = next[key] as JournalRow[] | undefined;
    const old = new Map((before ?? []).map((r) => [r.id, r]));
    for (const row of after ?? []) {
      const was = old.get(row.id);
      old.delete(row.id);
      if (priorSample.has(row.id) || nextSample.has(row.id)) continue;
      if (!was) entries.push({ id: uid(), at: now, act: "add", kind: key, recordId: row.id, after: row });
      else if (was !== row) entries.push({ id: uid(), at: now, act: "edit", kind: key, recordId: row.id, before: was, after: row });
    }
    for (const [id, was] of old) {
      if (priorSample.has(id) || nextSample.has(id)) continue;
      entries.push({ id: uid(), at: now, act: "delete", kind: key, recordId: id, before: was });
    }
  }
  if (!entries.length) return next.journal ?? EMPTY;
  const cutoff = new Date(Date.parse(now) - JOURNAL_DAYS * 86400000).toISOString();
  return [...(next.journal ?? EMPTY), ...entries]
    .filter((entry) => entry && typeof entry.id === "string" && typeof entry.at === "string" && entry.at >= cutoff)
    .slice(-JOURNAL_CAP);
}

const ACTS = new Set(["add", "edit", "delete"]);

/** Files and stores hand over lists of entries; only well-formed, recent ones are kept. */
export function normalizeJournal(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return EMPTY;
  const cutoff = new Date(Date.now() - JOURNAL_DAYS * 86400000).toISOString();
  return raw
    .filter(
      (e: unknown): e is JournalEntry =>
        !!e && typeof e === "object" && !Array.isArray(e) &&
        typeof (e as JournalEntry).id === "string" &&
        typeof (e as JournalEntry).at === "string" &&
        ACTS.has((e as JournalEntry).act) &&
        typeof (e as JournalEntry).kind === "string" &&
        typeof (e as JournalEntry).recordId === "string",
    )
    .filter((e) => SYNC_COLLECTIONS.includes(e.kind as SyncCollection) && e.at >= cutoff)
    .slice(-JOURNAL_CAP);
}

/** This record's history, newest first. */
export function journalFor(db: DB, kind: SyncCollection, recordId: string): JournalEntry[] {
  return (db.journal ?? []).filter((e) => e.kind === kind && e.recordId === recordId).reverse();
}

/** Fields an edit actually changed, capped for a one-line display. */
export function changedFields(entry: JournalEntry, limit = 3): string[] {
  if (entry.act !== "edit" || !entry.before || !entry.after) return [];
  const keys = [...new Set([...Object.keys(entry.before), ...Object.keys(entry.after)])].filter((k) => k !== "id" && k !== "updatedAt");
  const out: string[] = [];
  for (const key of keys) {
    const was = (entry.before as Record<string, unknown>)[key];
    const is = (entry.after as Record<string, unknown>)[key];
    if (typeof was === "object" || typeof is === "object") continue;
    if (was === is) continue;
    out.push(key[0]!.toUpperCase() + key.slice(1));
    if (out.length >= limit) return out;
  }
  return out;
}

const TITLE_FIELDS = ["name", "title", "category", "label", "room"] as const;

function rowTitle(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  for (const field of TITLE_FIELDS) {
    const value = (row as Record<string, unknown>)[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const date = (row as Record<string, unknown>).date;
  return typeof date === "string" ? String(date).slice(0, 12) : "";
}

const KIND_WORDS: Partial<Record<SyncCollection, string>> = {
  vehicles: "vehicle",
  fuel: "fuel fill",
  odometerLogs: "odometer",
  vehicleJourneys: "ride",
  services: "service",
  txns: "transaction",
  subscriptions: "subscription",
  links: "link",
  trips: "trip",
  appliances: "appliance",
  utilities: "bill",
  chores: "chore",
  notes: "note",
  rules: "rule",
  customTools: "tool",
  media: "media",
  funds: "fund",
  debts: "debt",
  netWorth: "snapshot",
  people: "person",
  papers: "paper",
  stations: "station",
  parts: "part",
  specs: "detail",
  kanban: "board",
  templates: "template",
  reminders: "reminder",
  medicines: "medicine",
};

export const ACT_WORDS: Record<JournalAct, string> = { add: "Added", edit: "Changed", delete: "Deleted" };

/** A human line for one entry: what it was, as named on the phone. */
export function journalLabel(entry: JournalEntry): string {
  const row = rowOf(entry);
  return rowTitle(row) || KIND_WORDS[entry.kind as SyncCollection] || entry.kind;
}

export function journalKind(entry: JournalEntry): string {
  return KIND_WORDS[entry.kind as SyncCollection] ?? entry.kind;
}

/**
 * Deletes waiting to be restored: the newest delete per record, skipping
 * records that are alive again. Newest first, for the timeline's section.
 */
export function journalDeletions(db: DB): JournalEntry[] {
  const out = new Map<string, JournalEntry>();
  for (const entry of db.journal ?? []) {
    if (entry.act !== "delete") continue;
    out.set(`${entry.kind}:${entry.recordId}`, entry);
  }
  const alive = (kind: string, id: string): boolean =>
    ((((db as unknown as Record<string, JournalRow[]>)[kind] ?? []).some((r) => r.id === id)));
  return [...out.values()].filter((e) => !alive(e.kind, e.recordId)).slice(-12).reverse();
}

/**
 * Roll one entry back: an add becomes a delete, an edit goes back to the
 * kept row, a delete is restored. Applies as a normal edit, so it stamps
 * its own journal entry.
 */
export function revertEntry(db: DB, entry: JournalEntry): DB {
  const list = entry.kind as SyncCollection;
  if (entry.act === "add") return removeRecord(db, list, entry.recordId);
  const row = entry.before;
  if (!row) return db;
  const rows = ((db[list] ?? EMPTYROWS) as JournalRow[]);
  return { ...db, [list]: [...rows.filter((r) => r.id !== row.id), row] };
}

function removeRecord(db: DB, list: SyncCollection, id: string): DB {
  const rows = ((db[list] ?? EMPTYROWS) as JournalRow[]);
  return { ...db, [list]: rows.filter((r) => r.id !== id) };
}

/** Put a deleted record back exactly as it was. */
export function restoreEntity(db: DB, entry: JournalEntry): DB {
  const row = entry.before;
  if (!row) return db;
  const list = entry.kind as SyncCollection;
  const rows = ((db[list] ?? EMPTYROWS) as JournalRow[]);
  if (rows.some((r) => r.id === row.id)) return db;
  return { ...db, [list]: [...rows, row] };
}
