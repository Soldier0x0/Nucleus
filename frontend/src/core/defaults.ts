import type { DB, Settings } from "./types";

export const DB_KEY = "tessera.db.v1";

export const defaultSettings: Settings = {
  onboarded: false,
  currency: "INR",
  distanceUnit: "km",
  volumeUnit: "L",
  tempUnit: "C",
  timeFormat: "12h",
  theme: "system",
  accent: "ochre",
  density: "comfortable",
  privacyMode: false,
  lockEnabled: false,
  biometricEnabled: false,
  lockTimeoutSec: 30,
  blockScreenshots: true,
  autoLinkExpenses: true,
  modules: [
    { id: "vehicles", enabled: true, hidden: false },
    { id: "money", enabled: true, hidden: false },
    { id: "tools", enabled: true, hidden: false },
  ],
  tiles: [
    { id: "attention", enabled: true },
    { id: "budget", enabled: true },
    { id: "vehicle", enabled: true },
    { id: "subscriptions", enabled: true },
    { id: "tools", enabled: true },
  ],
};

export const EXPENSE_CATEGORIES = ["Food", "Groceries", "Fuel", "Vehicle", "Transport", "Bills", "Electricity", "Rent", "Shopping", "Health", "Entertainment", "Subscriptions", "Travel", "Loan EMI", "Other"];
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Interest", "Refund", "Gift", "Other"];

export function emptyDB(): DB {
  return {
    version: 1,
    settings: { ...defaultSettings, modules: defaultSettings.modules.map((m) => ({ ...m })), tiles: defaultSettings.tiles.map((t) => ({ ...t })) },
    vehicles: [],
    fuel: [],
    services: [],
    txns: [],
    subscriptions: [],
    links: [],
    budget: { monthly: 0, categories: {} },
    attention: {},
    toolHistory: [],
    recents: {},
  };
}

/** Forward-compatible merge: older/partial snapshots get any missing fields from defaults. */
export function normalizeDB(raw: any): DB {
  const base = emptyDB();
  const s = { ...base.settings, ...(raw?.settings ?? {}) };
  const knownMods = base.settings.modules.map((m) => m.id);
  s.modules = [
    ...(raw?.settings?.modules ?? []).filter((m: any) => knownMods.includes(m.id)),
    ...base.settings.modules.filter((m) => !(raw?.settings?.modules ?? []).some((x: any) => x.id === m.id)),
  ];
  const knownTiles = base.settings.tiles.map((t) => t.id);
  s.tiles = [
    ...(raw?.settings?.tiles ?? []).filter((t: any) => knownTiles.includes(t.id)),
    ...base.settings.tiles.filter((t) => !(raw?.settings?.tiles ?? []).some((x: any) => x.id === t.id)),
  ];
  return {
    ...base,
    ...raw,
    version: 1,
    settings: s,
    budget: { ...base.budget, ...(raw?.budget ?? {}) },
  };
}
