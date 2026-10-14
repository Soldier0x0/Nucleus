import type { DB } from "./types";

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

/** Merge a backup into the current device data instead of replacing it. Settings stay on this phone. */
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
    people: byId(mine.people ?? [], theirs.people ?? []),
    papers: byId(mine.papers ?? [], theirs.papers ?? []),
    parts: byId(mine.parts ?? [], theirs.parts ?? []),
    specs: byId(mine.specs ?? [], theirs.specs ?? []),
    rules: byId(mine.rules ?? [], theirs.rules ?? []),
    customTools: byId(mine.customTools ?? [], theirs.customTools ?? []),
    media: byId(mine.media ?? [], theirs.media ?? []),
    funds: byId(mine.funds ?? [], theirs.funds ?? []),
    debts: byId(mine.debts ?? [], theirs.debts ?? []),
    netWorth: byId(mine.netWorth ?? [], theirs.netWorth ?? []),
    utilities: byId(mine.utilities ?? [], theirs.utilities ?? []),
    chores: byId(mine.chores ?? [], theirs.chores ?? []),
    kanban: byId(mine.kanban ?? [], theirs.kanban ?? []),
    wiki: byId(mine.wiki ?? [], theirs.wiki ?? []),
    templates: byId(mine.templates ?? [], theirs.templates ?? []),
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
