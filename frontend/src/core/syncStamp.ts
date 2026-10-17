import type { DB, Tombstone } from "./types";
import { appendJournal } from "./journal";

/** Record lists that sync between devices. Each row has a stable `id`. */
export const SYNC_COLLECTIONS = [
  "vehicles",
  "fuel",
  "odometerLogs",
  "vehicleJourneys",
  "services",
  "txns",
  "subscriptions",
  "links",
  "trips",
  "appliances",
  "utilities",
  "chores",
  "notes",
  "rules",
  "customTools",
  "media",
  "funds",
  "debts",
  "netWorth",
  "people",
  "papers",
  "stations",
  "parts",
  "specs",
  "kanban",
  "templates",
  "reminders",
  "medicines",
] as const satisfies readonly (keyof DB)[];

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

type Row = { id: string; updatedAt?: string };

/** Tombstones older than this are dropped; every device is expected to have synced by then. */
export const TOMBSTONE_DAYS = 180;

const rows = (db: DB, key: SyncCollection): Row[] => ((db[key] as Row[] | undefined) ?? []);

/**
 * Called after every local edit. Rows that are new or changed (a new object
 * for the same id) get `updatedAt = now`; ids that disappeared get a
 * tombstone. Unchanged rows keep their object identity, so this is cheap.
 */
export function stampChanges(prev: DB, next: DB, now: string): DB {
  if (prev === next) return next;
  let out = next;
  const dead: Tombstone[] = [];
  for (const key of SYNC_COLLECTIONS) {
    const before = rows(prev, key);
    const after = rows(next, key);
    if (before === after) continue;
    const old = new Map(before.map((r) => [r.id, r]));
    let changed = false;
    const stamped = after.map((r) => {
      if (old.get(r.id) === r) return r;
      changed = true;
      return { ...r, updatedAt: now };
    });
    if (changed) out = { ...out, [key]: stamped };
    const live = new Set(after.map((r) => r.id));
    for (const r of before) if (!live.has(r.id)) dead.push({ kind: key, id: r.id, deletedAt: now });
  }
  const cutoff = new Date(Date.parse(now) - TOMBSTONE_DAYS * 86400000).toISOString();
  const kept = (out.tombstones ?? []).filter((t) => t.deletedAt >= cutoff);
  const journal = appendJournal(prev, out, now);
  const tidy = !dead.length && kept.length === (out.tombstones ?? []).length;
  if (tidy && journal === (out.journal ?? [])) return out;
  return { ...out, tombstones: mergeTombstones(kept, dead), journal };
}

const tKey = (t: Tombstone) => `${t.kind}:${t.id}`;

export function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const map = new Map(a.map((t) => [tKey(t), t]));
  for (const t of b) {
    const cur = map.get(tKey(t));
    if (!cur || t.deletedAt > cur.deletedAt) map.set(tKey(t), t);
  }
  return [...map.values()];
}

/**
 * Per-row last-write-wins. A tie (including two rows with no `updatedAt`)
 * goes to `theirs`, which is how Merge behaved before. A tombstone removes a
 * row unless that row was edited after the delete.
 */
export function mergeRows<T extends Row>(mine: T[], theirs: T[], kind: SyncCollection, tombstones: Tombstone[]): T[] {
  const map = new Map(mine.map((x) => [x.id, x]));
  for (const x of theirs) {
    const cur = map.get(x.id);
    if (!cur || (x.updatedAt ?? "") >= (cur.updatedAt ?? "")) map.set(x.id, x);
  }
  const deleted = new Map(tombstones.filter((t) => t.kind === kind).map((t) => [t.id, t.deletedAt]));
  return [...map.values()].filter((x) => {
    const at = deleted.get(x.id);
    return at === undefined || (x.updatedAt ?? "") > at;
  });
}
