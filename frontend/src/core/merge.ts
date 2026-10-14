import type { DB } from "./types";
import { mergeRows, mergeTombstones, SYNC_COLLECTIONS, type SyncCollection } from "./syncStamp";

const byId = <T extends { id: string }>(mine: T[], theirs: T[]): T[] => {
  const map = new Map(mine.map((x) => [x.id, x]));
  theirs.forEach((x) => map.set(x.id, x));
  return [...map.values()];
};

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
  rules: db.rules?.length ?? 0,
  tools: db.customTools?.length ?? 0,
  kanban: db.kanban?.length ?? 0,
  wiki: db.wiki?.length ?? 0,
  templates: db.templates?.length ?? 0,
});

/**
 * Merge a backup (or another device) into the current data instead of replacing it.
 * Rows: newer `updatedAt` wins, a tie goes to the incoming copy, deletes stick
 * unless the row was edited after the delete. Settings stay on this device.
 */
export function mergeDB(mine: DB, theirs: DB): DB {
  const tombstones = mergeTombstones(mine.tombstones ?? [], theirs.tombstones ?? []);
  const lists = Object.fromEntries(
    SYNC_COLLECTIONS.map((key) => [key, mergeRows((mine[key] as { id: string }[] | undefined) ?? [], (theirs[key] as { id: string }[] | undefined) ?? [], key, tombstones)]),
  ) as Pick<DB, SyncCollection>;
  return {
    ...mine,
    ...lists,
    tombstones,
    toolHistory: byId(mine.toolHistory, theirs.toolHistory).slice(0, 200),
    ruleFires: { ...mine.ruleFires, ...theirs.ruleFires },
    budget: { monthly: theirs.budget.monthly || mine.budget.monthly, categories: { ...mine.budget.categories, ...theirs.budget.categories } },
    attention: { ...mine.attention, ...theirs.attention },
  };
}

export const mergePreview = (mine: DB, theirs: DB) => {
  const m = countsOf(mergeDB(mine, theirs));
  const a = countsOf(mine);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${a[k as keyof typeof a]} → ${v}`]));
};
